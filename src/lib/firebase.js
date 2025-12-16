import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let app;
let auth;
let db;

export function getFirebaseApp() {
    if (!app) {
        app = getApps().length
            ? getApp()
            : initializeApp({
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            });
    }
    return app;
}

export function getFirebaseAuth() {
    if (typeof window === "undefined") return null;
    if (!auth) auth = getAuth(getFirebaseApp());
    return auth;
}

export function getFirebaseDB() {
    if (typeof window === "undefined") return null;
    if (!db) db = getFirestore(getFirebaseApp());
    return db;
}