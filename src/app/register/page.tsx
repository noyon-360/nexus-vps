"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registerUser, verifyOtp, resendOtp } from "@/app/actions/auth";
import Link from "next/link";

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<"register" | "verify">((searchParams.get("step") as any) || "register");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [email, setEmail] = useState(searchParams.get("email") || "");

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        setEmail(data.email as string);

        const res = await registerUser(data);
        setLoading(false);
        if (res.success) {
            setStep("verify");
            setSuccess(res.message);
        } else {
            setError(res.message);
        }
    };

    const handleVerify = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const formData = new FormData(e.currentTarget);
        const otp = formData.get("otp") as string;

        const res = await verifyOtp(email, otp);
        setLoading(false);
        if (res.success) {
            setSuccess("Account verified! Redirecting to login...");
            setTimeout(() => router.push("/"), 2000);
        } else {
            setError(res.message);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        setError("");
        const res = await resendOtp(email);
        setLoading(false);
        if (res.success) {
            setSuccess(res.message);
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
                    <p className="mt-2 text-white/50">Create your account to get started.</p>
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

                    {step === "register" ? (
                        <form className="space-y-6" onSubmit={handleRegister}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-white/60">Full Name</label>
                                <input
                                    id="name" name="name" type="text" required
                                    placeholder="John Doe"
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-white/60">Email Address</label>
                                <input
                                    id="email" name="email" type="email" required
                                    defaultValue={email}
                                    placeholder="john@example.com"
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-white/60">Password</label>
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
                                {loading ? "Creating account..." : "Sign up"}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerify}>
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-white/60 text-center">Enter 6-digit Verification Code</label>
                                <input
                                    id="otp" name="otp" type="text" required maxLength={6}
                                    placeholder="000000"
                                    className="mt-4 block w-full text-center tracking-[1em] text-2xl font-bold rounded-lg border border-white/10 bg-black/40 px-4 py-4 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden transition-all duration-200"
                                />
                            </div>

                            <button
                                type="submit" disabled={loading}
                                className="group relative flex w-full justify-center rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? "Verifying..." : "Verify Code"}
                            </button>

                            <p className="text-center text-xs text-white/40">
                                Didn't receive code? <button type="button" onClick={handleResend} disabled={loading} className="text-brand-primary hover:underline disabled:opacity-50">Resend</button>
                            </p>
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-white/50">
                            Already have an account?{" "}
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

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
