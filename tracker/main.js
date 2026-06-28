const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

// 環境変数の読み込み
let envPath = path.join(__dirname, '.env.local');
if (app.isPackaged) {
  envPath = path.join(path.dirname(app.getPath('exe')), '.env.local');
}
require('dotenv').config({ path: envPath });

// Firebaseの初期化
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, updateDoc, increment, collection, addDoc, serverTimestamp, getDoc, onSnapshot } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let fbApp;
let db;
let auth;
try {
  fbApp = initializeApp(firebaseConfig);
  db = getFirestore(fbApp);
  auth = getAuth(fbApp);
} catch (e) {
  console.error('❌ Firebase初期化失敗: .env.localの設定を確認してね！', e);
}

let mainWindow = null;
let tray = null;
let currentUser = null;
let unsubscribeFirestore = null;
let watcher = null;

// 設定ファイルのパス
const CONFIG_PATH = path.join(app.getPath('userData'), 'createxp_config.json');

// 設定の読み書き関数
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
  } catch (e) {}
}

// 暗号化・復号化ヘルパー
function encrypt(text) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(text).toString('base64');
  }
  throw new Error('Encryption is not available on this system.');
}

function decrypt(base64Text) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(base64Text, 'base64'));
  }
  throw new Error('Decryption is not available on this system.');
}

// IPCハンドラ
ipcMain.handle('auth-login', async (event, { email, password }) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // ログイン成功時に認証情報を保存（Auto Login用）
    let encryptedPassword = null;
    try {
      encryptedPassword = encrypt(password);
    } catch (e) {
      console.error('Failed to encrypt password:', e);
    }
    saveConfig({ email, encryptedPassword });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('auth-logout', async () => {
  try {
    await signOut(auth);
    // ログアウト時に認証情報を削除
    saveConfig(null);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// MVP用のローカルステート
let appState = {
  xp: 0,
  level: 0,
  quests: { date: '', saves: 0, exports: 0 },
  displayName: ''
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 350,
    height: 500,
    resizable: false,
    show: true, // 起動時に表示する
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false); // メニューバーを非表示にする

  // ウィンドウの「X」ボタンを押しても終了せず非表示にする
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 初期ステートを送信
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update-state', appState);
  });
}

// Firestoreから現在のステートを同期（リアルタイム監視）
function syncFromFirestore() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (!currentUser) return;

  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    
    // リアルタイムリスナーを設定
    unsubscribeFirestore = onSnapshot(userDocRef, async (userDoc) => {
      if (userDoc.exists()) {
        appState.xp = userDoc.data().totalXP || 0;
        appState.level = Math.floor(appState.xp / 100);
        appState.displayName = userDoc.data().displayName || '';
        
        // デイリークエストの復元・リセット処理
        const today = getTodayString();
        const storedQuests = userDoc.data().quests || { date: today, saves: 0, exports: 0 };
        if (storedQuests.date === today) {
          appState.quests = storedQuests;
        } else {
          appState.quests = { date: today, saves: 0, exports: 0 };
        }

        // UIを更新
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('update-state', appState);
        }
      } else {
        // 初期データ作成
        await setDoc(userDocRef, { totalXP: 0, level: 0, displayName: currentUser.email.split('@')[0] });
      }
    });
  } catch (e) {
    console.error("❌ Sync Error:", e);
  }
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateState(type) {
  // 日付が変わっていればクエストリセット
  const today = getTodayString();
  if (appState.quests.date !== today) {
    appState.quests = { date: today, saves: 0, exports: 0 };
  }

  // XPはFirestoreのonSnapshotから同期されるため、ローカルでは加算しない
  // クエスト進捗のみローカルで管理
  if (type === 'Save') appState.quests.saves++;
  if (type === 'Export') appState.quests.exports++;

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('update-state', appState);
  }
}

function sendLogToUI(type, file, xp) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('new-log', {
      type,
      file,
      xp,
      time: new Date().toLocaleTimeString()
    });
  }
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    const iconPath = path.join(__dirname, 'tray-icon.png');
    const options = { title, body };
    if (fs.existsSync(iconPath)) options.icon = iconPath;
    new Notification(options).show();
  }
}

