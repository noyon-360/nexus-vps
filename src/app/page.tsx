"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleSignIn = (e: React.SubmitEvent) => {
    e.preventDefault();
    // For UI demonstration, redirect to dashboard immediately
    router.push("/dashboard");
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
          <form className="space-y-6" onSubmit={handleSignIn}>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-white/60"
              >
                Username
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="admin"
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

              <div className="mt-2 flex justify-end">
                <a href="#" className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative flex w-full justify-center rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:scale-[0.98]"
              >
                Sign in
                <svg
                  className="ml-2 h-5 w-5 opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              Don&apos;t have an account?{" "}
              <a href="#" className="font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">
                Contact administration
              </a>
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
