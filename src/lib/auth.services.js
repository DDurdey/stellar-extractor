import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export async function login(email, password) {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Auth not available");

    return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    const auth = getFirebaseAuth();
    if (!auth) return;

    return signOut(auth);
}