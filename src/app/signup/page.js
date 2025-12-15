"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSignup(e) {
        e.preventDefault();
        setError("");

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // Create user save file
            await setDoc(doc(db, "users", cred.user.uid), {
                ore: 0,
                clickPower: 1,
                drones: 0,
                droneDamage: 1,
                droneFireRate: 1000,
                currentSector: 1,
                createdAt: Date.now(),
            });

            router.push("/");
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div style={styles.container}>
            <h1>Create Account</h1>

            <form onSubmit={handleSignup} style={styles.form}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password (min 6 chars)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />

                <button type="submit">Sign Up</button>
            </form>

            {error && <p style={styles.error}>{error}</p>}

            <p><a href="/login">Back to login</a></p>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        background: "#111",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "250px",
    },
    error: {
        color: "#ff5555",
    },
};