// ----------------------------------------------------
// Tracker Logic (from index.js)
// ----------------------------------------------------
function startTracker() {
  const WORK_DIR = path.join(__dirname, '../Work');
  if (!fs.existsSync(WORK_DIR)) {
      fs.mkdirSync(WORK_DIR, { recursive: true });
  }

  const SAVE_EXTS = ['.psd', '.prproj', '.aep'];
  const VIDEO_EXTS = ['.mp4', '.mov', '.mxf', '.avi'];
  const saveTimers = new Map();
  const pendingExports = new Set();

  async function handleXPEvent(type, filePath, score = 0) {
    const xp = type === 'Save' ? 5 : 50;
    const fileName = path.basename(filePath);
    console.log(`[XP EVENT] 🎮 ${type}! (+${xp}XP) - File: ${fileName} (Score: ${score})`);
    
    // UI側のステート更新
    updateState(type);
    sendLogToUI(type, fileName, xp);
    
    // システム通知
    showNotification(`XP Gained! (+${xp} XP)`, `Detected ${type} for ${fileName}`);

    // Firestoreへの書き込み
    if (!currentUser) return;

    try {
      // 1. 活動ログを追加
      await addDoc(collection(db, `users/${currentUser.uid}/activities`), {
        type,
        file: fileName,
        xp,
        timestamp: serverTimestamp()
      });

      // 2. ユーザーの累計XPとクエスト進捗を更新
      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(userDocRef, {
        totalXP: increment(xp),
        lastActivity: serverTimestamp(),
        quests: appState.quests
      }, { merge: true });
    } catch (e) {
      console.error("❌ Firestore Write Error:", e);
    }
  }

  if (watcher) watcher.close();

  watcher = chokidar.watch(WORK_DIR, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: false
  });

  console.log(`🚀 Tracker started in Electron. Watching: ${WORK_DIR}`);

  watcher.on('change', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (SAVE_EXTS.includes(ext)) {
          if (saveTimers.has(filePath)) {
              clearTimeout(saveTimers.get(filePath));
          }
          const timer = setTimeout(() => {
              handleXPEvent('Save', filePath);
              saveTimers.delete(filePath);
          }, 3000);
          saveTimers.set(filePath, timer);
      }
  });

  watcher.on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath);
      
      if (basename.startsWith('~') || basename.startsWith('.') || ext === '.tmp' || ext === '.crdownload') return;
      if (pendingExports.has(filePath)) return;
      
      pendingExports.add(filePath);
      
      let score = 2;
      if (VIDEO_EXTS.includes(ext)) score += 2;

      let initialSize = 0;
      try { initialSize = fs.statSync(filePath).size; } catch (e) {}

      let sizeIncreasing = false;
      let sizeChangedCount = 0;
      let writeDuration = 0;
      const checkInterval = 1000;
      const maxDuration = 5000;

      const intervalId = setInterval(() => {
          try {
              const stats = fs.statSync(filePath);
              if (stats.size > initialSize) {
                  sizeIncreasing = true;
                  sizeChangedCount++;
              }
              initialSize = stats.size;
          } catch (e) {
              clearInterval(intervalId);
              pendingExports.delete(filePath);
              return;
          }

          writeDuration += checkInterval;

          if (writeDuration >= maxDuration) {
              clearInterval(intervalId);
              evaluateExport();
          }
      }, checkInterval);

      function evaluateExport() {
          if (sizeIncreasing) score += 3;
          if (sizeChangedCount >= 2) score += 2;
          try {
              if (fs.statSync(filePath).size >= 1024 * 1024) score += 1;
          } catch (e) {}

          if (score >= 5) {
              handleXPEvent('Export', filePath, score);
          }
          pendingExports.delete(filePath);
      }
  });
}

// ----------------------------------------------------
// App Lifecycle
// ----------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  // Auth状態の監視
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('auth-state-changed', user ? { uid: user.uid, email: user.email } : null);
    }

    if (user) {
      console.log(`✅ Logged in as: ${user.email}`);
      startTracker();
      syncFromFirestore();
    } else {
      console.log(`⚠️ Logged out.`);
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      appState = { xp: 0, level: 0, quests: { saves: 0, exports: 0 } };
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('update-state', appState);
      }
    }
  });

  // 自動ログインの試行
  const savedConfig = loadConfig();
  if (savedConfig) {
    let email = savedConfig.email;
    let password = null;

    if (savedConfig.encryptedPassword) {
      try {
        password = decrypt(savedConfig.encryptedPassword);
      } catch (e) {
        console.error("⚠️ Failed to decrypt saved password:", e);
      }
    } else if (savedConfig.password) {
      // 移行パス: 平文パスワードが存在する場合、暗号化し直して保存
      password = savedConfig.password;
      try {
        const encrypted = encrypt(password);
        saveConfig({ email, encryptedPassword: encrypted });
        console.log("🔒 Password migrated to encrypted format.");
      } catch (e) {
        console.error("⚠️ Failed to migrate password to encrypted format:", e);
      }
    }

    if (email && password) {
      console.log("🔄 Attempting Auto Login...");
      signInWithEmailAndPassword(auth, email, password).catch((e) => {
        console.warn("⚠️ Auto login failed:", e.message);
      });
    }
  }

  // トレイアイコンの設定
  try {
    const { nativeImage } = require('electron');
    // 絶対に失敗しないようにBase64で画像データを直接埋め込む
    const iconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAcUlEQVRYhe3XQQqAIBBF0e+m3P9mtWmRJtAigvI/eDB4w5hE5F2A9oYwN1LKoLUWgIiYhB143/sYYz0XwBnH8QYwN/L/B06wE2wEW0F0sB1EAaKB1cACoIElQAPrgSVAA+uBJUAD28EWmP63gBMMO/AChwQ2zQ9mEGEAAAAASUVORK5CYII=';
    const trayIcon = nativeImage.createFromDataURL(iconBase64);
    
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Dashboard', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('CreateXP Tracker');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
  } catch (e) {
    console.error('❌ Failed to create tray:', e);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
