"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, resetPassword } from "@/app/actions/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<"email" | "reset">("email");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [email, setEmail] = useState("");

    const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const formData = new FormData(e.currentTarget);
        const emailVal = formData.get("email") as string;
        setEmail(emailVal);

        const res = await forgotPassword(emailVal);
        setLoading(false);
        if (res.success) {
            setStep("reset");
            setSuccess(res.message);
        } else {
            setError(res.message);
        }
    };

    const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const formData = new FormData(e.currentTarget);
        const otp = formData.get("otp") as string;
        const password = formData.get("password") as string;

        const res = await resetPassword(email, otp, password as any); // password cast as any because I defined it as Buffer in my head but string is fine
        setLoading(false);
        if (res.success) {
            setSuccess("Password reset successfully! Redirecting to login...");
            setTimeout(() => router.push("/"), 2000);
        } else {
            setError(res.message);
        }
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#000000] font-sans selection:bg-brand-primary/30">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-primary rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-orange-600 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-amber-500 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

            <div className="z-10 w-full max-w-md px-6">
                {/* Branding */}
                <div className="mb-10 text-center">
                    <Link href="/">
                        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                            <span className="text-brand-primary">Nexus</span>
                            <span className="text-white"> VPS</span>
                        </h1>
                    </Link>
                    <p className="mt-2 text-white/50">Reset your account password.</p>
                </div>

                {/* Form Card */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                    {error && (
                        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-500 border border-green-500/20">
                            {success}
                        </div>
                    )}

                    {step === "email" ? (
                        <form className="space-y-6" onSubmit={handleForgot}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-white/60">Email Address</label>
                                <input
                                    id="email" name="email" type="email" required
                                    placeholder="john@example.com"
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200"
                                />
                            </div>

                            <button
                                type="submit" disabled={loading}
                                className="group relative flex w-full justify-center rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? "Processing..." : "Continue"}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleReset}>
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-white/60">Verification Code</label>
                                <input
                                    id="otp" name="otp" type="text" required maxLength={6}
                                    placeholder="000000"
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-white/60">New Password</label>
                                <input
                                    id="password" name="password" type="password" required
                                    placeholder="••••••••"
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200"
                                />
                            </div>

                            <button
                                type="submit" disabled={loading}
                                className="group relative flex w-full justify-center rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? "Resetting..." : "Reset Password"}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-white/50">
                            Remember your password?{" "}
                            <Link href="/" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
