export const dynamic = "force-dynamic";

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { signInWithEmailAndPassword } = await import("firebase/auth");

            const auth = getFirebaseAuth();
            if (!auth) throw new Error("Auth unavailable");

            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div style={styles.container}>
            <h1>Stellar Extractor</h1>
            <h2>Login</h2>

            <form onSubmit={handleLogin} style={styles.form}>
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
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.input}
                />

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>

            {error && <p style={styles.error}>{error}</p>}
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
    },
    input: {
        padding: "10px",
        fontSize: "16px",
    },
    button: {
        padding: "10px",
        background: "#1abc9c",
        fontWeight: "bold",
        border: "none",
    },
    error: {
        color: "#ff6b6b",
        marginTop: "10px",
    },
};