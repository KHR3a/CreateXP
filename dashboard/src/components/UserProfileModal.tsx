"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Zap, Save, FileVideo, ShieldAlert, Award } from "lucide-react";
import { InstagramIcon, XIcon } from "@/components/SocialIcons";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { ACHIEVEMENTS } from "@/lib/achievements";
import TransparentImage from "@/components/TransparentImage";

interface RankedUser {
  id: string;
  displayName: string;
  photoURL: string;
  totalXP: number;
  hideActivity?: boolean;
  socialInstagram?: string;
  socialX?: string;
  achievements?: string[];
}

interface ActivityLog {
  id: string;
  type: string;
  file: string;
  xp: number;
  time: string;
}

interface UserProfileModalProps {
  user: RankedUser | null;
  onClose: () => void;
}

export default function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    if (user.hideActivity) {
      if (isMounted) setIsLoading(false);
      return;
    }

    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, `users/${user.id}/activities`),
          orderBy("timestamp", "desc"),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          return {
            id: doc.id,
            type: data.type,
            file: data.file,
            xp: data.xp,
            time: date.toLocaleString()
          };
        });
        setActivities(logs);
      } catch (error) {
        console.error("Failed to fetch user activities", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [user]);

  if (!user) return null;

  const level = Math.floor(user.totalXP / 100);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-white w-full max-w-md relative overflow-hidden rounded-3xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-black/20 rounded-full transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {/* トラッカー風ヘッダーバナー */}
          <div className="w-full h-32 bg-gray-900 relative">
            <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-neon-blue via-gray-900 to-neon-pink"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          </div>

          <div className="px-6 pb-6 relative">
            {/* プロフィールアイコン（バナーに重なる） */}
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg relative z-10">
                <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {user.socialInstagram && (
                  <a href={user.socialInstagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-pink-50 border-2 border-pink-100 hover:bg-pink-500 hover:text-white transition-colors text-pink-500">
                    <InstagramIcon className="w-5 h-5" />
                  </a>
                )}
                {user.socialX && (
                  <a href={user.socialX} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-blue-50 border-2 border-blue-100 hover:bg-blue-500 hover:text-white transition-colors text-blue-500">
                    <XIcon className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-baseline gap-1">
                {user.displayName.split('#')[0]}
                <span className="text-sm font-bold text-gray-400">#{user.displayName.split('#')[1]}</span>
              </h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-100 flex flex-col items-center justify-center">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Level</div>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-pink">
                  {level}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-100 flex flex-col items-center justify-center">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total XP</div>
                <div className="text-3xl font-black text-gray-900">
                  {user.totalXP.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Achievements */}
            {user.achievements && user.achievements.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2 border-b-2 border-gray-100 pb-2 font-pixel">
                  <span className="text-lg">🏆</span>
                  ACHIEVEMENTS
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ACHIEVEMENTS.filter(a => user.achievements!.includes(a.id)).map(ach => (
                    <div
                      key={ach.id}
                      title={`${ach.title} : ${ach.description}`}
                      className={`relative flex items-center justify-center w-12 h-12 ${ach.colorClass} pixel-slot text-white cursor-help`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center relative z-10">
                        <TransparentImage
                          src={ach.pixelIconUrl}
                          alt={ach.title}
                          className="w-full h-full object-contain"
                          style={{ filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.6))', imageRendering: 'pixelated' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 border-b-2 border-gray-100 pb-2">
                <Award className="w-4 h-4 text-neon-pink" />
                Recent Quests
              </h3>

              {user.hideActivity ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-gray-100 border-dashed text-gray-500 font-bold">
                  Private Profile
                </div>
              ) : isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map(activity => (
                    <div key={activity.id} className={`flex items-stretch overflow-hidden relative rounded-lg border-2 border-gray-100 ${activity.type === 'Save' ? 'bg-white' : 'bg-pink-50/50'}`}>
                      {/* 左端のカラーバー */}
                      <div className={`w-2 flex-shrink-0 ${activity.type === 'Save' ? 'bg-neon-blue' : 'bg-neon-pink'}`}></div>

                      <div className="p-3 flex flex-grow justify-between items-center">
                        <div className="overflow-hidden pr-2">
                          <div className="text-xs font-black text-gray-900 mb-0.5">{activity.type.toUpperCase()}</div>
                          <div className="text-xs font-bold text-gray-500 truncate">{activity.file}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-lg font-black ${activity.type === 'Save' ? 'text-neon-blue' : 'text-neon-pink'}`}>+{activity.xp}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-gray-100 border-dashed text-gray-500 font-bold">
                  No recent activity.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
