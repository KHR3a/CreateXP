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
            <h1 className="text-2xl font-black pop-gradient-text">
              CreateXP
            </h1>
          </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link 
                href="/mypage"
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-bold ${
                  pathname === "/mypage" 
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/80"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="hidden sm:inline">My Page</span>
              </Link>
              
              <div className="flex items-center gap-3 pl-4 border-l border-gray-300">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue to-neon-pink text-white font-bold shadow-sm border-2 border-white">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="hidden md:block">
                  <div className="text-sm font-black text-gray-800">{displayName.split('#')[0]}<span className="text-gray-400 font-normal text-xs ml-0.5">#{displayName.split('#')[1]}</span></div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 ml-2 text-gray-400 hover:text-neon-pink transition-colors rounded-full hover:bg-white hover:shadow-sm"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2 rounded-full font-bold bg-gradient-to-r from-neon-blue to-neon-pink text-white hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,242,255,0.3)]"
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
