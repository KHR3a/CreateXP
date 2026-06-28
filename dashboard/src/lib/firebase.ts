// Firebase設定
// .env.local にAPIキーを設定してね！
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// ビルド時（プリレンダリング時）にAPIキーが未定義の場合でもクラッシュしないようにガード
let app, db, auth, storage;

if (firebaseConfig.apiKey) {
  // 多重初期化を防止するガード
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
} else {
  // ビルド時のプリレンダリング用ダミー（実行時には環境変数が利用可能）
  console.warn('Firebase APIキーが未設定です。ビルド時のプリレンダリングではFirebase機能は無効です。');
  app = null as any;
  db = null as any;
  auth = null as any;
  storage = null as any;
}

export { app, db, auth, storage };
