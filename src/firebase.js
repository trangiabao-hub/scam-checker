import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";

// Cùng project Firebase với app fao, vì backend xác minh idToken theo
// firebase.project-id = notification-6c96d.
const firebaseConfig = {
  apiKey: "AIzaSyB4KXxNX7sZrBsIlKnPEJDLPPi1JoqvcV4",
  authDomain: "notification-6c96d.firebaseapp.com",
  projectId: "notification-6c96d",
  storageBucket: "notification-6c96d.firebasestorage.app",
  messagingSenderId: "581573831663",
  appId: "1:581573831663:web:9d560b65665aa85afba41a",
};

const app = initializeApp(firebaseConfig);

// indexedDBLocalPersistence trụ được trước Safari ITP tốt hơn mặc định
// sessionStorage, vốn hay gây lỗi "missing initial state".
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const googleProvider = new GoogleAuthProvider();
