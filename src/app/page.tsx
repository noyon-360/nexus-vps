"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { resendOtp } from "@/app/actions/auth";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const emailVal = formData.get("username") as string;
    const password = formData.get("password") as string;
    const rememberMe = formData.get("remember-me") === "on";
    setEmail(emailVal);

    console.log("Sign in attempt:", { email: emailVal, rememberMe });

    const res = await signIn("credentials", {
      email: emailVal,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      router.push("/dashboard");
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    setLoading(true);
    setSuccess("");
    const res = await resendOtp(email);
    setLoading(false);
    if (res.success) {
      setSuccess(res.message);
      setError("");
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
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            <span className="text-brand-primary">Nexus</span>
            <span className="text-white"> VPS</span>
          </h1>
          <p className="mt-2 text-white/50">Cloud virtualization simplified.</p>
        </div>

        {/* Login Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20 text-center">
              {error}
              {error.includes("verify") && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="ml-2 font-bold underline hover:text-red-400 disabled:opacity-50"
                >
                  Resend Code
                </button>
              )}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-500 border border-green-500/20 text-center">
              {success}
              <Link href={`/register?email=${encodeURIComponent(email)}&step=verify`} className="ml-2 font-bold underline">
                Go to Verify
              </Link>
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSignIn}>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-white/60"
              >
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="admin@example.com"
                  className="block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200 hover:border-white/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/60"
                >
                  Password
                </label>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/20 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 focus:outline-hidden sm:text-sm transition-all duration-200 hover:border-white/20"
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/10 bg-black/40 text-brand-primary focus:ring-brand-primary/20 transition-all cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-xs text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                    Remember me
                  </label>
                </div>
                <Link href="/forgot-password" className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && (
                  <svg
                    className="ml-2 h-5 w-5 opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-10 text-center text-xs text-white/30">
          &copy; {new Date().getFullYear()} Nexus Cloud Systems. All rights reserved.
        </p>
      </div>
    </main>
  );
}
