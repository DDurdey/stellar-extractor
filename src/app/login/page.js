"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export default function LoginPage() {
    const router = useRouter();
    const auth = getFirebaseAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "white", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <h1>Stellar Extractor</h1>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "260px" }}>
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="submit" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>

            {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

            <p style={{ marginTop: "16px", fontSize: "14px" }}>
                Don’t have an account?{" "}
                <button
                    onClick={() => router.push("/signup")}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#1abc9c",
                        cursor: "pointer",
                        fontWeight: "bold",
                        padding: 0
                    }}
                >
                    Sign up
                </button>
            </p>
        </div>
    );
}