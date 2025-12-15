"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function handleReset(e) {
        e.preventDefault();
        setError("");
        setMessage("");

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset email sent.");
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div style={styles.container}>
            <h1>Reset Password</h1>

            <form onSubmit={handleReset} style={styles.form}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />

                <button type="submit">Send Reset Email</button>
            </form>

            {message && <p style={{ color: "#0f0" }}>{message}</p>}
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