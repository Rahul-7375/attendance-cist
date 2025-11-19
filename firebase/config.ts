
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";

// Instructions:
// 1. Go to https://aistudio.google.com/app/apikey
// 2. Create a new API Key.
// 3. Paste it below in the apiKey field.

export const firebaseConfig = {
  apiKey: "AIzaSyADydlgH4Fxmn9Hi0Pi8qdgX57YurvQ42M",
  authDomain: "attendance-system-11.firebaseapp.com",
  projectId: "attendance-system-11",
  storageBucket: "attendance-system-11.firebasestorage.app",
  messagingSenderId: "14882969392",
  appId: "1:14882969392:web:09cddbf9fe8e8ec98e1af5"
};

let app = null;
let auth = null;
let db = null;
let firebaseInitialized = false;

// Check if config exists and has basic required fields.
const isConfigValid = 
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.length > 0 &&
    firebaseConfig.projectId;

if (isConfigValid) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Suppress verbose warnings about network streams which are common in some environments
        setLogLevel('error');
        
        firebaseInitialized = true;
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        // Ensure everything is null and the flag is false on failure.
        app = null;
        auth = null;
        db = null;
        firebaseInitialized = false;
    }
} else {
    console.warn(
        "Firebase initialization skipped: Configuration is missing or incomplete."
    );
    firebaseInitialized = false;
}

export { app, auth, db, firebaseInitialized };
