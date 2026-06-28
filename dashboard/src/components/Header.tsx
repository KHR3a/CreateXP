"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, User, Trophy, LayoutDashboard } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import LoginModal from "./LoginModal";

export default function Header() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let unsubscribeFirestore: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // displayNameとphotoURLをリアルタイム監視
        const docRef = doc(db, "users", currentUser.uid);
        unsubscribeFirestore = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDisplayName(data.displayName || "Creator");
            setPhotoURL(data.photoURL || "");
          } else {
            setDisplayName("Creator");
            setPhotoURL("");
          }
        });
      } else {
        setDisplayName("");
        setPhotoURL("");
        if (unsubscribeFirestore) unsubscribeFirestore();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b-2 border-white/50">
        <div className="flex justify-between items-center py-4 px-8 max-w-7xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Trophy className="w-8 h-8 text-neon-blue drop-shadow-sm" />
            <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: "'Tahoma', sans-serif" }}>
              <span className="text-red-500">C</span>
              <span className="text-blue-500">r</span>
              <span className="text-green-500">e</span>
              <span className="text-yellow-500">a</span>
              <span className="text-red-500">t</span>
              <span className="text-blue-500">e</span>
              <span className="text-orange-500 italic ml-0.5" style={{ fontFamily: "serif" }}>XP</span>
            </h1>
          </Link>

          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/KHR3a/CreateXP/releases" 
              target="_blank" 
              rel="noopener noreferrer"
              className="win95-btn mr-2"
              title="Download Desktop Tracker"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </a>

          {user ? (
            <>
              <Link 
                href="/mypage"
                className={`flex items-center gap-2 px-4 py-2 rounded-none transition-colors font-bold ${
                  pathname === "/mypage" 
                    ? "win95-inset text-gray-900" 
                    : "win95-btn text-gray-800"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">My Page</span>
              </Link>
              
              <div className="flex items-center gap-3 pl-4 border-l-2 border-gray-400">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-8 h-8 rounded-none object-cover border-2 border-gray-400 win95-inset" />
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 win95-inset bg-gray-200 text-gray-500 font-bold">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden md:block">
                  <div className="text-sm font-bold text-gray-900 font-[Tahoma]">{displayName.split('#')[0]}</div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="win95-btn"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="win95-btn"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}
          </div>
        </div>
      </header>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </>
  );
}
