"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Medal, Star, User, Calendar, CalendarDays, Crown } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, query, orderBy, limit, onSnapshot, where, Timestamp } from "firebase/firestore";
import UserProfileModal from "@/components/UserProfileModal";

type Period = "total" | "monthly" | "weekly" | "daily";

interface RankedUser {
  id: string;
  displayName: string;
  photoURL: string;
  totalXP: number;
  periodXP?: number;
  hideFromRanking?: boolean;
  hideActivity?: boolean;
  socialInstagram?: string;
  socialX?: string;
  achievements?: string[];
}

export default function RankingPage() {
  const [allUsers, setAllUsers] = useState<RankedUser[]>([]);
  const [periodXpMap, setPeriodXpMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPeriodLoading, setIsPeriodLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RankedUser | null>(null);
  const [period, setPeriod] = useState<Period>("total");

  // 全ユーザーデータをリアルタイムで取得
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "users"), orderBy("totalXP", "desc"), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || "Unknown Creator",
        photoURL: doc.data().photoURL || "",
        totalXP: doc.data().totalXP || 0,
        hideFromRanking: doc.data().hideFromRanking || false,
        hideActivity: doc.data().hideActivity || false,
        socialInstagram: doc.data().socialInstagram || "",
        socialX: doc.data().socialX || "",
        achievements: doc.data().achievements || []
      })) as RankedUser[];
      
      setAllUsers(users);
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to fetch users:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 期間別のXP集計（Daily / Weekly / Monthly）
  useEffect(() => {
    if (period === "total") {
      setPeriodXpMap({});
      return;
    }

    if (allUsers.length === 0) return;

    setIsPeriodLoading(true);

    const now = new Date();
    const startDate = period === "daily"
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : period === "weekly"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activitiesQuery = query(
      collectionGroup(db, "activities"),
      where("timestamp", ">=", Timestamp.fromDate(startDate))
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const xpMap: Record<string, number> = {};
      snapshot.forEach(doc => {
        // doc.ref.path は 'users/{uid}/activities/{activityId}' の形式
        const pathSegments = doc.ref.path.split('/');
        const uid = pathSegments[1];
        if (uid) {
          xpMap[uid] = (xpMap[uid] || 0) + (doc.data().xp || 0);
        }
      });
      setPeriodXpMap(xpMap);
      setIsPeriodLoading(false);
    }, (error) => {
      console.error("Failed to fetch period activities:", error);
      setIsPeriodLoading(false);
    });

    return () => unsubscribe();
  }, [period, allUsers]);

  // 表示用のランキングデータ（フィルタリングとソート済み）
  const rankedUsers = useMemo(() => {
    const visible = allUsers.filter(u => !u.hideFromRanking);

    if (period === "total") {
      return visible.slice(0, 50);
    }

    // 期間別: periodXpMapのXPでソートし直す (0XPの人は除外し、同点ならTotalXPでソート)
    return visible
      .map(u => ({ ...u, periodXP: periodXpMap[u.id] || 0 }))
      .filter(u => u.periodXP! > 0)
      .sort((a, b) => {
        if (b.periodXP! !== a.periodXP!) {
          return b.periodXP! - a.periodXP!;
        }
        return b.totalXP - a.totalXP;
      })
      .slice(0, 50);
  }, [allUsers, period, periodXpMap]);

  // 表示するXP値（期間別 or 総合）
  const getDisplayXP = (user: RankedUser) => {
    if (period === "total") return user.totalXP;
    return user.periodXP ?? periodXpMap[user.id] ?? 0;
  };

  // 上位3人と4位以降を分離
  const topThree = rankedUsers.slice(0, 3);
  const restUsers = rankedUsers.slice(3);

  const getRankMedal = (index: number) => {
    switch (index) {
      case 0: return <Crown className="w-8 h-8 text-yellow-400 drop-shadow-md" />;
      case 1: return <Medal className="w-8 h-8 text-gray-400 drop-shadow-sm" />;
      case 2: return <Medal className="w-8 h-8 text-amber-600 drop-shadow-sm" />;
      default: return null;
    }
  };

  const periodLabels: Record<Period, string> = {
    total: "Total",
    monthly: "Monthly",
    weekly: "Weekly",
    daily: "Daily",
  };

  return (
    <main className="p-8 max-w-5xl mx-auto w-full">
      <div className="text-center mb-12 relative pt-8">
        <h1 className="text-5xl font-black mb-4 flex items-center justify-center gap-4 tracking-tight neon-text" style={{ fontFamily: "'Tahoma', sans-serif" }}>
          <Star className="w-10 h-10 text-cyan-400" />
          <span>
            GLOBAL RANKING
          </span>
          <Star className="w-10 h-10 text-cyan-400" />
        </h1>
        <p className="text-cyan-200 font-bold tracking-widest uppercase">Top Creators on the Cyber Grid</p>
      </div>

      {/* 期間切り替えタブ */}
      <div className="flex justify-center gap-1 mb-10 border-b-2 border-white pb-px">
        {(["total", "monthly", "weekly", "daily"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex items-center justify-center gap-2 px-6 py-2 font-bold font-[Tahoma] text-sm uppercase tracking-wider ${
              period === p
                ? "bg-[#c0c0c0] text-black border-t-2 border-l-2 border-white border-r-2 border-[#000000] border-b-0 z-10 -mb-[2px] pb-[4px]"
                : "bg-[#c0c0c0] text-black border-t-2 border-l-2 border-white border-r-2 border-b-2 border-[#000000] hover:bg-[#d0d0d0]"
            }`}
          >
            {p === "daily" && <Star className="w-4 h-4" />}
            {p === "weekly" && <CalendarDays className="w-4 h-4" />}
            {p === "monthly" && <Calendar className="w-4 h-4" />}
            {p === "total" && <Crown className="w-4 h-4" />}
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : isPeriodLoading ? (
        <div className="flex flex-col items-center mt-16 gap-4">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-bold text-sm">Loading {periodLabels[period]} ranking.exe...</p>
        </div>
      ) : (
        <div>
          {/* 上位3位: 大きめ表示 */}
          <div className="space-y-3 mb-6">
            <AnimatePresence mode="wait">
              <motion.div key={period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {topThree.map((user, index) => {
                  const displayXP = getDisplayXP(user);
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      onClick={() => setSelectedUser(user)}
                      className="stat-card p-1 cursor-pointer hover:-translate-y-1 transition-transform bg-gray-200"
                    >
                      <div className="win95-titlebar mb-3">
                        <div className="flex items-center gap-2">
                          {getRankMedal(index)}
                          <span>Rank #{index + 1}</span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 bg-gray-300 border border-white shadow-sm flex items-center justify-center text-[10px] text-black">_</div>
                          <div className="w-4 h-4 bg-gray-300 border border-white shadow-sm flex items-center justify-center text-[10px] text-black">□</div>
                          <div className="w-4 h-4 bg-gray-300 border border-white shadow-sm flex items-center justify-center text-[10px] text-black">×</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-6">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="Avatar" className="w-24 h-24 rounded-none object-cover border-2 border-gray-400 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
                          ) : (
                            <div className="w-24 h-24 rounded-none border-2 border-gray-400 bg-gray-200 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                              <User className="w-12 h-12 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="text-2xl font-black text-gray-900 tracking-tight font-[Tahoma]">
                              {user.displayName.split('#')[0]}
                              <span className="text-sm font-bold text-gray-500 ml-1">#{user.displayName.split('#')[1]}</span>
                            </div>
                            <div className="text-sm font-bold text-blue-800 mt-1">Status: Active</div>
                          </div>
                        </div>
                        
                        <div className="text-right win95-inset p-3 bg-white">
                          {period === "total" ? (
                            <>
                              <div className="text-5xl font-black text-blue-700 leading-none tracking-tighter flex items-baseline justify-end gap-1">
                                <span className="text-2xl text-gray-500 tracking-normal mr-1">Lv.</span>{Math.floor(user.totalXP / 100)}
                                {Math.floor(user.totalXP / 100) >= 500 && <Crown className="w-6 h-6 text-yellow-500" />}
                              </div>
                              <div className="text-sm font-bold text-gray-500 mt-1">Total: {displayXP.toLocaleString()} XP</div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{periodLabels[period]} XP</div>
                              <div className="text-4xl font-black text-green-600 leading-none tracking-tighter flex items-center justify-end gap-1">
                                {displayXP.toLocaleString()} <span className="text-lg">XP</span>
                              </div>
                              <div className="text-sm font-bold text-gray-500 mt-1">Lv.{Math.floor(user.totalXP / 100)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="stat-card overflow-hidden mt-8 p-1">
            <div className="win95-titlebar mb-1">
              <span>Other Creators.exe</span>
            </div>
            <div className="win95-inset bg-white p-1">
            {restUsers.map((user, index) => {
              const rank = index + 4;
              const displayXP = getDisplayXP(user);
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.03 }}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-[#000080] hover:text-white transition-colors border-b border-gray-200 last:border-0 group"
                >
                  <div className="flex items-center gap-4 w-1/2">
                    <span className="text-lg font-black text-gray-400 group-hover:text-gray-300 w-8 text-center">{rank}</span>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-none object-cover border border-gray-400 group-hover:border-white" />
                    ) : (
                      <div className="w-8 h-8 rounded-none border border-gray-400 bg-gray-200 flex items-center justify-center group-hover:border-white">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="text-base font-bold truncate font-[Tahoma]">
                      {user.displayName.split('#')[0]}
                      <span className="font-normal text-gray-400 group-hover:text-gray-300 ml-1 text-sm">#{user.displayName.split('#')[1]}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 w-1/2 justify-end">
                    {period === "total" ? (
                      <>
                        <div className="text-sm font-bold text-gray-500 group-hover:text-gray-300 hidden sm:block">{displayXP.toLocaleString()} XP</div>
                        <div className="text-2xl font-black leading-none w-20 text-right flex items-center justify-end gap-1">
                          {Math.floor(user.totalXP / 100)}
                          {Math.floor(user.totalXP / 100) >= 500 && <Crown className="w-4 h-4 text-yellow-500 group-hover:text-yellow-300" />}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-gray-500 group-hover:text-gray-300 hidden sm:block">Lv.{Math.floor(user.totalXP / 100)}</div>
                        <div className="text-xl font-black leading-none text-right flex items-center justify-end gap-1">
                          {displayXP.toLocaleString()} XP
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div>
          </div>
          
          {rankedUsers.length === 0 && (
            <div className="text-center text-gray-500 py-12 stat-card mt-6 font-bold">
              {period === "total" 
                ? "No creators found yet. Be the first to earn XP!" 
                : `No activity found for this ${period === "weekly" ? "week" : "month"}.`}
            </div>
          )}
        </div>
      )}

      {selectedUser && (
        <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </main>
  );
}
