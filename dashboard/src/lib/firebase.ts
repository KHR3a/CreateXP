// Firebase設定
// .env.local にAPIキーを設定してね！
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// ブラウザ環境（クライアントサイド）でのみFirebaseを初期化する
// サーバーサイド(Edgeランタイム)で初期化するとAPI不足でクラッシュ(500エラー)するため
const isBrowser = typeof window !== 'undefined';

let _app: FirebaseApp;
let _db: Firestore;
let _auth: Auth;
let _storage: FirebaseStorage;

if (firebaseConfig.apiKey && isBrowser) {
  // 多重初期化を防止するガード
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  _db = getFirestore(_app);
  _auth = getAuth(_app);
  _storage = getStorage(_app);
} else {
  // サーバーサイドSSRおよびビルド時のプリレンダリング用ダミー
  _app = {} as FirebaseApp;
  _db = {} as Firestore;
  _auth = {} as Auth;
  _storage = {} as FirebaseStorage;
}

// 既存コードとの互換性を保つためにそのままexport
const app = _app;
const db = _db;
const auth = _auth;
const storage = _storage;

export { app, db, auth, storage };

