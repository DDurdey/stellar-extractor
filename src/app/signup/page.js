"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { getFirebaseAuth, getFirebaseDB } from "@/lib/firebase";

const auth = getFirebaseAuth();
const db = getFirebaseDB();

export default function SignupPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSignup(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // Create initial save file in Firestore
            await setDoc(doc(db, "users", cred.user.uid), {
                ore: 0,
                clickPower: 1,
                clickLevel: 1,
                drones: 0,
                droneDamage: 1,
                droneDamageLevel: 1,
                droneFireRate: 1000,
                droneFireRateLevel: 1,
                currentSector: 1,
                createdAt: Date.now(),
                lastSave: Date.now(),
            });

            router.push("/"); // go to game
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div style={styles.container}>
            <h1>Stellar Extractor</h1>
            <h2>Create Account</h2>

            <form onSubmit={handleSignup} style={styles.form}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={styles.input}
                />

                <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.input}
                />

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "Creating account..." : "Sign Up"}
                </button>
            </form>

            {error && <p style={styles.error}>{error}</p>}

            <p style={styles.footer}>
                Already have an account?{" "}
                <a href="/login" style={styles.link}>
                    Login
                </a>
            </p>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "260px",
        marginTop: "10px",
    },
    input: {
        padding: "10px",
        fontSize: "16px",
        borderRadius: "4px",
        border: "none",
    },
    button: {
        padding: "10px",
        fontSize: "16px",
        cursor: "pointer",
        background: "#1abc9c",
        border: "none",
        borderRadius: "4px",
        fontWeight: "bold",
    },
    error: {
        color: "#ff6b6b",
        marginTop: "10px",
        maxWidth: "260px",
        textAlign: "center",
    },
    footer: {
        marginTop: "15px",
        fontSize: "14px",
    },
    link: {
        color: "#1abc9c",
        textDecoration: "none",
    },
};