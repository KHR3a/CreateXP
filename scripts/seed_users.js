// テスト用ユーザーをFirestoreに追加するスクリプト
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'tracker', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const testUsers = [
  { id: 'test_user_01', name: 'test_user01', xp: 2500 },
  { id: 'test_user_02', name: 'test_user02', xp: 1800 },
  { id: 'test_user_03', name: 'test_user03', xp: 1200 },
  { id: 'test_user_04', name: 'test_user04', xp: 950 },
  { id: 'test_user_05', name: 'test_user05', xp: 720 },
  { id: 'test_user_06', name: 'test_user06', xp: 580 },
  { id: 'test_user_07', name: 'test_user07', xp: 430 },
  { id: 'test_user_08', name: 'test_user08', xp: 310 },
  { id: 'test_user_09', name: 'test_user09', xp: 150 },
  { id: 'test_user_10', name: 'test_user10', xp: 60 },
];

async function seed() {
  for (const u of testUsers) {
    const tag = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, 'users', u.id), {
      displayName: `${u.name}#${tag}`,
      photoURL: '',
      totalXP: u.xp,
      hideActivity: false,
      hideFromRanking: false,
      socialInstagram: '',
      socialX: '',
    });
    console.log(`Created: ${u.name} (${u.xp} XP)`);
  }
  console.log('Done!');
  process.exit(0);
}

seed().catch(console.error);
