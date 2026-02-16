"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    const navItems = [
        { name: "Client VPS", path: "/dashboard" },
        { name: "Client Onboarding", path: "/dashboard/client-onboarding" },
        { name: "Client Data", path: "/dashboard/client-data" },
        { name: "Presets", path: "/dashboard/presets" },
        { name: "Settings", path: "/dashboard/settings" },
    ];

    const isActive = (path: string) => {
        if (path === "/dashboard") return pathname === "/dashboard";
        return pathname?.startsWith(path);
    };

    return (
        <div className="flex h-screen bg-black font-sans text-white">
            {/* Sidebar */}
            <aside className="w-72 border-r border-white/10 bg-[#050505] p-8 flex flex-col">
                <div className="mb-12">
                    <h1 className="text-2xl font-bold tracking-tight">
                        <span className="text-brand-primary">Nexus</span>
                        <span className="text-white"> VPS</span>
                    </h1>
                </div>

                <nav className="space-y-3 flex-grow">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive(item.path)
                                ? "bg-brand-primary text-black font-bold shadow-lg shadow-brand-primary/10"
                                : "text-zinc-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive(item.path) ? "bg-black" : "bg-transparent animate-pulse"}`} />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/20 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
                                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "A"}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white truncate max-w-[120px]">
                                    {session?.user?.name || "Admin User"}
                                </p>
                                <p className="text-xs text-zinc-500">Nexus Cloud</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            className="p-2 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all font-medium"
                            title="Logout"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            {children}

            {/* Logout Confirmation Modal */}
            {isLogoutConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl relative overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Sign Out?</h3>
                        <p className="text-zinc-500 text-sm mb-8 leading-relaxed">Are you sure you want to logout? You will need to sign in again to access your dashboard.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setIsLogoutConfirmOpen(false)}
                                className="py-4 rounded-xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all font-sans"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="py-4 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                            >
                                LOGOUT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
