"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { getSystemStats, SystemStats, closeAllConnections } from "@/app/actions/vps";
import dynamic from "next/dynamic";
import { EasyDeploy } from "@/components/EasyDeploy";
import {
    Activity, ArrowLeft, CheckCircle2, ChevronRight, Clock, Clock3,
    Cpu, Database, ExternalLink, Globe, LayoutDashboard, Loader2,
    Lock, MemoryStick, MoreVertical, RefreshCw, Server, Settings,
    Shield, Terminal as TerminalIcon, Trash2, XCircle, Search, Plus,
    Key, GitBranch, Play, StopCircle, Square
} from 'lucide-react';

const TerminalComponent = dynamic(() => import("@/components/Terminal"), { ssr: false });
const DomainDetailsDialog = dynamic(() => import("@/components/DomainDetailsDialog"), { ssr: false });
const FileExplorer = dynamic(() => import("@/components/FileExplorer").then(mod => mod.FileExplorer), { ssr: false });

function ManageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Connection Data from URL
    const clientName = searchParams.get("id") || "Unknown Node";
    const host = searchParams.get("host") || "0.0.0.0";
    const user = searchParams.get("u") || "root";
    const encodedPass = searchParams.get("p") || "";

    // Real Stats State
    const [stats, setStats] = useState<SystemStats>({
        cpu: "0%",
        memory: "0%",
        storage: "0%",
        loadAvg: "0.00, 0.00, 0.00",
        uptime: "Calculated...",
        processes: [],
        domains: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessesCollapsed, setIsProcessesCollapsed] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // Right Panel State
    const [activeRightTab, setActiveRightTab] = useState<'explorer' | 'activity' | 'console'>('explorer');
    const [deployStats, setDeployStats] = useState<any | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isStopping, setIsStopping] = useState(false);

    const panelRef = useRef<any>(null);
    const sidebarRef = useRef<any>(null);
    const terminalPanelRef = useRef<any>(null);

    const handleExit = async () => {
        setIsExiting(true);
        let password = "";
        try { password = atob(encodedPass); } catch { }

        // Close connections
        await closeAllConnections({ ip: host, user, password });

        router.push("/dashboard");
    };

    useEffect(() => {
        if (!host || host === "0.0.0.0") return;

        let password = "";
        try {
            password = atob(encodedPass);
        } catch {
            console.error("Failed to decode password");
        }

        const fetchStats = async () => {
            // If exiting, stop fetching
            if (isExiting) return;

            const result = await getSystemStats({ ip: host, user, password });
            if (result.success && result.stats) {
                setStats(result.stats);
                setLastUpdated(new Date().toLocaleTimeString());
                setError(null);
            } else {
                setError(result.error || "Failed to fetch metrics");
            }
            setIsLoading(false);
        };

        // Initial fetch
        fetchStats();

        // Polling every 15 seconds
        const interval = setInterval(fetchStats, 15000);

        return () => clearInterval(interval);
    }, [host, user, encodedPass, isExiting]);

    const handleDeployStart = () => {
        setIsDeploying(true);
        setDeployStats(null);
        setActiveRightTab('console'); // Auto-switch to console
        if (panelRef.current) panelRef.current.expand();
    };

    const handleDeployComplete = (result: any) => {
        // Only stop deploying state if it's actually finished (not RUNNING)
        if (result.message !== 'RUNNING') {
            setIsDeploying(false);
            setIsStopping(false);
        }
        setDeployStats(result);
    };

    const dialogConfig = React.useMemo(() => {
        let password = "";
        try {
            password = atob(encodedPass);
        } catch {
            console.error("Failed to decode password");
        }
        return { ip: host, user, password };
    }, [host, user, encodedPass]);

    return (
        <div className="flex h-screen bg-black font-sans text-white overflow-hidden">
            {/* Exit Dialog */}
            {showExitDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Confirm Exit</h3>
                            <p className="text-sm text-zinc-400 mt-2">
                                All active terminal sessions and background commands will be terminated.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowExitDialog(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExit}
                                disabled={isExiting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-primary text-black hover:bg-brand-primary/90 text-xs font-bold transition-colors flex justify-center items-center gap-2"
                            >
                                {isExiting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        Exiting...
                                    </>
                                ) : "Confirm & Exit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-grow flex flex-col relative">
                {/* Background Deco */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[150px] -z-10 translate-x-1/3 -translate-y-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-primary/5 rounded-full blur-[100px] -z-10 -translate-x-1/4 translate-y-1/4"></div>

                {/* Header / Breadcrumbs */}
                <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-xl z-20 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowExitDialog(true)}
                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all group"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="h-6 w-px bg-white/10"></div>
                        <div className="space-y-0.5">
                            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                <span className="text-brand-primary">VPS</span> Orchestration
                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] text-green-500 font-extrabold uppercase tracking-widest">Connected</span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Target IP Address</p>
                            <p className="text-sm font-mono text-zinc-300">{host}</p>
                        </div>
                        <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                            REBOOT UNIT
                        </button>
                    </div>
                </header>

                {/* Core Management View */}
                <main className="flex-grow overflow-hidden h-full">
                    <PanelGroup orientation="horizontal" className="h-full">
                        {/* Left Panel: System Info */}
                        <Panel
                            panelRef={sidebarRef}
                            defaultSize={30}
                            minSize={15}
                            collapsible={true}
                            collapsedSize={4}
                            onResize={(size) => setIsSidebarCollapsed(size.asPercentage < 10)}
                            className={`flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'bg-white/[0.02]' : ''}`}
                        >
                            {isSidebarCollapsed ? (
                                <div className="h-full w-full flex flex-col items-center pt-8 gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => sidebarRef.current?.expand()}
                                >
                                    <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                    <div className="h-px w-8 bg-white/10"></div>
                                    <div className="writing-vertical-rl text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] transform rotate-180">
                                        System Overview
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col relative">
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            onClick={() => sidebarRef.current?.collapse()}
                                            className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6 group">
                                        {/* Node Overview */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative overflow-hidden shrink-0">
                                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Node Overview</h3>
                                            <div className="space-y-5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Load Average</span>
                                                    <span className="text-sm font-mono text-brand-primary">{isLoading ? "..." : stats.loadAvg}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">System Uptime</span>
                                                    <span className="text-sm font-mono text-white">{isLoading ? "..." : stats.uptime}</span>
                                                </div>
                                            </div>
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Resource Usage Bars */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative overflow-hidden group shrink-0">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary/40"></div>
                                            <div className="flex justify-between items-start mb-6">
                                                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Resource Usage</h3>
                                                {lastUpdated && !error && (
                                                    <span className="text-[8px] text-zinc-600 font-mono">LATEST: {lastUpdated}</span>
                                                )}
                                            </div>

                                            {error ? (
                                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500 text-[10px] font-bold">
                                                    Error: {error}
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {[
                                                        { label: "CPU Usage", value: stats.cpu, color: "bg-brand-primary" },
                                                        { label: "Memory", value: stats.memory, color: "bg-white" },
                                                        { label: "Storage", value: stats.storage, color: "bg-zinc-600" }
                                                    ].map((stat) => (
                                                        <div key={stat.label} className="space-y-2">
                                                            <div className="flex justify-between text-xs font-bold">
                                                                <span className="text-zinc-400">{stat.label}</span>
                                                                <span className="text-white">{isLoading ? "..." : stat.value}</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${stat.color} transition-all duration-1000 ease-out`}
                                                                    style={{ width: isLoading ? "0%" : stat.value }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Domain Health */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-h-96 overflow-y-auto custom-scrollbar shrink-0">
                                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                                <span>Domain Health</span>
                                                <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">{stats.domains.length}</span>
                                            </h3>
                                            <div className="space-y-3">
                                                {isLoading ? (
                                                    <div className="text-center text-xs text-zinc-600 italic py-4">Scanning configurations...</div>
                                                ) : stats.domains.length === 0 ? (
                                                    <div className="text-center text-xs text-zinc-600 italic py-4">No domains detected</div>
                                                ) : (
                                                    stats.domains.map((domain) => {
                                                        const cleanName = domain.name.toLowerCase();
                                                        const serverNames = domain.serverNames || [];
                                                        const pm2List = stats.pm2Processes || [];

                                                        // enhanced matching: check config name OR server names
                                                        let match = pm2List.find(p => p.name.toLowerCase() === cleanName);

                                                        if (!match) {
                                                            // try matching against server names
                                                            match = pm2List.find(p => serverNames.some(sn => sn.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(sn.toLowerCase())));
                                                        }

                                                        // Fallback matching logic
                                                        if (!match) match = pm2List.find(p => cleanName.startsWith(p.name.toLowerCase()));
                                                        if (!match) match = pm2List.find(p => p.name.toLowerCase().includes(cleanName));

                                                        const isOnline = match?.pm2_env?.status === 'online';

                                                        // Extract ports from detected ports array
                                                        const ports = match?.ports || [];
                                                        const portDisplay = ports.length > 0 ? ports.join(', ') : null;

                                                        return (
                                                            <div
                                                                key={domain.name + domain.file}
                                                                onClick={() => setSelectedDomain(match ? match.name : domain.name)}
                                                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-primary/30 transition-all group cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className={`shrink-0 w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : (match ? 'bg-red-500' : 'bg-zinc-500')} shadow-[0_0_8px_rgba(34,197,94,0.4)]`}></div>
                                                                    <div className="flex flex-col overflow-hidden">
                                                                        <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors truncate">{domain.name}</span>
                                                                        <div className="flex flex-col">
                                                                            {serverNames.length > 0 && (
                                                                                <span className="text-[9px] text-zinc-500 truncate" title={serverNames.join(", ")}>
                                                                                    {serverNames.join(", ")}
                                                                                </span>
                                                                            )}
                                                                            {match && (
                                                                                <span className="text-[8px] font-mono text-zinc-600 group-hover:text-zinc-400">
                                                                                    pid: {match.pid} • {match.name} {portDisplay && `• :${portDisplay}`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="shrink-0 text-[10px] text-zinc-600 font-mono flex items-center gap-2 ml-2">
                                                                    {match ? (
                                                                        <span className={`flex items-center gap-1.5 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {portDisplay && <span className="text-[9px] text-zinc-500 mr-1">:{portDisplay}</span>}
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                                        </span>
                                                                    ) : (
                                                                        <span>Config</span>
                                                                    )}
                                                                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shrink-0">
                                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Execution shortcuts</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                {["Clean Cache", "Restart PM2", "Update Nginx", "Flush Logs"].map(action => (
                                                    <button key={action} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all">
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dialog */}
                                        {selectedDomain && (
                                            <DomainDetailsDialog
                                                isOpen={!!selectedDomain}
                                                onClose={() => setSelectedDomain(null)}
                                                domainName={selectedDomain}
                                                config={dialogConfig}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </Panel>

                        <PanelResizeHandle className="w-2 h-full flex flex-col items-center justify-center cursor-col-resize bg-transparent hover:bg-white/5 transition-colors group z-10">
                            <div className="h-16 w-1 rounded-full bg-white/10 group-hover:bg-brand-primary/50 transition-colors"></div>
                        </PanelResizeHandle>

                        {/* Center Panel: Terminal & Easy Deploy */}
                        <Panel defaultSize={50} minSize={30}>
                            <PanelGroup orientation="vertical" className="h-full">
                                {/* Easy Deploy Panel */}
                                <Panel defaultSize={60} minSize={20} className="p-6 pb-2">

                                    <EasyDeploy
                                        config={dialogConfig}
                                        onSuccess={() => {
                                            // Trigger a refresh of stats
                                            setLastUpdated(Date.now().toString());
                                        }}
                                        onDeployStart={handleDeployStart}
                                        onDeployComplete={handleDeployComplete}
                                    />
                                </Panel>

                                <PanelResizeHandle className="h-4 w-full flex items-center justify-center cursor-row-resize bg-transparent hover:bg-white/5 transition-colors group z-10">
                                    <div className="w-16 h-1 rounded-full bg-white/10 group-hover:bg-brand-primary/50 transition-colors"></div>
                                </PanelResizeHandle>

                                {/* Terminal Panel */}
                                <Panel
                                    defaultSize={40}
                                    minSize={20}
                                    collapsible={true}
                                    collapsedSize={4}
                                    onResize={(size) => setIsTerminalCollapsed(size.inPixels < 100)}
                                    // Start collapsed by default logic is tricky with react-resizable-panels, usually defaultSize determines it. 
                                    // If defaultSize < minSize and collapsible=true, it starts collapsed? 
                                    // Actually we can just use defaultSize small. 
                                    className={`flex flex-col transition-all duration-300 ${isTerminalCollapsed ? 'overflow-hidden' : ''}`}
                                >
                                    {isTerminalCollapsed ? (
                                        <div
                                            className="h-full w-full bg-[#050505] border-t border-white/10 flex items-center px-6 justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => {
                                                // We need a ref to the panel to expand it programmatically, OR just let user drag. 
                                                // But user asked for "expend" (click to expand).
                                                // react-resizable-panels imperative API: panelRef.current.resize(50) or expand()
                                                terminalPanelRef.current?.expand();
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-1.5 opacity-50">
                                                    <div className="w-2 h-2 rounded-full bg-white/10"></div>
                                                    <div className="w-2 h-2 rounded-full bg-white/10"></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                                                    Terminal <span className="text-zinc-700">/</span> {user}@{host}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-zinc-600">
                                                <span className="text-[9px] uppercase tracking-wider">Expand</span>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full bg-[#050505] border border-white/10 rounded-[2.5rem] relative overflow-hidden flex flex-col">
                                            {/* Terminal Top Bar */}
                                            <div className="h-10 border-b border-white/5 flex items-center px-6 justify-between bg-black/20 shrink-0">
                                                <div className="flex gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                                                </div>
                                                <div className="text-[9px] font-mono text-zinc-600 tracking-widest font-bold uppercase">SSH / {user}@{host}</div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => terminalPanelRef.current?.collapse()}
                                                        className="text-zinc-600 hover:text-white transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Terminal Content */}
                                            <div className="flex-grow overflow-hidden relative">
                                                <TerminalComponent
                                                    host={host}
                                                    user={user}
                                                    encodedPass={encodedPass}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Panel>
                            </PanelGroup>
                        </Panel>

                        <PanelResizeHandle className="w-2 h-full flex flex-col items-center justify-center cursor-col-resize bg-transparent hover:bg-white/5 transition-colors group z-10">
                            <div className="h-16 w-1 rounded-full bg-white/10 group-hover:bg-brand-primary/50 transition-colors"></div>
                        </PanelResizeHandle>

                        {/* Right Panel: Active Processes */}
                        <Panel
                            panelRef={panelRef}
                            defaultSize={20}
                            minSize={15}
                            collapsible={true}
                            collapsedSize={4}
                            onResize={(size) => setIsProcessesCollapsed(size.asPercentage < 10)}
                            className={`flex flex-col transition-all duration-300 ${isProcessesCollapsed ? 'bg-white/[0.02]' : ''}`}
                        >
                            {isProcessesCollapsed ? (
                                <div className="h-full w-full flex flex-col items-center pt-8 gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => panelRef.current?.expand()}
                                >
                                    <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <div className="h-px w-8 bg-white/10"></div>
                                    <div className="writing-vertical-rl text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] transform rotate-180">
                                        Activity Monitor
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col relative bg-[#050505] border-l border-white/10">
                                    <div className="absolute top-4 left-4 z-10">
                                        <button
                                            onClick={() => panelRef.current?.collapse()}
                                            className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Process Header / Tabs */}
                                    <div className="h-20 flex-shrink-0 border-b border-white/5 flex items-center px-8 justify-between bg-black/20">
                                        <div className="flex items-center gap-4">
                                            {/* Tab Switcher */}
                                            <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                                                <button
                                                    onClick={() => setActiveRightTab('explorer')}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeRightTab === 'explorer' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Explorer
                                                </button>
                                                <button
                                                    onClick={() => setActiveRightTab('activity')}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeRightTab === 'activity' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Activity
                                                </button>
                                                <button
                                                    onClick={() => setActiveRightTab('console')}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeRightTab === 'console' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Console
                                                </button>
                                            </div>

                                            {activeRightTab === 'activity' && (
                                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400">
                                                    {stats.processes.length} Running
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content based on Tab */}
                                    {activeRightTab === 'explorer' ? (
                                        <div className="flex-grow overflow-hidden p-4">
                                            <FileExplorer config={dialogConfig} />
                                        </div>
                                    ) : activeRightTab === 'activity' ? (
                                        <>
                                            {/* Process List Header & Content */}
                                            <div className="h-10 bg-white/[0.03] flex items-center px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">
                                                <span className="w-full">CMD</span>
                                                <span className="w-16 text-right">PID</span>
                                                <span className="w-12 text-right">CPU</span>
                                                <span className="w-12 text-right">MEM</span>
                                            </div>

                                            <div className="flex-grow overflow-y-auto custom-scrollbar p-0 group">
                                                {isLoading ? (
                                                    <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-600">
                                                        <div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                                                        <span className="text-xs font-mono uppercase tracking-widest">Fetching...</span>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-left border-collapse">
                                                        <tbody className="divide-y divide-white/5">
                                                            {stats.processes.map((proc) => (
                                                                <tr key={proc.pid} className="group hover:bg-white/[0.02] transition-colors">
                                                                    <td className="py-2 pl-4">
                                                                        <div className="text-[10px] font-bold text-zinc-300 group-hover:text-brand-primary transition-colors truncate max-w-[120px]" title={proc.command}>{proc.command}</div>
                                                                    </td>
                                                                    <td className="py-2 text-right w-16">
                                                                        <span className="text-[9px] font-mono text-zinc-500">{proc.pid}</span>
                                                                    </td>
                                                                    <td className="py-2 text-right w-12">
                                                                        <span className={`text-[9px] font-mono font-bold ${parseFloat(proc.cpu) > 10 ? 'text-brand-primary' : 'text-zinc-400'}`}>{proc.cpu}</span>
                                                                    </td>
                                                                    <td className="py-2 text-right w-12 pr-4">
                                                                        <span className="text-[9px] font-mono text-zinc-400">{proc.mem}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        /* Console View */
                                        <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                                            {isDeploying ? (
                                                <div className="flex flex-col h-full bg-[#050505] rounded-xl border border-white/5 overflow-hidden">
                                                    {/* Progress Header */}
                                                    <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                <div className="w-8 h-8 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin"></div>
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex-grow">
                                                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Deploying Application...</h4>
                                                                <p className="text-[10px] text-zinc-500">Live output from VPS</p>
                                                            </div>
                                                            <button
                                                                disabled={isStopping}
                                                                onClick={async () => {
                                                                    if (!deployStats?.deployId) return;
                                                                    if (!confirm("Stop and cleanup deployment?")) return;
                                                                    setIsStopping(true);
                                                                    try {
                                                                        const { stopDeployment } = await import("@/app/actions/deploy");
                                                                        await stopDeployment(dialogConfig, deployStats.deployId, deployStats.appName || "app");
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                        setIsStopping(false);
                                                                    }
                                                                }}
                                                                className={`px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-2 ${isStopping ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {isStopping ? (
                                                                    <div className="w-3 h-3 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <Square className="w-3 h-3 fill-current" />
                                                                )}
                                                                <span>{isStopping ? 'Stopping...' : 'Cancel'}</span>
                                                            </button>
                                                        </div>

                                                        {/* Step Indicators */}
                                                        {deployStats?.steps && (
                                                            <div className="flex items-center gap-1 w-full pt-2">
                                                                {deployStats.steps.map((step: any, idx: number) => (
                                                                    <div key={idx} className="flex-1 flex flex-col gap-1">
                                                                        <div className={`h-1 w-full rounded-full transition-all duration-500 ${step.status === 'success' ? 'bg-green-500' :
                                                                            step.status === 'running' ? 'bg-brand-primary animate-pulse' :
                                                                                step.status === 'failure' ? 'bg-red-500' : 'bg-white/10'
                                                                            }`} />
                                                                        <span className={`text-[8px] font-bold truncate transition-colors ${step.status === 'running' ? 'text-brand-primary' :
                                                                            step.status === 'success' ? 'text-green-500' : 'text-zinc-700'
                                                                            }`}>{step.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Logs Re-use */}
                                                    <div className="flex-grow p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1">
                                                        {deployStats?.logs ? deployStats.logs.map((log: string, i: number) => (
                                                            <div key={i} className="text-zinc-400 border-b border-white/[0.02] pb-1 mb-1 last:border-0 break-all">
                                                                <span className="text-zinc-700 mr-3 select-none">{(i + 1).toString().padStart(3, '0')}</span>
                                                                {log}
                                                            </div>
                                                        )) : (
                                                            <div className="text-zinc-600 italic text-center py-10">Waiting for logs...</div>
                                                        )}
                                                        {/* Auto-scroll anchor */}
                                                        <div ref={(el) => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
                                                    </div>
                                                </div>
                                            ) : !deployStats ? (
                                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                    <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-xs font-medium">No recent console output</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Deployment Status Header */}
                                                    <div className={`p-4 rounded-xl border ${deployStats.success ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className={`w-2 h-2 rounded-full ${deployStats.success ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_10px_currentColor]`} />
                                                            <span className={`text-xs font-bold uppercase ${deployStats.success ? 'text-green-400' : 'text-red-400'}`}>
                                                                {deployStats.success ? 'Deployment Successful' : 'Deployment Failed'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-zinc-400">{deployStats.message}</p>
                                                    </div>

                                                    {/* Steps */}
                                                    {deployStats.steps && deployStats.steps.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Execution Steps</h4>
                                                            {deployStats.steps.map((step: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors">
                                                                    <div className="shrink-0">
                                                                        {step.status === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                                        {step.status === 'failure' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                                                        {step.status === 'running' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                                                        {step.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />}
                                                                    </div>
                                                                    <div className="flex-grow min-w-0">
                                                                        <div className="flex justify-between items-baseline">
                                                                            <span className={`text-[10px] font-bold ${step.status === 'success' ? 'text-zinc-300' : step.status === 'failure' ? 'text-red-400' : 'text-zinc-500'}`}>
                                                                                {step.name}
                                                                            </span>
                                                                        </div>
                                                                        {step.details && <p className="text-[9px] text-zinc-600 truncate mt-0.5">{step.details}</p>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Logs */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">System Logs</h4>
                                                            <span className="text-[9px] font-mono text-zinc-600">{deployStats.logs?.length || 0} lines</span>
                                                        </div>
                                                        <div className="bg-black/50 rounded-xl border border-white/5 p-4 font-mono text-[11px] text-zinc-400 overflow-x-auto custom-scrollbar max-h-[500px]">
                                                            {deployStats.logs && deployStats.logs.map((log: string, i: number) => (
                                                                <div key={i} className="py-1 border-b border-white/5 last:border-0 whitespace-pre-wrap hover:bg-white/5 hover:text-zinc-200 transition-colors">
                                                                    <span className="text-zinc-600 select-none mr-3">{(i + 1).toString().padStart(3, '0')}</span>
                                                                    {log}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Panel>
                    </PanelGroup>
                </main>
            </div>
        </div>
    );
}

export default function ManageVPS() {
    return (
        <Suspense fallback={
            <div className="h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
            </div>
        }>
            <ManageContent />
        </Suspense>
    );
}
