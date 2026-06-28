import { Trophy, Star, Target, Zap, Clock, Flame, Crown, Shield, Coffee, Medal, Rocket } from "lucide-react";

export interface UserStats {
  totalXP: number;
  activityCount?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  pixelIconUrl: string; // ドット絵SVGのURL
  colorClass: string; // Tailwind bg color
  checkUnlock: (stats: UserStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_step",
    title: "はじまりの一歩",
    description: "記念すべき最初のXPを獲得する",
    pixelIconUrl: "/achievements/star.png",
    colorClass: "bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700",
    checkUnlock: (stats) => stats.totalXP > 0,
  },
  {
    id: "amateur_creator",
    title: "アマチュアクリエイター",
    description: "Lv10に到達する",
    pixelIconUrl: "/achievements/bronze.png",
    colorClass: "bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700",
    checkUnlock: (stats) => Math.floor(stats.totalXP / 100) >= 10,
  },
  {
    id: "middle_creator",
    title: "中堅クリエイター",
    description: "Lv50に到達する",
    pixelIconUrl: "/achievements/shield.png",
    colorClass: "bg-gradient-to-br from-gray-300 via-gray-400 to-gray-600",
    checkUnlock: (stats) => Math.floor(stats.totalXP / 100) >= 50,
  },
  {
    id: "veteran_creator",
    title: "ベテランの風格",
    description: "Lv100に到達する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/flag.svg",
    colorClass: "bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600",
    checkUnlock: (stats) => Math.floor(stats.totalXP / 100) >= 100,
  },
  {
    id: "pro_creator",
    title: "プロフェッショナル",
    description: "Lv250に到達する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/crown.svg",
    colorClass: "bg-gradient-to-br from-pink-400 via-pink-500 to-purple-600",
    checkUnlock: (stats) => Math.floor(stats.totalXP / 100) >= 250,
  },
  {
    id: "xp_1k",
    title: "ちりつもXP",
    description: "累計1,000 XPを獲得する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/zap.svg",
    colorClass: "bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700",
    checkUnlock: (stats) => stats.totalXP >= 1000,
  },
  {
    id: "xp_10k",
    title: "万越えの壁",
    description: "累計10,000 XPを獲得する",
    pixelIconUrl: "/achievements/heart.png",
    colorClass: "bg-gradient-to-br from-red-400 via-red-500 to-red-700",
    checkUnlock: (stats) => stats.totalXP >= 10000,
  },
  {
    id: "xp_100k",
    title: "プラチナクラス",
    description: "累計100,000 XPを獲得する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/trophy.svg",
    colorClass: "bg-gradient-to-br from-cyan-300 via-cyan-500 to-blue-600",
    checkUnlock: (stats) => stats.totalXP >= 100000,
  },
  {
    id: "activity_first",
    title: "トラッカー起動",
    description: "初めての活動（クエスト）を記録する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/clock.svg",
    colorClass: "bg-gradient-to-br from-green-300 via-green-500 to-green-700",
    checkUnlock: (stats) => (stats.activityCount || 0) >= 1,
  },
  {
    id: "activity_10",
    title: "ルーティンワーカー",
    description: "累計10回の活動（クエスト）を記録する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/coffee.svg",
    colorClass: "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800",
    checkUnlock: (stats) => (stats.activityCount || 0) >= 10,
  },
  {
    id: "activity_100",
    title: "クリエイティブ中毒",
    description: "累計100回の活動（クエスト）を記録する",
    pixelIconUrl: "https://unpkg.com/pixelarticons@1.8.1/svg/image.svg",
    colorClass: "bg-gradient-to-br from-purple-400 via-purple-500 to-purple-700",
    checkUnlock: (stats) => (stats.activityCount || 0) >= 100,
  }
];
