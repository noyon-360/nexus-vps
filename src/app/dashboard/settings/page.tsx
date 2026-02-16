"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getSystemSettings, updateSystemSettings, testDatabaseConnection, migrateData, initializeDatabase } from "@/app/actions/settings";
// import { useSession } from "next-auth/react"; // If needed for session checks

export default function SettingsPage() {
    const [extDbUrl, setExtDbUrl] = useState("");
    const [initialDbUrl, setInitialDbUrl] = useState("");
    const [extDbType, setExtDbType] = useState("postgresql");
    const [isTestingDb, setIsTestingDb] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsStatus, setSettingsStatus] = useState<{ success?: boolean, message?: string } | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationStatus, setMigrationStatus] = useState<{ success?: boolean, message?: string } | null>(null);

    const fetchSystemSettings = useCallback(async () => {
        console.log("[fetchSystemSettings] Fetching...");
        const res = await getSystemSettings();
        console.log("[fetchSystemSettings] Response:", res);
        if (res.success && res.settings) {
            setExtDbUrl(res.settings.externalDbUrl || "");
            setInitialDbUrl(res.settings.externalDbUrl || "");
            setExtDbType(res.settings.externalDbType || "postgresql");
        }
    }, []);

    useEffect(() => {
        fetchSystemSettings();
    }, [fetchSystemSettings]);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        setSettingsStatus(null);
        try {
            const res = await updateSystemSettings({
                externalDbUrl: extDbUrl,
                externalDbType: extDbType
            });
            if (res.success) {
                setSettingsStatus({ success: true, message: "Settings saved successfully" });
                setInitialDbUrl(extDbUrl);
            } else {
                setSettingsStatus({ success: false, message: res.message || "Failed to save settings" });
            }
        } catch (error: any) {
            setSettingsStatus({ success: false, message: error.message });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTestingDb(true);
        setSettingsStatus(null);
        try {
            const res = await testDatabaseConnection(extDbUrl, extDbType);
            setSettingsStatus({ success: res.success, message: res.message });
        } catch (error: any) {
            setSettingsStatus({ success: false, message: error.message });
        } finally {
            setIsTestingDb(false);
        }
    };

    const handleSyncSchema = async () => {
        if (!confirm("This will synchronize the Prisma schema to the target database. It may involve data-loss if the schema is incompatible. Continue?")) return;
        setIsInitializing(true);
        setSettingsStatus(null);
        try {
            const res = await initializeDatabase(extDbUrl);
            setSettingsStatus({ success: res.success, message: res.message });
        } catch (error: any) {
            setSettingsStatus({ success: false, message: error.message });
        } finally {
            setIsInitializing(false);
        }
    };

    const handleMigrate = async (direction: 'to_external' | 'to_local') => {
        if (!confirm(`Are you sure you want to migrate all data ${direction === 'to_external' ? 'to your personal' : 'back to the default'} database?`)) return;

        setIsMigrating(true);
        setMigrationStatus(null);
        try {
            const res = await migrateData(direction);
            setMigrationStatus({ success: res.success, message: res.message });
        } catch (error: any) {
            setMigrationStatus({ success: false, message: error.message });
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* AppBar */}
            <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20 sticky top-0">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight">System Settings</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / Settings</p>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow p-10 overflow-y-auto bg-black relative">
                <div className="absolute top-0 right-0 w-[5000px] h-[5000px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                <div className="bg-white/5 border border-white/10 p-10 rounded-3xl h-full flex flex-col items-start text-left overflow-y-auto max-h-[calc(100vh-200px)]">
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-white mb-2">System Settings</h3>
                        <p className="text-zinc-500 max-w-md">Configure a personal PostgreSQL database to store client and VPS data for enhanced security and persistence.</p>
                    </div>

                    <div className="w-full max-w-2xl space-y-8">
                        <div className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10">
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-zinc-400">Personal PostgreSQL URL</label>
                                <input
                                    type="text"
                                    value={extDbUrl}
                                    onChange={(e) => {
                                        setExtDbUrl(e.target.value);
                                        setExtDbType('postgresql'); // Force postgresql
                                    }}
                                    placeholder="postgresql://user:pass@host:5432/db?sslmode=require"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all font-mono text-sm"
                                />
                                <p className="text-xs text-zinc-500">
                                    Nexus VPS supports any local or live PostgreSQL instance. Provide the full connection string above.
                                </p>
                            </div>

                            {settingsStatus && (
                                <div className={`p-4 rounded-xl border ${settingsStatus.success
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        {settingsStatus.success ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        )}
                                        <span className="text-sm font-bold tracking-tight">{settingsStatus.message}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={isTestingDb || !extDbUrl}
                                    className="px-6 py-3 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold"
                                >
                                    {isTestingDb && <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>}
                                    TEST CONNECTION
                                </button>
                                <button
                                    onClick={handleSyncSchema}
                                    disabled={isInitializing || !extDbUrl}
                                    className="px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold"
                                >
                                    {isInitializing && <span className="w-4 h-4 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></span>}
                                    SYNC SCHEMA
                                </button>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={isSavingSettings || isTestingDb || extDbUrl === initialDbUrl}
                                    className="px-8 py-3 rounded-xl bg-brand-primary text-black hover:bg-white transition-all shadow-lg shadow-brand-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-bold"
                                >
                                    {isSavingSettings && <span className="w-4 h-4 border-2 border-white/20 border-t-black rounded-full animate-spin"></span>}
                                    SAVE SETTINGS
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-[1px] flex-1 bg-white/10"></div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Data Migration</span>
                                <div className="h-[1px] flex-1 bg-white/10"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleMigrate('to_external')}
                                    disabled={isMigrating || !extDbUrl}
                                    className="flex flex-col items-center justify-center gap-3 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1m0-10V7" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-white mb-1">Move to Personal</div>
                                        <div className="text-[10px] text-zinc-500">Migrate all data to your PostgreSQL</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleMigrate('to_local')}
                                    disabled={isMigrating || !extDbUrl}
                                    className="flex flex-col items-center justify-center gap-3 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h14m-6 4v1m0-10V7" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-white mb-1">Move to Default</div>
                                        <div className="text-[10px] text-zinc-500">Migrate data back to local DB</div>
                                    </div>
                                </button>
                            </div>

                            {isMigrating && (
                                <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-brand-primary/5 border border-brand-primary/10">
                                    <div className="w-8 h-8 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-brand-primary mb-1 italic">Migration in Progress</div>
                                        <div className="text-[10px] text-zinc-500">Syncing all VPS records, clients, and configurations...</div>
                                    </div>
                                </div>
                            )}

                            {migrationStatus && (
                                <div className={`p-4 rounded-xl border ${migrationStatus.success
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold tracking-tight">{migrationStatus.message}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10">
                            <h4 className="text-amber-400 font-semibold mb-2 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Migration Policy
                            </h4>
                            <ul className="text-[11px] text-zinc-500 space-y-2 list-disc ml-5 font-medium leading-relaxed">
                                <li>Migration uses an 'upsert' protocol. Existing records with the same identifier will be updated, not duplicated.</li>
                                <li>Ensure your personal PostgreSQL database is reachable before starting the migration.</li>
                                <li>The migration process may take several seconds depending on your record count.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
