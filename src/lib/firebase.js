// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Your web app's Firebase configuration
import { firebaseConfig } from './firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ฟังก์ชันสำหรับเรียกหน้าต่างล็อกอิน Google ของจริง
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    return {
      data: {
        idToken: await user.getIdToken(),

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
