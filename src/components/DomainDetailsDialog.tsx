import React, { useEffect, useState } from "react";
import { getPm2ProcessInfo, Pm2Process } from "@/app/actions/vps";

interface DomainDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    domainName: string;
    config: { ip: string; user: string; password?: string };
}

export default function DomainDetailsDialog({
    isOpen,
    onClose,
    domainName,
    config,
}: DomainDetailsDialogProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [process, setProcess] = useState<Pm2Process | null>(null);
    const [fullList, setFullList] = useState<Pm2Process[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        setError(null);
        setProcess(null);

        async function fetchData() {
            try {
                const result = await getPm2ProcessInfo(config, domainName);
                if (result.success) {
                    if (result.process) {
                        setProcess(result.process);
                    } else if (result.fullList && result.fullList.length > 0) {
                        setFullList(result.fullList);
                        // If no exact match, user can maybe select from list? 
                        // For now just show "No direct match" but list available if we want.
                        // Actually, I'll store full list and let UI decide.
                    } else {
                        setError("No PM2 processes found.");
                    }
                } else {
                    setError(result.error || "Failed to fetch process info.");
                }
            } catch (err: any) {
                setError(err.message || "Unknown error occurred.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [isOpen, domainName, config]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{domainName}</h2>
                            <p className="text-xs text-zinc-500 font-mono">PM2 Process Details</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                            <p className="text-zinc-500 text-xs font-mono animate-pulse">Querying PM2 daemon...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                            {error}
                            <div className="mt-4 flex justify-center">
                                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-xs font-bold">
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : !process && fullList.length > 0 ? (
                        // Fallback list
                        <div className="space-y-4">
                            <p className="text-sm text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/10">
                                Could not automatically match <strong>{domainName}</strong> to a specific PM2 process.
                                Select a process from the list below:
                            </p>
                            <div className="grid gap-2">
                                {fullList.map(p => (
                                    <button
                                        key={p.pm_id}
                                        onClick={() => setProcess(p)}
                                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-primary/30 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${p.pm2_env.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <span className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{p.name}</span>
                                        </div>
                                        <span className="text-xs font-mono text-zinc-500">ID: {p.pm_id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : process ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {fullList.length > 0 && (
                                <button
                                    onClick={() => setProcess(null)}
                                    className="mb-4 text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to Process List
                                </button>
                            )}

                            {/* Status Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${process.pm2_env.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`}></div>
                                        <span className={`text-sm font-bold ${process.pm2_env.status === 'online' ? 'text-green-500' : 'text-zinc-300'}`}>
                                            {process.pm2_env.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Memory</p>
                                    <p className="text-sm font-mono text-white">{(process.monit.memory / 1024 / 1024).toFixed(1)} MB</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">CPU</p>
                                    <p className="text-sm font-mono text-white">{process.monit.cpu}%</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Restarts</p>
                                    <p className="text-sm font-mono text-white">{process.pm2_env.restart_time}</p>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Process Info</h3>
                                    <div className="space-y-3">
                                        <InfoRow label="App Name" value={process.name} />
                                        <InfoRow label="PID" value={process.pid} />
                                        <InfoRow label="PM2 ID" value={process.pm_id} />
                                        <InfoRow label="Node Version" value={process.pm2_env.node_version} />
                                        <InfoRow label="Interpreter" value={process.pm2_env.exec_interpreter} />
                                    </div>
                                </div>

                                <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Paths</h3>
                                    <div className="space-y-3">
                                        <InfoRow label="CWD" value={process.pm2_env.cwd || "?"} isPath />
                                        <InfoRow label="Script" value={process.pm2_env.pm_exec_path} isPath />
                                        <InfoRow label="Log (Out)" value={process.pm2_env.pm_out_log_path} isPath />
                                        <InfoRow label="Log (Err)" value={process.pm2_env.pm_err_log_path} isPath />
                                    </div>
                                </div>
                            </div>

                            {/* Raw Env / Extra Data */}
                            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Environment Variables & Config</h3>
                                </div>
                                <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar bg-black/40">
                                    <pre className="text-[10px] text-zinc-500 font-mono leading-relaxed whitespace-pre-wrap">
                                        {JSON.stringify(process.pm2_env, (key, value) => {
                                            if (key.includes('pass') || key.includes('secret') || key.includes('key')) return '********';
                                            return value;
                                        }, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Fallback list if exact match failed but we have data
                        <div className="space-y-4">
                            <p className="text-sm text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/10">
                                Could not automatically match <strong>{domainName}</strong> to a specific PM2 process.
                                Here are all running processes:
                            </p>
                            <div className="grid gap-2">
                                {fullList.map(p => (
                                    <button
                                        key={p.pm_id}
                                        onClick={() => setProcess(p)}
                                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-primary/30 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${p.pm2_env.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <span className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">{p.name}</span>
                                        </div>
                                        <span className="text-xs font-mono text-zinc-500">ID: {p.pm_id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {process && (
                    <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-between items-center">
                        <div className="text-[10px] text-zinc-600 font-mono">
                            Last updated: {new Date(process.pm2_env.pm_uptime).toLocaleString()}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const InfoRow = ({ label, value, isPath }: { label: string, value: any, isPath?: boolean }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">{label}</span>
        <span className={`text-xs text-zinc-300 font-mono ${isPath ? 'break-all' : ''}`}>
            {value || "N/A"}
        </span>
    </div>
);
