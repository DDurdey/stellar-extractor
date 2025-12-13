import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCpLbyL4NcQurIH2IOLhAk2luBfiZQFPnA",
    authDomain: "stellar-extractor.firebaseapp.com",
    projectId: "stellar-extractor",
    storageBucket: "stellar-extractor.firebasestorage.app",
    messagingSenderId: "1099451698258",
    appId: "1:1099451698258:web:907ed4b0219e80ef32a38b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);