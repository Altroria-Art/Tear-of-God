// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtH2k5FZlxanMt0psIGqobL_0jGTfe9-4",
  authDomain: "tear-of-god.firebaseapp.com",
  projectId: "tear-of-god",
  storageBucket: "tear-of-god.firebasestorage.app",
  messagingSenderId: "909440480371",
  appId: "1:909440480371:web:fcc574fcd06a5d301aa606",
  measurementId: "G-HE4V7ETVP3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ฟังก์ชันสำหรับเรียกหน้าต่างล็อกอิน Google ของจริง
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    return {
      data: {
        id: user.uid,
        username: user.displayName,
        email: user.email,
        avatar_url: user.photoURL
      },
      error: null
    };
  } catch (err) {
    console.error(err);
    return { data: null, error: err.message };
  }
};