"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { testVpsConnection } from "@/app/actions/vps";
import { signOut, useSession } from "next-auth/react";

export default function Dashboard() {
    const router = useRouter();
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState("Client VPS");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    // Connection States
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // VPS Form State
    const [vpsData, setVpsData] = useState({
        clientName: "",
        ip: "",
        user: "root",
        password: "",
    });

    const handleConnect = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsConnecting(true);
        setConnectionError(null);

        try {
            const result = await testVpsConnection(vpsData);
            if (result.success) {
                setIsConnected(true);
            } else {
                setConnectionError(result.message || "Failed to establish connection. Check credentials and try again.");
            }
        } catch (err) {
            setConnectionError(err instanceof Error ? err.message : "An unexpected error occurred during connection.");
        } finally {
            setIsConnecting(false);
        }
    };

    const navigateToManage = () => {
        // Encode connection data for the manage page (Demo purposes)
        const params = new URLSearchParams({
            id: vpsData.clientName,
            host: vpsData.ip,
            u: vpsData.user,
            p: btoa(vpsData.password) // Basic encoding for demo
        });
        router.push(`/manage?${params.toString()}`);
        resetDialog();
    };

    const resetDialog = () => {
        setIsDialogOpen(false);
        setIsConnected(false);
        setConnectionError(null);
        setIsConnecting(false);
        setVpsData({
            clientName: "",
            ip: "",
            user: "root",
            password: "",
        });
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
                    {["Client VPS", "Settings"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === tab
                                ? "bg-brand-primary text-black font-bold shadow-lg shadow-brand-primary/10"
                                : "text-zinc-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === tab ? "bg-black" : "bg-transparent animate-pulse"}`} />
                            {tab}
                        </button>
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
            <main className="flex-grow flex flex-col overflow-hidden">
                {/* AppBar */}
                <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight">{activeTab}</h2>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / {activeTab}</p>
                    </div>

                    {activeTab === "Client VPS" && (
                        <button
                            onClick={() => setIsDialogOpen(true)}
                            className="px-6 py-3 rounded-xl bg-brand-primary text-black text-sm font-extrabold transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 shadow-xl shadow-brand-primary/10"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                            ADD VPS
                        </button>
                    )}
                </header>

                {/* Dynamic Section Content */}
                <div className="flex-grow p-10 overflow-y-auto bg-black relative">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                    {activeTab === "Client VPS" ? (
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-zinc-600 mb-8 rotate-12 transition-transform hover:rotate-0 duration-500">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v4a2 2 0 00-2-2" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">No VPS instances connected</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Connect your first client VPS to start deploying applications and managing resources from one central dashboard.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-white/10 p-10 rounded-3xl h-full flex flex-col items-center justify-center text-center">
                            <h3 className="text-2xl font-bold text-white mb-4">System Settings</h3>
                            <p className="text-zinc-500 max-w-md">Nexus VPS is operating in stable mode. Global settings for virtualization and network routing will appear here soon.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Add VPS Dialog (Modal) */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/90 backdrop-blur-2xl transition-all duration-300">
                    <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(246,148,77,0.1)] relative overflow-hidden">
                        {/* Header Accent */}
                        <div className="h-1.5 w-full bg-brand-primary/40 absolute top-0 left-0"></div>

                        <div className="p-10">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter">
                                        {isConnected ? "SUCCESS" : "ADD NEW VPS"}
                                    </h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                                        {isConnected ? "Connection established" : "Setup remote connection"}
                                    </p>
                                </div>
                                <button
                                    onClick={resetDialog}
                                    className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {isConnected ? (
                                <div className="space-y-8 py-4 text-center">
                                    <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-white mb-2">VPS Connected</h4>
                                        <p className="text-zinc-500 text-sm">Target node <b>{vpsData.ip}</b> is now online and reachable.</p>
                                    </div>
                                    <button
                                        onClick={navigateToManage}
                                        className="w-full py-5 rounded-[1.25rem] bg-brand-primary text-black font-black text-sm tracking-[0.05em] uppercase shadow-2xl shadow-brand-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                                    >
                                        GO TO MANAGEMENT
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleConnect} className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Client Identifier</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={isConnecting}
                                            placeholder="e.g. Master Production Node"
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-zinc-700/50 focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all text-sm font-medium disabled:opacity-50"
                                            value={vpsData.clientName}
                                            onChange={(e) => setVpsData({ ...vpsData, clientName: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">SSH Host IP Address</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={isConnecting}
                                            placeholder="0.0.0.0"
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-zinc-700/50 focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all text-sm font-medium disabled:opacity-50"
                                            value={vpsData.ip}
                                            onChange={(e) => setVpsData({ ...vpsData, ip: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Username</label>
                                            <input
                                                type="text"
                                                required
                                                disabled={isConnecting}
                                                placeholder="root"
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-zinc-700/50 focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all text-sm font-medium uppercase tracking-widest disabled:opacity-50"
                                                value={vpsData.user}
                                                onChange={(e) => setVpsData({ ...vpsData, user: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Password</label>
                                            <input
                                                type="password"
                                                required
                                                disabled={isConnecting}
                                                placeholder="••••••••"
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-zinc-700/50 focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all text-sm font-medium disabled:opacity-50"
                                                value={vpsData.password}
                                                onChange={(e) => setVpsData({ ...vpsData, password: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {connectionError && (
                                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold leading-relaxed">
                                            {connectionError}
                                        </div>
                                    )}

                                    <div className="pt-6">
                                        <button
                                            type="submit"
                                            disabled={isConnecting}
                                            className="w-full py-5 rounded-[1.25rem] bg-brand-primary text-black font-black text-sm tracking-[0.05em] uppercase shadow-2xl shadow-brand-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    ATEMPTING SSH...
                                                </>
                                            ) : (
                                                "ESTABLISH CONNECTION"
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Visual Deco */}
                        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl opacity-50"></div>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {isLogoutConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl relative overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Sign Out</h3>
                        <p className="text-zinc-500 text-sm mb-8 leading-relaxed">Are you sure you want to log out of your session?</p>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setIsLogoutConfirmOpen(false)}
                                className="py-4 rounded-xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all"
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