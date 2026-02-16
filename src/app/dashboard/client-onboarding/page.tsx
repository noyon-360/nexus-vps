"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createCredentialRequest, getAllCredentialRequests, deleteCredentialRequest, acceptCredentialRequest, updateCredentialRequestConfig, getCredentialPresets, saveCredentialPreset } from "@/app/actions/credentials";
import { useSession } from "next-auth/react";

export default function ClientOnboardingPage() {
    const { data: session } = useSession();

    // Client Onboarding State
    const [requestsList, setRequestsList] = useState<any[]>([]);
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
    const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [editConfigData, setEditConfigData] = useState<any[]>([]);
    const [myPresets, setMyPresets] = useState<any[]>([]);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [newRequestData, setNewRequestData] = useState({
        clientName: "",
        note: "",
        config: [] as any[],
    });

    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    // Search & Pagination State
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRequests, setTotalRequests] = useState(0);
    const [pageSize] = useState(10);

    const fetchRequestsList = useCallback(async (page: number = currentPage, search: string = searchQuery) => {
        setIsLoadingList(true);
        try {
            const result = await getAllCredentialRequests(search, page, pageSize);
            if (result.success) {
                setRequestsList(result.requests || []);
                setTotalPages(Math.ceil((result.total || 0) / pageSize));
                setTotalRequests(result.total || 0);
            }
        } catch (error) {
            console.error("Failed to fetch requests list:", error);
        } finally {
            setIsLoadingList(false);
        }
    }, [currentPage, searchQuery, pageSize]);

    const fetchPresets = async () => {
        const result = await getCredentialPresets();
        if (result.success) {
            setMyPresets(result.presets || []);
        }
    };

    useEffect(() => {
        if (session) {
            fetchPresets();
            const delayDebounceFn = setTimeout(() => {
                fetchRequestsList(currentPage, searchQuery);
            }, 500);

            return () => clearTimeout(delayDebounceFn);
        }
    }, [session, searchQuery, currentPage, fetchRequestsList]);

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsConnecting(true);
        try {
            const result = await createCredentialRequest(newRequestData.clientName, newRequestData.config, newRequestData.note);
            if (result.success) {
                setIsRequestDialogOpen(false);
                setNewRequestData({
                    clientName: "",
                    note: "",
                    config: [],
                });
                fetchRequestsList();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error("Create request error:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!confirm("Are you sure you want to delete this request?")) return;
        try {
            await deleteCredentialRequest(id);
            fetchRequestsList();
        } catch (error) {
            console.error("Delete request error:", error);
        }
    };

    const handleAcceptRequest = async (id: string) => {
        if (!confirm("Are you sure you want to mark this request as ACCEPTED?")) return;
        try {
            const result = await acceptCredentialRequest(id);
            if (result.success) {
                setIsViewDrawerOpen(false);
                fetchRequestsList();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error("Accept request error:", error);
        }
    };

    const handleSavePreset = async (configOverride?: any[]) => {
        const configToSave = configOverride || newRequestData.config;
        if (!configToSave || configToSave.length === 0) {
            alert("Configuration is empty.");
            return;
        }

        const name = prompt("Enter a name for this preset:");
        if (!name) return;

        setIsSavingPreset(true);
        const result = await saveCredentialPreset(name, configToSave);
        setIsSavingPreset(false);

        if (result.success) {
            alert("Preset saved successfully!");
            fetchPresets();
        } else {
            alert(result.message || "Failed to save preset.");
        }
    };

    const getRequestProgress = (req: any) => {
        if (!req.config || !Array.isArray(req.config)) return { completed: 0, total: 0, percent: 0 };
        const data = req.data || {};
        const config = req.config as any[];
        let completed = 0;

        config.forEach(section => {
            const sectionData = data[section.id] || {};
            const isComplete = section.fields.length > 0 && section.fields.every((f: any) => {
                if (!f.required) return true;
                const val = sectionData[f.id];
                return val && (Array.isArray(val) ? val.length > 0 : val.toString().trim() !== "");
            });
            if (isComplete) completed++;
        });

        return {
            completed,
            total: config.length,
            percent: Math.round((completed / config.length) * 100)
        };
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* AppBar */}
            <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20 sticky top-0">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Client Onboarding</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / Client Onboarding</p>
                </div>

                <button
                    onClick={() => setIsRequestDialogOpen(true)}
                    className="px-6 py-3 rounded-xl bg-brand-primary text-black text-sm font-extrabold transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 shadow-xl shadow-brand-primary/10"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    CREATE LINK FOR CLIENT
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-grow p-10 overflow-y-auto bg-black relative">
                <div className="absolute top-0 right-0 w-[5000px] h-[5000px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                <div className="flex flex-col h-full">
                    {/* Search Header */}
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div className="relative flex-grow max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search clients by name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-brand-primary/50 focus:outline-none transition-all"
                            />
                        </div>
                        {totalRequests > 0 && (
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                {totalRequests} Total Requests
                            </div>
                        )}
                    </div>

                    {isLoadingList ? (
                        <div className="flex items-center justify-center flex-grow py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : requestsList.length > 0 ? (
                        <div className="space-y-4">
                            {requestsList.map((req) => (
                                <div key={req.id} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 flex items-center justify-between hover:border-brand-primary/20 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${req.status === 'SUBMITTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'}`}>
                                            {req.clientName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white mb-1 group-hover:text-brand-primary transition-colors">{req.clientName}</h4>
                                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                                <span className={`px-2 py-0.5 rounded-full ${req.status === 'ACCEPTED' ? 'bg-green-500 text-black' : (req.status === 'SUBMITTED' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500')}`}>
                                                    {req.status}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all rounded-full ${getRequestProgress(req).percent === 100 ? 'bg-green-500' : 'bg-brand-primary'}`}
                                                            style={{ width: `${getRequestProgress(req).percent}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className={getRequestProgress(req).percent === 100 ? 'text-green-500' : 'text-brand-primary'}>
                                                        {getRequestProgress(req).completed}/{getRequestProgress(req).total}
                                                    </span>
                                                </div>
                                                <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex bg-white/5 rounded-lg border border-white/5 pr-2 overflow-hidden max-w-[200px] md:max-w-md">
                                            <div className="px-3 py-2 bg-white/5 border-r border-white/5 text-xs font-bold text-zinc-500">LINK</div>
                                            <input
                                                readOnly
                                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/collect/${req.slug}`}
                                                className="bg-transparent px-3 text-xs text-zinc-400 focus:outline-none w-full font-mono truncate"
                                                onClick={(e) => e.currentTarget.select()}
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (typeof window !== 'undefined') {
                                                    navigator.clipboard.writeText(`${window.location.origin}/collect/${req.slug}`);
                                                    alert("Link copied to clipboard!");
                                                }
                                            }}
                                            className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                                            title="Copy Link"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>

                                        <button
                                            onClick={() => { setSelectedRequest(req); setIsViewDrawerOpen(true); }}
                                            className="px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-black font-bold text-xs tracking-wider transition-all"
                                        >
                                            {req.status === 'ACCEPTED' ? 'VIEW DETAILS' : 'VIEW DATA'}
                                        </button>

                                        <button
                                            onClick={() => handleDeleteRequest(req.id)}
                                            className="p-2 rounded-lg bg-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-8 py-4 border-t border-white/5">
                                    <button
                                        disabled={currentPage === 1 || isLoadingList}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        PREVIOUS
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                                            if (totalPages > 5 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                                                if (Math.abs(p - currentPage) === 3) return <span key={p} className="text-zinc-600">...</span>;
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${currentPage === p ? 'bg-brand-primary text-black' : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10'}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={currentPage === totalPages || isLoadingList}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        NEXT
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : searchQuery ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center flex-grow">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 mb-4 mx-auto">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3 className="text-white font-bold mb-1">No results matching &quot;{searchQuery}&quot;</h3>
                            <p className="text-sm text-zinc-500">Try a different search term or clear the filter.</p>
                            <button
                                onClick={() => setSearchQuery("")}
                                className="mt-4 text-xs font-bold text-brand-primary hover:text-white transition-colors"
                            >
                                CLEAR SEARCH
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-grow py-20 text-center max-w-sm mx-auto">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-zinc-600 mb-8 mx-auto">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">No Requests Found</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Create a new onboarding request to collect credentials from your clients.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Request Creation Dialog */}
            {isRequestDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/90 backdrop-blur-2xl transition-all duration-300">
                    <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(246,148,77,0.1)] relative overflow-hidden">
                        <div className="h-1.5 w-full bg-brand-primary/40 absolute top-0 left-0"></div>
                        <div className="p-10">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tighter">NEW ONBOARDING REQUEST</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Generate a secure link for client</p>
                                </div>
                                <button onClick={() => setIsRequestDialogOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateRequest} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Client Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 text-sm font-medium"
                                        placeholder="e.g. Acme Corp"
                                        value={newRequestData.clientName}
                                        onChange={(e) => setNewRequestData({ ...newRequestData, clientName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Client Instructions</label>
                                    <textarea
                                        value={newRequestData.note}
                                        onChange={(e) => setNewRequestData({ ...newRequestData, note: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 text-sm font-medium min-h-[100px] resize-none"
                                        placeholder="Instructions for the client (will be visible on the onboarding link)"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Request Configuration</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none"
                                                onChange={(e) => {
                                                    const presetId = e.target.value;
                                                    if (!presetId) return;

                                                    let newConfig: any[] = [...newRequestData.config];

                                                    // Check user presets
                                                    const userPreset = myPresets.find(p => p.id === presetId);
                                                    if (userPreset && Array.isArray(userPreset.config)) {
                                                        // Deep clone and regenerate IDs for fields/sections to avoid duplicates
                                                        const clonedConfig = JSON.parse(JSON.stringify(userPreset.config)).map((s: any) => ({
                                                            ...s,
                                                            id: crypto.randomUUID(),
                                                            fields: (s.fields || []).map((f: any) => ({ ...f, id: crypto.randomUUID() }))
                                                        }));
                                                        newConfig = [...newConfig, ...clonedConfig];
                                                    }

                                                    // Also load the note from the preset if current note is empty
                                                    const updatedData: any = { ...newRequestData, config: newConfig };
                                                    if (!newRequestData.note && userPreset.note) {
                                                        updatedData.note = userPreset.note;
                                                    }
                                                    setNewRequestData(updatedData);
                                                    e.target.value = ""; // reset
                                                }}
                                            >
                                                <option value="">+ Load Preset</option>
                                                {myPresets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => handleSavePreset()}
                                                disabled={newRequestData.config.length === 0 || isSavingPreset}
                                                className="px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Save current configuration as a preset"
                                            >
                                                {isSavingPreset ? "Saving..." : "Save"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setNewRequestData({
                                                    ...newRequestData,
                                                    config: [...newRequestData.config, {
                                                        id: crypto.randomUUID(),
                                                        title: 'New Section',
                                                        fields: []
                                                    }]
                                                })}
                                                className="px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-black transition-colors"
                                            >
                                                + Section
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {newRequestData.config.length === 0 && (
                                            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-xl text-zinc-600 text-sm">
                                                No sections added. Load a preset or add a custom section.
                                            </div>
                                        )}

                                        {newRequestData.config.map((section: any, sIdx: number) => (
                                            <div key={section.id} className="bg-white/5 border border-white/5 rounded-xl p-4 relative group">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newConfig = [...newRequestData.config];
                                                        newConfig.splice(sIdx, 1);
                                                        setNewRequestData({ ...newRequestData, config: newConfig });
                                                    }}
                                                    className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>

                                                <div className="space-y-3 mb-4">
                                                    <input
                                                        type="text"
                                                        value={section.title}
                                                        onChange={(e) => {
                                                            const newConfig = [...newRequestData.config];
                                                            newConfig[sIdx].title = e.target.value;
                                                            setNewRequestData({ ...newRequestData, config: newConfig });
                                                        }}
                                                        className="bg-transparent border-b border-white/10 w-full text-white font-bold focus:outline-none focus:border-brand-primary text-sm pb-1"
                                                        placeholder="Section Title"
                                                    />
                                                    <div className="space-y-3 mt-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight">Guide Links</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newConfig = [...newRequestData.config];
                                                                    if (!newConfig[sIdx].guides) newConfig[sIdx].guides = [];
                                                                    newConfig[sIdx].guides.push({ url: "", comment: "" });
                                                                    setNewRequestData({ ...newRequestData, config: newConfig });
                                                                }}
                                                                className="text-[9px] text-brand-primary hover:text-white font-bold transition-colors"
                                                            >
                                                                + Add Link
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {section.guides?.map((guide: any, gIdx: number) => (
                                                                <div key={gIdx} className="space-y-1 bg-white/5 p-1.5 rounded relative group/guide">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newConfig = [...newRequestData.config];
                                                                            newConfig[sIdx].guides.splice(gIdx, 1);
                                                                            setNewRequestData({ ...newRequestData, config: newConfig });
                                                                        }}
                                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/guide:opacity-100 transition-opacity text-[10px]"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                    <input
                                                                        type="text"
                                                                        value={guide.url}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...newRequestData.config];
                                                                            newConfig[sIdx].guides[gIdx].url = e.target.value;
                                                                            setNewRequestData({ ...newRequestData, config: newConfig });
                                                                        }}
                                                                        className="bg-transparent text-zinc-300 text-[10px] w-full focus:outline-none focus:text-white border-b border-white/5 pb-0.5"
                                                                        placeholder="URL"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={guide.comment || ""}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...newRequestData.config];
                                                                            newConfig[sIdx].guides[gIdx].comment = e.target.value;
                                                                            setNewRequestData({ ...newRequestData, config: newConfig });
                                                                        }}
                                                                        className="bg-transparent text-zinc-500 text-[9px] w-full focus:outline-none focus:text-white"
                                                                        placeholder="Label/Comment"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 pl-2 border-l-2 border-white/5">
                                                    {section.fields.map((field: any, fIdx: number) => (
                                                        <div key={field.id} className="space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={field.label}
                                                                    onChange={(e) => {
                                                                        const newConfig = [...newRequestData.config];
                                                                        newConfig[sIdx].fields[fIdx].label = e.target.value;
                                                                        setNewRequestData({ ...newRequestData, config: newConfig });
                                                                    }}
                                                                    className="bg-black/20 rounded px-2 py-1 text-xs text-white border border-white/5 focus:border-brand-primary focus:outline-none flex-grow"
                                                                    placeholder="Label"
                                                                />
                                                                <select
                                                                    value={field.type}
                                                                    onChange={(e) => {
                                                                        const newConfig = [...newRequestData.config];
                                                                        newConfig[sIdx].fields[fIdx].type = e.target.value;
                                                                        setNewRequestData({ ...newRequestData, config: newConfig });
                                                                    }}
                                                                    className="bg-black/20 rounded px-2 py-1 text-xs text-zinc-400 border border-white/5 focus:outline-none w-24"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="password">Password</option>
                                                                    <option value="longtext">Long Text</option>
                                                                    <option value="image">Image</option>
                                                                    <option value="file">File</option>
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newConfig = [...newRequestData.config];
                                                                        newConfig[sIdx].fields.splice(fIdx, 1);
                                                                        setNewRequestData({ ...newRequestData, config: newConfig });
                                                                    }}
                                                                    className="text-zinc-600 hover:text-red-500"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={field.description || ""}
                                                                onChange={(e) => {
                                                                    const newConfig = [...newRequestData.config];
                                                                    newConfig[sIdx].fields[fIdx].description = e.target.value;
                                                                    setNewRequestData({ ...newRequestData, config: newConfig });
                                                                }}
                                                                className="bg-transparent px-2 py-0.5 text-[10px] text-zinc-500 focus:outline-none w-full border-t border-white/5 mt-1 pt-1"
                                                                placeholder="Field comment (optional)"
                                                            />
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newConfig = [...newRequestData.config];
                                                            newConfig[sIdx].fields.push({
                                                                id: crypto.randomUUID(),
                                                                label: 'New Field',
                                                                type: 'text',
                                                                required: true
                                                            });
                                                            setNewRequestData({ ...newRequestData, config: newConfig });
                                                        }}
                                                        className="text-[10px] text-zinc-500 hover:text-brand-primary font-bold uppercase tracking-wider mt-2 flex items-center gap-1"
                                                    >
                                                        + Add Field
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" disabled={isConnecting} className="w-full py-4 rounded-xl bg-brand-primary text-black font-black text-xs tracking-widest uppercase hover:bg-white transition-all mt-4 mb-2">
                                    {isConnecting ? "Generated..." : "Generate & Copy Link"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Data Drawer */}
            {isViewDrawerOpen && selectedRequest && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewDrawerOpen(false)}></div>
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/10 h-full relative z-10 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-white">{selectedRequest.clientName}</h3>
                                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                                    {isEditingConfig ? "Editing Configuration" : "Submitted Credentials"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditingConfig ? (
                                    <button
                                        onClick={() => {
                                            setEditConfigData(Array.isArray(selectedRequest.config) ? selectedRequest.config : []);
                                            setIsEditingConfig(true);
                                        }}
                                        className="px-3 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        Edit Config
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsEditingConfig(false)}
                                            className="px-3 py-2 rounded-xl bg-transparent text-xs font-bold text-zinc-500 hover:text-white transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setIsConnecting(true);
                                                const result = await updateCredentialRequestConfig(selectedRequest.id, editConfigData, selectedRequest.note);
                                                setIsConnecting(false);
                                                if (result.success) {
                                                    setSelectedRequest({ ...selectedRequest, config: editConfigData });
                                                    setIsEditingConfig(false);
                                                    fetchRequestsList();
                                                } else {
                                                    alert("Failed to update config");
                                                }
                                            }}
                                            className="px-3 py-2 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-white transition-all disabled:opacity-50"
                                            disabled={isConnecting}
                                        >
                                            {isConnecting ? "Saving..." : "Save Changes"}
                                        </button>
                                    </>
                                )}
                                <button onClick={() => { setIsViewDrawerOpen(false); setIsEditingConfig(false); }} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto p-8 space-y-8">
                            {isEditingConfig ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Client Instructions</label>
                                        <textarea
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 text-sm font-medium min-h-[100px] resize-none"
                                            placeholder="Instructions for the client..."
                                            value={selectedRequest.note || ""}
                                            onChange={(e) => setSelectedRequest({ ...selectedRequest, note: e.target.value })}
                                        />
                                    </div>
                                    <div className="border-b border-white/5 my-6"></div>
                                    {/* Edit Logic Reuse */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Form Configuration</h4>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none"
                                                onChange={(e) => {
                                                    const presetId = e.target.value;
                                                    if (!presetId) return;

                                                    let newConfig: any[] = [...editConfigData];
                                                    const userPreset = myPresets.find(p => p.id === presetId);
                                                    if (userPreset && Array.isArray(userPreset.config)) {
                                                        const clonedConfig = JSON.parse(JSON.stringify(userPreset.config)).map((s: any) => ({
                                                            ...s, id: crypto.randomUUID(),
                                                            fields: (s.fields || []).map((f: any) => ({ ...f, id: crypto.randomUUID() }))
                                                        }));
                                                        newConfig = [...newConfig, ...clonedConfig];
                                                    }
                                                    setEditConfigData(newConfig);
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="">+ Load Preset</option>
                                                {myPresets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleSavePreset(editConfigData)}
                                                disabled={editConfigData.length === 0 || isSavingPreset}
                                                className="px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-black transition-colors disabled:opacity-30"
                                            >
                                                {isSavingPreset ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditConfigData([...editConfigData, {
                                                    id: crypto.randomUUID(),
                                                    title: 'New Section',
                                                    fields: []
                                                }])}
                                                className="px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-black transition-colors"
                                            >
                                                + Section
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {editConfigData.length === 0 && (
                                            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-xl text-zinc-600 text-sm">
                                                No sections. Add a custom section.
                                            </div>
                                        )}
                                        {editConfigData.map((section: any, sIdx: number) => (
                                            <div key={section.id} className="bg-white/5 border border-white/5 rounded-xl p-4 relative group">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newConfig = [...editConfigData];
                                                        newConfig.splice(sIdx, 1);
                                                        setEditConfigData(newConfig);
                                                    }}
                                                    className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>

                                                <div className="space-y-3 mb-4">
                                                    <input
                                                        type="text"
                                                        value={section.title}
                                                        onChange={(e) => {
                                                            const newConfig = [...editConfigData];
                                                            newConfig[sIdx].title = e.target.value;
                                                            setEditConfigData(newConfig);
                                                        }}
                                                        className="bg-transparent border-b border-white/10 w-full text-white font-bold focus:outline-none focus:border-brand-primary text-sm pb-1"
                                                        placeholder="Section Title"
                                                    />
                                                    <div className="space-y-3 mt-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight">Guide Links</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newConfig = [...editConfigData];
                                                                    if (!newConfig[sIdx].guides) newConfig[sIdx].guides = [];
                                                                    newConfig[sIdx].guides.push({ url: "", comment: "" });
                                                                    setEditConfigData(newConfig);
                                                                }}
                                                                className="text-[9px] text-brand-primary hover:text-white font-bold transition-colors"
                                                            >
                                                                + Add Link
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {section.guides?.map((guide: any, gIdx: number) => (
                                                                <div key={gIdx} className="space-y-1 bg-white/5 p-1.5 rounded relative group/guide">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newConfig = [...editConfigData];
                                                                            newConfig[sIdx].guides.splice(gIdx, 1);
                                                                            setEditConfigData(newConfig);
                                                                        }}
                                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/guide:opacity-100 transition-opacity text-[10px]"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                    <input
                                                                        type="text"
                                                                        value={guide.url}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...editConfigData];
                                                                            newConfig[sIdx].guides[gIdx].url = e.target.value;
                                                                            setEditConfigData(newConfig);
                                                                        }}
                                                                        className="bg-transparent text-zinc-300 text-[10px] w-full focus:outline-none focus:text-white border-b border-white/5 pb-0.5"
                                                                        placeholder="URL"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={guide.comment || ""}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...editConfigData];
                                                                            newConfig[sIdx].guides[gIdx].comment = e.target.value;
                                                                            setEditConfigData(newConfig);
                                                                        }}
                                                                        className="bg-transparent text-zinc-500 text-[9px] w-full focus:outline-none focus:text-white"
                                                                        placeholder="Label/Comment"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2 pl-2 border-l-2 border-white/5">
                                                    {section.fields?.map((field: any, fIdx: number) => (
                                                        <div key={field.id} className="space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={field.label}
                                                                    onChange={(e) => {
                                                                        const newConfig = [...editConfigData];
                                                                        newConfig[sIdx].fields[fIdx].label = e.target.value;
                                                                        setEditConfigData(newConfig);
                                                                    }}
                                                                    className="bg-black/20 rounded px-2 py-1 text-xs text-white border border-white/5 focus:border-brand-primary focus:outline-none flex-grow"
                                                                    placeholder="Label"
                                                                />
                                                                <select
                                                                    value={field.type}
                                                                    onChange={(e) => {
                                                                        const newConfig = [...editConfigData];
                                                                        newConfig[sIdx].fields[fIdx].type = e.target.value;
                                                                        setEditConfigData(newConfig);
                                                                    }}
                                                                    className="bg-black/20 rounded px-2 py-1 text-xs text-zinc-400 border border-white/5 focus:outline-none w-24"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="password">Password</option>
                                                                    <option value="longtext">Long Text</option>
                                                                    <option value="image">Image</option>
                                                                    <option value="file">File</option>
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newConfig = [...editConfigData];
                                                                        newConfig[sIdx].fields.splice(fIdx, 1);
                                                                        setEditConfigData(newConfig);
                                                                    }}
                                                                    className="text-zinc-600 hover:text-red-500"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={field.description || ""}
                                                                onChange={(e) => {
                                                                    const newConfig = [...editConfigData];
                                                                    newConfig[sIdx].fields[fIdx].description = e.target.value;
                                                                    setEditConfigData(newConfig);
                                                                }}
                                                                className="bg-transparent px-2 py-0.5 text-[10px] text-zinc-500 focus:outline-none w-full border-t border-white/5 mt-1 pt-1"
                                                                placeholder="Field comment (optional)"
                                                            />
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newConfig = [...editConfigData];
                                                            if (!newConfig[sIdx].fields) newConfig[sIdx].fields = [];
                                                            newConfig[sIdx].fields.push({
                                                                id: crypto.randomUUID(),
                                                                label: 'New Field',
                                                                type: 'text',
                                                                required: true
                                                            });
                                                            setEditConfigData(newConfig);
                                                        }}
                                                        className="text-[10px] text-zinc-500 hover:text-brand-primary font-bold uppercase tracking-wider mt-2 flex items-center gap-1"
                                                    >
                                                        + Add Field
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // View Logic
                                <div className="space-y-6 mb-8">
                                    {selectedRequest.note && (
                                        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-6 flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <div>
                                                <h5 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-1">Instructions Provided</h5>
                                                <p className="text-zinc-300 text-[11px] leading-relaxed italic">{selectedRequest.note}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                                        <div>
                                            <h4 className="text-xl font-bold text-white uppercase tracking-tight">{selectedRequest.clientName}</h4>
                                            <p className="text-xs text-zinc-500 font-mono mt-1">ID: {selectedRequest.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${selectedRequest.status === 'ACCEPTED' ? 'bg-green-500 text-black' : (selectedRequest.status === 'SUBMITTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20')}`}>
                                                    {selectedRequest.status}
                                                </span>
                                                <span className="text-xs font-black text-white">
                                                    {getRequestProgress(selectedRequest).completed}/{getRequestProgress(selectedRequest).total} Sections
                                                </span>
                                            </div>
                                            <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden ml-auto">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${getRequestProgress(selectedRequest).percent === 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-brand-primary'}`}
                                                    style={{ width: `${getRequestProgress(selectedRequest).percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedRequest.status !== 'ACCEPTED' && (
                                        <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-2xl p-6 flex items-center justify-between">
                                            <div>
                                                <h5 className="text-sm font-bold text-white mb-1">Finalize Submission?</h5>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Mark as accepted once all data is verified</p>
                                            </div>
                                            <button
                                                onClick={() => handleAcceptRequest(selectedRequest.id)}
                                                className="px-6 py-3 rounded-xl bg-brand-primary text-black text-xs font-black tracking-widest uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
                                            >
                                                CONFIRM & ACCEPT
                                            </button>
                                        </div>
                                    )}

                                    {selectedRequest.data ? (
                                        Object.entries(selectedRequest.data).map(([sectionId, fields]: [string, any]) => {
                                            const sectionConfig = Array.isArray(selectedRequest.config)
                                                ? selectedRequest.config.find((s: any) => s.id === sectionId)
                                                : null;
                                            const sectionTitle = sectionConfig?.title || sectionId;

                                            return (
                                                <div key={sectionId} className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                                    <h4 className="text-lg font-bold text-brand-primary uppercase mb-6 pb-2 border-b border-white/10">{sectionTitle}</h4>
                                                    <div className="grid grid-cols-1 gap-6">
                                                        {Object.entries(fields).map(([fieldId, value]) => {
                                                            const fieldConfig = sectionConfig?.fields.find((f: any) => f.id === fieldId);
                                                            const fieldLabel = fieldConfig?.label || fieldId;

                                                            return (
                                                                <div key={fieldId}>
                                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">{fieldLabel}</label>
                                                                    {Array.isArray(value) ? (
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            {value.map((item: any, idx: number) => (
                                                                                typeof item === 'string' && item.startsWith('data:image') ?
                                                                                    <img key={idx} src={item} alt="Screenshot" className="rounded-lg border border-white/10 w-full" /> :
                                                                                    <div key={idx} className="p-3 rounded bg-black/20 text-sm font-mono text-zinc-300">{item}</div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-sm font-mono text-zinc-200 break-all select-all">
                                                                            {String(value)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-zinc-500 py-20">No data submitted yet.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
