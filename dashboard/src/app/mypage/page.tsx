"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Save, FileVideo, Award, Settings, User, Upload, Check } from "lucide-react";
import { InstagramIcon, XIcon } from "@/components/SocialIcons";
import { db, auth, storage } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, setDoc, increment, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ACHIEVEMENTS, UserStats } from "@/lib/achievements";
import TransparentImage from "@/components/TransparentImage";

// ログアイテムの型定義
interface ActivityLog {
  id: string;
  type: "Save" | "Export";
  file: string;
  xp: number;
  time: string;
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");

  // Profile States
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [editName, setEditName] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialX, setSocialX] = useState("");
  const [hideActivity, setHideActivity] = useState(false);
  const [hideFromRanking, setHideFromRanking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [xp, setXp] = useState(0);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [activityCount, setActivityCount] = useState(0);
  const [hasAutoChecked, setHasAutoChecked] = useState(false); // 初回自動判定フラグ

  // Auth状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 初回ロード時の「過去のXP遡及」自動実績解除チェック
  useEffect(() => {
    // ユーザー未ログイン、または既にチェック済みなら何もしない
    if (!user || hasAutoChecked || isAuthLoading) return;

    // XPが0の場合はまだデータがロードされていない可能性があるので少し待つ
    // ただし、本当に0の新規ユーザーもいるため、タイマーで遅延実行する
    const timer = setTimeout(async () => {
      const currentStats: UserStats = {
        totalXP: xp,
        activityCount: activityCount,
      };

      const newUnlocks = ACHIEVEMENTS.filter(a => 
        !unlockedAchievements.includes(a.id) && a.checkUnlock(currentStats)
      );

      if (newUnlocks.length > 0) {
        try {
          const newIds = newUnlocks.map(a => a.id);
          const updatedAchievements = [...unlockedAchievements, ...newIds];
          
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            achievements: updatedAchievements,
          });
          
          setUnlockedAchievements(updatedAchievements);
          setSaveMessage(`🎉 Auto-Unlocked ${newUnlocks.length} Past Achievements!`);
          setTimeout(() => setSaveMessage(""), 6000);
        } catch (e) {
          console.error("Auto unlock failed:", e);
        }
      }
      setHasAutoChecked(true); // 1回だけ実行
    }, 2000); // データロード待ちとして2秒後に判定

    return () => clearTimeout(timer);
  }, [user, xp, activityCount, unlockedAchievements, hasAutoChecked, isAuthLoading]);

  // Firestoreからリアルタイムにデータを取得
  useEffect(() => {
    if (!user) {
      setXp(0);
      setRecentLogs([]);
      return;
    }

    // ユーザーデータの監視
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setXp(data.totalXP || 0);
        if (data.displayName) {
          setDisplayName(data.displayName);
          // # の前の部分だけを編集用にセット
          setEditName(data.displayName.split('#')[0]);
        }
        if (data.photoURL) {
          setPhotoURL(data.photoURL);
        }
        if (data.socialInstagram !== undefined) setSocialInstagram(data.socialInstagram);
        if (data.socialX !== undefined) setSocialX(data.socialX);
        if (data.hideActivity !== undefined) setHideActivity(data.hideActivity);
        if (data.hideFromRanking !== undefined) setHideFromRanking(data.hideFromRanking);
        if (data.achievements) setUnlockedAchievements(data.achievements);
        if (data.activityCount !== undefined) setActivityCount(data.activityCount);
      } else {
        setXp(0);
      }
    });

    // アクティビティログの監視
    const q = query(collection(db, `users/${user.uid}/activities`), orderBy("timestamp", "desc"), limit(5));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        time: d.data().timestamp?.toDate().toLocaleTimeString() || "Just now"
      })) as ActivityLog[];
      setRecentLogs(logs);
    });

    return () => {
      unsubscribeUser();
      unsubscribeLogs();
    };
  }, [user]);

  // レベルとXPバーの進捗は派生値として計算
  const level = useMemo(() => Math.floor(xp / 100), [xp]);
  const progressPercentage = useMemo(() => ((xp % 100) / 100) * 100, [xp]);
  const xpToNextLevel = useMemo(() => (level + 1) * 100 - xp, [level, xp]);

  // 設定の保存処理
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveMessage("");

    try {
      const userDocRef = doc(db, "users", user.uid);
      
      // タグ（#1234）を維持して名前を更新
      const currentTag = displayName.includes('#') ? displayName.split('#')[1] : Math.floor(1000 + Math.random() * 9000).toString();
      const newFullName = `${editName.trim()}#${currentTag}`;

      await updateDoc(userDocRef, {
        displayName: newFullName,
        socialInstagram,
        socialX,
        hideActivity,
        hideFromRanking
      });

      setSaveMessage("Profile updated successfully!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setSaveMessage("Failed to update profile.");
    }
    setIsSaving(false);
  };

  // 画像アップロード処理
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // 3MB (3 * 1024 * 1024 bytes) のサイズ制限
    if (file.size > 3 * 1024 * 1024) {
      setSaveMessage("Image is too large! Please use an image under 3MB.");
      return;
    }
    
    setIsSaving(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { photoURL: downloadURL });
      
      setSaveMessage("Icon updated!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error uploading image:", error);
      setSaveMessage("Failed to upload image.");
    }
    setIsSaving(false);
  };

  // テスト用のXP追加関数（Firestoreに実際に書き込む）
  const simulateAction = useCallback(async (type: "Save" | "Export") => {
    if (!user) return;
    const gainedXp = type === "Save" ? 5 : 50;
    const fileName = type === "Save" ? "Test_Design.psd" : "Final_Render.mp4";

    try {
      // 1. 活動ログを追加
      await addDoc(collection(db, `users/${user.uid}/activities`), {
        type,
        file: fileName,
        xp: gainedXp,
        timestamp: serverTimestamp()
      });

      // 2. ユーザーの累計XPとアクティビティ回数を更新
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        totalXP: increment(gainedXp),
        activityCount: increment(1),
        lastActivity: serverTimestamp()
      }, { merge: true });

      // 3. 実績のアンロック判定
      const currentStats: UserStats = {
        totalXP: xp + gainedXp,
        activityCount: activityCount + 1,
      };

      const newUnlocks = ACHIEVEMENTS.filter(a => 
        !unlockedAchievements.includes(a.id) && a.checkUnlock(currentStats)
      );

      if (newUnlocks.length > 0) {
        const newIds = newUnlocks.map(a => a.id);
        const updatedAchievements = [...unlockedAchievements, ...newIds];
        await updateDoc(userDocRef, {
          achievements: updatedAchievements,
        });
        setUnlockedAchievements(updatedAchievements);
        
        setSaveMessage(`🏆 Unlocked: ${newUnlocks.map(a => a.title).join(", ")}!`);
        setTimeout(() => setSaveMessage(""), 5000);
      }
    } catch (e) {
      console.error("Simulation failed:", e);
    }
  }, [user, xp, activityCount, unlockedAchievements]);

  // 未ログインアクセスの保護
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/");
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen">
      {/* ヒーローバナー領域 (Tracker.gg風) */}
      <div className="w-full h-48 bg-gray-900 relative overflow-hidden flex items-end px-8 max-w-7xl mx-auto rounded-b-3xl">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-neon-blue via-gray-900 to-neon-pink"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        {/* プロフィール情報（バナーと重なる） */}
        <div className="relative z-10 flex items-end gap-6 translate-y-8">
          <div className="w-32 h-32 win95-inset bg-gray-200 p-1">
            <div className="w-full h-full bg-gray-200 flex items-center justify-center border-2 border-white">
              {photoURL ? (
                <img src={photoURL} alt="Avatar" className="w-full h-full object-cover win95-inset" />
              ) : (
                <User className="w-16 h-16 text-gray-400" />
              )}
            </div>
          </div>
          <div className="pb-8">
            <h1 className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
              {displayName.split('#')[0]}
              <span className="text-xl font-bold text-gray-400">#{displayName.split('#')[1]}</span>
            </h1>
            <div className="flex gap-2 mt-2">
              {socialInstagram && (
                <a href={socialInstagram} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-gray-800/80 hover:bg-pink-500 transition-colors text-white">
                  <InstagramIcon className="w-4 h-4" />
                </a>
              )}
              {socialX && (
                <a href={socialX} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-gray-800/80 hover:bg-blue-500 transition-colors text-white">
                  <XIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-16 pb-12">
        <div className="flex gap-2 mb-8 border-b-2 border-gray-200 pb-px">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors relative ${activeTab === "overview" ? "text-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-t-lg"}`}
          >
            <Zap className="w-5 h-5" />
            Overview
            {activeTab === "overview" && <motion.div layoutId="tabIndicator" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-neon-blue" />}
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors relative ${activeTab === "settings" ? "text-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-t-lg"}`}
          >
            <Settings className="w-5 h-5" />
            Settings
            {activeTab === "settings" && <motion.div layoutId="tabIndicator" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-neon-pink" />}
          </button>
        </div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* レベル・XP表示エリア (左カラム) */}
            <div className="space-y-6">
              <section className="stat-card p-1">
                <div className="win95-titlebar mb-1 bg-gradient-to-r from-blue-800 to-blue-600">
                  <span>Status.exe</span>
                </div>
                <div className="win95-inset bg-white p-6 relative overflow-hidden">
                  
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Current Level</h3>
                  <div className="flex flex-col mb-6">
                    <motion.div
                      key={level}
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="text-7xl font-black text-gray-900 leading-none font-[Tahoma]"
                    >
                      {level}
                    </motion.div>
                  </div>

                  <div className="mb-2 flex justify-between text-sm font-bold text-gray-600">
                    <span>{xp.toLocaleString()} XP</span>
                    <span className="text-gray-400">{(level + 1) * 100} XP</span>
                  </div>
                  
                  {/* Progress Bar (Win95 style) */}
                  <div className="h-6 w-full win95-inset bg-white p-0.5 flex">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const blockPercentage = (i + 1) * 5;
                      const isActive = progressPercentage >= blockPercentage;
                      return (
                        <div 
                          key={i} 
                          className={`h-full flex-1 mr-0.5 ${isActive ? 'bg-[#000080]' : 'bg-transparent'}`}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-bold text-gray-500 text-right">{xpToNextLevel} XP to Next Level</p>
                </div>
              </section>

              {/* テスト用コントロール */}
              <section className="stat-card p-6">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap className="text-yellow-400 w-4 h-4" />
                  Dev Simulation
                </h2>
                <div className="flex flex-col gap-3">
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => simulateAction("Save")}
                    className="win95-btn flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2 text-black"><Save className="w-4 h-4 text-blue-800" /> Save</span>
                    <span className="font-black text-blue-800 text-xs">+5 XP</span>
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => simulateAction("Export")}
                    className="win95-btn flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2 text-black"><FileVideo className="w-4 h-4 text-pink-800" /> Export</span>
                    <span className="font-black text-pink-800 text-xs">+50 XP</span>
                  </motion.button>
                </div>
              </section>
            </div>

            {/* アクティビティログ (右カラム) */}
            <div className="md:col-span-2 space-y-4">
              <div className="stat-card p-1">
                <div className="win95-titlebar mb-1 bg-gradient-to-r from-gray-600 to-gray-400">
                  <span>Recent_Quests.log</span>
                </div>
                <div className="win95-inset-black p-4 min-h-[300px] overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {recentLogs.map((log) => (
                      <motion.div 
                        key={log.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="flex gap-4 font-mono text-sm text-green-400 mb-1"
                      >
                        <span className="text-gray-500">[{log.time}]</span>
                        <span className="text-cyan-400">{log.type.padEnd(6, ' ')}</span>
                        <span className="flex-grow text-white truncate">{log.file}</span>
                        <span className="text-yellow-400">+{log.xp} XP</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {recentLogs.length === 0 && (
                    <div className="text-center text-gray-500 font-mono py-8">
                      C:\&gt; No recent quests found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Achievements (ドット絵風) */}
            <div className="md:col-span-3 mt-4 mb-8">
              <div className="stat-card p-6 bg-gray-900 border-gray-800">
                <h2 className="text-xl font-pixel text-white flex items-center gap-3 mb-6">
                  <span className="text-2xl">🏆</span>
                  UNLOCKED ACHIEVEMENTS
                </h2>
                
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  {ACHIEVEMENTS.map(ach => {
                    const isUnlocked = unlockedAchievements.includes(ach.id);
                    return (
                      <div 
                        key={ach.id} 
                        title={isUnlocked ? `${ach.title} : ${ach.description}` : "Locked"}
                        className={`group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 ${isUnlocked ? ach.colorClass + ' pixel-slot text-white' : 'bg-gray-800 pixel-slot opacity-60'} cursor-help`}
                      >
                        {isUnlocked ? (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center relative z-10">
                            <TransparentImage 
                              src={ach.pixelIconUrl} 
                              alt={ach.title} 
                              className="w-full h-full object-contain" 
                              style={{ filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.6))', imageRendering: 'pixelated' }}
                            />
                          </div>
                        ) : (
                          <div className="text-xl font-pixel text-gray-900 relative z-10 drop-shadow-sm">?</div>
                        )}
                        
                        {/* ツールチップ（PCホバー用） */}
                        {isUnlocked && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 pixel-border-sm text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                            <div className="font-pixel text-yellow-400 mb-1">{ach.title}</div>
                            <div className="font-bold text-gray-300">{ach.description}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 text-right">
                  <span className="font-pixel text-gray-400 text-sm">
                    COMPLETED: {unlockedAchievements.length} / {ACHIEVEMENTS.length}
                  </span>
                </div>
              </div>
            </div>

          </motion.div>
        ) : (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="stat-card p-1 max-w-2xl mx-auto w-full relative"
          >
            <div className="win95-titlebar mb-1 bg-gradient-to-r from-blue-800 to-blue-600">
              <span className="flex items-center gap-2">Settings.exe</span>
            </div>

            <div className="win95-inset bg-white p-6 space-y-8">
              {/* アイコン変更 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-4 uppercase tracking-wider">User Avatar</label>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {photoURL ? (
                      <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="win95-btn"
                    >
                      <Upload className="w-4 h-4 text-blue-600" />
                      Upload Image
                    </button>
                    <p className="text-xs font-bold text-gray-500 mt-2">Max 3MB. Recommended: 256x256px JPG/PNG.</p>
                  </div>
                </div>
              </div>

              {/* ユーザー名変更 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider">Creator Name</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-grow bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neon-pink focus:bg-white transition-colors font-bold text-lg text-gray-900"
                  />
                  <div className="flex items-center justify-center px-4 bg-gray-100 border-2 border-gray-200 rounded-xl font-mono font-bold text-gray-500">
                    #{displayName.split('#')[1] || "0000"}
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-400 mt-2">※タグ（#の後の数字）は自動割り当てのため変更できません。</p>
              </div>

              {/* SNSリンク */}
              <div className="space-y-4 pt-6 border-t-2 border-gray-100">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Social Links</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0 border-2 border-pink-100">
                    <InstagramIcon className="w-6 h-6 text-pink-500" />
                  </div>
                  <input 
                    type="url" 
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="https://instagram.com/yourname"
                    className="flex-grow bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-500 focus:bg-white transition-colors text-sm font-bold text-gray-900"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border-2 border-blue-100">
                    <XIcon className="w-6 h-6 text-blue-500" />
                  </div>
                  <input 
                    type="url" 
                    value={socialX}
                    onChange={(e) => setSocialX(e.target.value)}
                    placeholder="https://x.com/yourname"
                    className="flex-grow bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-sm font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* プライバシー設定 */}
              <div className="space-y-6 pt-6 border-t-2 border-gray-100">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Privacy Settings</h3>
                
                <label className="flex items-center justify-between cursor-pointer group bg-gray-50 p-4 rounded-xl border-2 border-transparent hover:border-gray-200 transition-colors">
                  <div>
                    <div className="font-black text-gray-900 mb-1">Make Activity Private</div>
                    <div className="text-xs font-bold text-gray-500">他のユーザーに最近のクエスト（保存・書き出し）を非公開にします。</div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={hideActivity} onChange={(e) => setHideActivity(e.target.checked)} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${hideActivity ? 'bg-neon-pink' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-sm transition-transform ${hideActivity ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group bg-gray-50 p-4 rounded-xl border-2 border-transparent hover:border-gray-200 transition-colors">
                  <div>
                    <div className="font-black text-gray-900 mb-1">Hide from Ranking</div>
                    <div className="text-xs font-bold text-gray-500">ランキング一覧から自分の名前とステータスを完全に隠します。</div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={hideFromRanking} onChange={(e) => setHideFromRanking(e.target.checked)} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${hideFromRanking ? 'bg-neon-pink' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-sm transition-transform ${hideFromRanking ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>

              <div className="pt-6 border-t-2 border-gray-300 flex items-center justify-between">
                <div className="text-blue-800 font-bold text-sm">
                  {saveMessage}
                </div>
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving || !editName.trim()}
                  className="win95-btn"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <><Check className="w-4 h-4 text-green-600"/> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </main>
  );
}
