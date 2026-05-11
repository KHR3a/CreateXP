"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 4桁のランダム数字を生成
  const generateTag = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        onClose(); // 成功したら閉じる
      } else {
        if (!username.trim()) throw new Error("Please enter a username");
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // ユーザー名#1234 を生成
        const tag = generateTag();
        const fullUsername = `${username.trim()}#${tag}`;

        // Firestoreにユーザー情報を初期化
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          displayName: fullUsername,
          photoURL: "",
          hideActivity: false,
          hideFromRanking: false,
          totalXP: 0,
          lastActivity: serverTimestamp()
        }, { merge: true });

        onClose(); // 成功したら閉じる
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="stat-card p-8 w-full max-w-md relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-pink opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            
            <h2 className="text-3xl font-black text-center mb-8 pop-gradient-text">
              {isLoginMode ? "Welcome Back" : "Join CreateXP"}
            </h2>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLoginMode && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Creator Name</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={!isLoginMode}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue focus:bg-white transition-colors text-gray-900 font-medium"
                    placeholder="Your Name (e.g., PixelArtist)"
                  />
                  <p className="text-xs text-gray-500 mt-1 font-medium">※自動で #4桁の数字 が付与されます</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue focus:bg-white transition-colors text-gray-900 font-medium"
                  placeholder="creator@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue focus:bg-white transition-colors text-gray-900 font-medium"
                  placeholder="••••••••"
                />
              </div>
              
              {authError && <div className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg">{authError}</div>}
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-4 rounded-xl font-bold bg-gradient-to-r from-neon-blue to-neon-pink text-white hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isLoginMode ? (
                  <><LogIn className="w-5 h-5"/> Log In</>
                ) : (
                  <><UserPlus className="w-5 h-5"/> Sign Up</>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
              {isLoginMode ? "Don't have an account?" : "Already have an account?"}{" "}
              <button 
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setAuthError("");
                }}
                className="text-neon-blue hover:underline font-bold"
              >
                {isLoginMode ? "Sign Up" : "Log In"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
