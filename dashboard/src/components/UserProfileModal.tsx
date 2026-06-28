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
          className="stat-card p-1 w-full max-w-md relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="win95-titlebar mb-1 bg-gradient-to-r from-blue-800 to-blue-600">
            <span className="flex items-center gap-2">UserProfile.exe</span>
            <button
              onClick={onClose}
              className="win95-btn py-0 px-2 ml-auto text-black border-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="win95-inset bg-gray-100 px-6 pb-6 pt-10 relative">
            {/* プロフィールアイコン */}
            <div className="flex justify-between items-end mb-4">
              <div className="w-24 h-24 win95-inset bg-white p-1">
                <div className="w-full h-full border-2 border-gray-300 flex items-center justify-center bg-gray-200">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {user.socialInstagram && (
                  <a href={user.socialInstagram} target="_blank" rel="noopener noreferrer" className="win95-btn">
                    <InstagramIcon className="w-5 h-5 text-pink-500" />
                  </a>
                )}
                {user.socialX && (
                  <a href={user.socialX} target="_blank" rel="noopener noreferrer" className="win95-btn">
                    <XIcon className="w-5 h-5 text-blue-500" />
                  </a>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-baseline gap-1 font-[Tahoma]">
                {user.displayName.split('#')[0]}
                <span className="text-sm font-bold text-gray-500 ml-1">#{user.displayName.split('#')[1]}</span>
              </h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="win95-inset bg-white p-4 flex flex-col items-center justify-center">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Level</div>
                <div className="text-4xl font-black text-blue-700">
                  {level}
                </div>
              </div>
              <div className="win95-inset bg-white p-4 flex flex-col items-center justify-center">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total XP</div>
                <div className="text-3xl font-black text-green-700">
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
              <div className="win95-titlebar mb-1 bg-gradient-to-r from-gray-600 to-gray-400">
                <span className="text-xs">Recent_Quests.log</span>
              </div>

              <div className="win95-inset-black p-4 h-48 overflow-y-auto">
                {user.hideActivity ? (
                  <div className="text-center py-6 text-gray-500 font-bold font-mono">
                    C:\&gt; Access Denied (Private Profile)
                  </div>
                ) : isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-1 font-mono text-sm text-green-400">
                    {activities.map(activity => (
                      <div key={activity.id} className="flex gap-4">
                        <span className="text-gray-500">[{activity.time.split(' ')[1] || activity.time}]</span>
                        <span className="text-cyan-400">{activity.type.padEnd(6, ' ')}</span>
                        <span className="flex-grow text-white truncate">{activity.file}</span>
                        <span className="text-yellow-400">+{activity.xp} XP</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 font-bold font-mono">
                    C:\&gt; No recent quests found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
