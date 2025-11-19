
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";

// Configuration provided by the user
export const firebaseConfig = {
  apiKey: "AIzaSyA8SheqW0UPLlxoI10JJ5mS15bFAOKHNhg",
  authDomain: "smart-attendance04.firebaseapp.com",
  projectId: "smart-attendance04",
  storageBucket: "smart-attendance04.firebasestorage.app",
  messagingSenderId: "321234604020",
  appId: "1:321234604020:web:e4f7ce526b38e8c7be33a1",
  measurementId: "G-CBSEMYFH51"
};

let app = null;
let auth = null;
let db = null;
let firebaseInitialized = false;

// Check if config exists and has basic required fields.
const isConfigValid = 
    firebaseConfig &&
    firebaseConfig.apiKey &&
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
