export const dynamic = "force-dynamic";

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
            const { auth } = await import("@/lib/firebase");
            const { signInWithEmailAndPassword } = await import("firebase/auth");

            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (err) {
            setError(err.message ?? "Login failed");
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

            <p style={styles.footer}>
                Don’t have an account?{" "}
                <a href="/signup" style={styles.link}>
                    Sign up
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