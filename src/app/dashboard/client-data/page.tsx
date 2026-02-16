"use client";

import React, { useState, useCallback, useEffect } from "react";
import { getAllClients, createClient, updateClient, deleteClient, getCredentialPresets } from "@/app/actions/credentials";
import { useSession, signOut } from "next-auth/react";

export default function ClientDataPage() {
    const { data: session } = useSession();

    // Client Data State
    const [clientsList, setClientsList] = useState<any[]>([]);
    const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [isEditingClient, setIsEditingClient] = useState(false); // Mode for dialog
    const [clientFormData, setClientFormData] = useState<any>({
        clientName: "",
        credentials: {},
        config: []
    });

    const [myPresets, setMyPresets] = useState<any[]>([]);

    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    // Search & Pagination State
    const [clientSearchQuery, setClientSearchQuery] = useState("");
    const [clientCurrentPage, setClientCurrentPage] = useState(1);
    const [clientTotalPages, setClientTotalPages] = useState(1);
    const [totalClients, setTotalClients] = useState(0);
    const [pageSize] = useState(10);

    // Image Preview State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false); // Though layout handles logout, if it's reused here? No, layout handles it globally. I'll remove it from here if unnecessary. But wait, the previous code had it. I'll remove it since Layout has it.
    // Wait, the snippet I read had isLogoutConfirmOpen. I'll remove it and use the layout one.

    const fetchClientsList = useCallback(async (page: number = clientCurrentPage, search: string = clientSearchQuery) => {
        setIsLoadingList(true);
        try {
            const result = await getAllClients(search, page, pageSize);
            if (result.success) {
                setClientsList(result.clients || []);
                setClientTotalPages(Math.ceil((result.total || 0) / pageSize));
                setTotalClients(result.total || 0);
            }
        } catch (error) {
            console.error("Failed to fetch clients list:", error);
        } finally {
            setIsLoadingList(false);
        }
    }, [clientCurrentPage, clientSearchQuery, pageSize]);

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
                fetchClientsList(clientCurrentPage, clientSearchQuery);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [session, clientSearchQuery, clientCurrentPage, fetchClientsList]);

    const handleManualFileUpload = (e: React.ChangeEvent<HTMLInputElement>, sectionId: string, fieldId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setClientFormData((prev: any) => {
                const newCreds = { ...prev.credentials };
                if (!newCreds[sectionId]) newCreds[sectionId] = {};
                newCreds[sectionId][fieldId] = base64String;
                return { ...prev, credentials: newCreds };
            });
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteClient = async (id: string) => {
        if (!confirm("Are you sure you want to delete this client? This cannot be undone.")) return;
        try {
            const result = await deleteClient(id);
            if (result.success) {
                fetchClientsList();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error("Delete client error:", error);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* AppBar */}
            <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20 sticky top-0">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Client Data</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / Client Data</p>
                </div>

                <button
                    onClick={() => {
                        setIsEditingClient(false);
                        setClientFormData({ clientName: "", credentials: {}, config: [] });
                        setIsClientDialogOpen(true);
                    }}
                    className="px-6 py-3 rounded-xl bg-brand-primary text-black text-sm font-extrabold transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 shadow-xl shadow-brand-primary/10"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    ADD NEW CLIENT
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
                                placeholder="Search clients..."
                                value={clientSearchQuery}
                                onChange={(e) => {
                                    setClientSearchQuery(e.target.value);
                                    setClientCurrentPage(1);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-brand-primary/50 focus:outline-none transition-all"
                            />
                        </div>
                        {totalClients > 0 && (
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                {totalClients} Total Clients
                            </div>
                        )}
                    </div>

                    {isLoadingList ? (
                        <div className="flex items-center justify-center flex-grow py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : clientsList.length > 0 ? (
                        <div className="space-y-4">
                            {clientsList.map((client) => (
                                <div key={client.id} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 flex items-center justify-between hover:border-brand-primary/20 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-lg border border-brand-primary/20">
                                            {client.clientName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white mb-1 group-hover:text-brand-primary transition-colors">{client.clientName}</h4>
                                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                                <span className={`px-2 py-0.5 rounded-full ${client.source === 'ONBOARDING' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                    {client.source}
                                                </span>
                                                <span>{new Date(client.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setSelectedClient(client);
                                                setIsClientDetailsOpen(true);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-black font-bold text-xs tracking-wider transition-all"
                                        >
                                            VIEW DETAILS
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedClient(client);
                                                setClientFormData({
                                                    clientName: client.clientName,
                                                    credentials: client.credentials || {},
                                                    config: client.config || []
                                                });
                                                setIsEditingClient(true);
                                                setIsClientDialogOpen(true);
                                            }}
                                            className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClient(client.id)}
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
                            {clientTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-8 py-4 border-t border-white/5">
                                    <button
                                        disabled={clientCurrentPage === 1 || isLoadingList}
                                        onClick={() => setClientCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        PREVIOUS
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {Array.from({ length: clientTotalPages }, (_, i) => i + 1).map(p => {
                                            if (clientTotalPages > 5 && Math.abs(p - clientCurrentPage) > 2 && p !== 1 && p !== clientTotalPages) {
                                                if (Math.abs(p - clientCurrentPage) === 3) return <span key={p} className="text-zinc-600">...</span>;
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setClientCurrentPage(p)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${clientCurrentPage === p ? 'bg-brand-primary text-black' : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10'}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={clientCurrentPage === clientTotalPages || isLoadingList}
                                        onClick={() => setClientCurrentPage(prev => Math.min(clientTotalPages, prev + 1))}
                                        className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        NEXT
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : clientSearchQuery ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center flex-grow">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 mb-4 mx-auto">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3 className="text-white font-bold mb-1">No results matching &quot;{clientSearchQuery}&quot;</h3>
                            <p className="text-sm text-zinc-500">Try a different search term or clear the filter.</p>
                            <button
                                onClick={() => setClientSearchQuery("")}
                                className="mt-4 text-xs font-bold text-brand-primary hover:text-white transition-colors"
                            >
                                CLEAR SEARCH
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-grow py-20 text-center max-w-sm mx-auto">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-zinc-600 mb-8 mx-auto">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">No Clients Found</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Add a new client manually or wait for onboarding requests to be accepted.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Client Data Entry/Edit Dialog */}
            {isClientDialogOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/80 backdrop-blur-xl transition-all duration-300">
                    <div className="w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-white">{isEditingClient ? "EDIT CLIENT" : "ADD NEW CLIENT"}</h3>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Manual data entry / Update</p>
                            </div>
                            <button onClick={() => setIsClientDialogOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar relative">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-12 space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Client Name</label>
                                        <input
                                            type="text"
                                            value={clientFormData.clientName}
                                            onChange={(e) => setClientFormData({ ...clientFormData, clientName: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-brand-primary/50 focus:outline-none transition-all text-xl font-bold"
                                            placeholder="Enter client name..."
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Credential Structure</h4>
                                        <div className="flex items-center gap-3">
                                            <select
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-zinc-400 focus:outline-none"
                                                onChange={(e) => {
                                                    const p = myPresets.find(p => p.id === e.target.value);
                                                    if (p) setClientFormData({ ...clientFormData, config: p.config });
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="">Load Preset</option>
                                                {myPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <button
                                                onClick={() => setClientFormData({
                                                    ...clientFormData,
                                                    config: [...(clientFormData.config || []), { id: crypto.randomUUID(), title: "New Section", fields: [] }]
                                                })}
                                                className="px-4 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-black transition-all"
                                            >
                                                + SECTION
                                            </button>
                                        </div>
                                    </div>

                                    {/* Config Builder & Data Entry */}
                                    <div className="space-y-6">
                                        {(clientFormData.config || []).map((section: any, sIdx: number) => (
                                            <div key={section.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative group/section">
                                                <button
                                                    onClick={() => {
                                                        const newConfig = [...clientFormData.config];
                                                        newConfig.splice(sIdx, 1);
                                                        setClientFormData({ ...clientFormData, config: newConfig });
                                                    }}
                                                    className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 opacity-0 group-hover/section:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>

                                                <input
                                                    type="text"
                                                    value={section.title}
                                                    onChange={(e) => {
                                                        const newConfig = [...clientFormData.config];
                                                        newConfig[sIdx].title = e.target.value;
                                                        setClientFormData({ ...clientFormData, config: newConfig });
                                                    }}
                                                    className="bg-transparent text-lg font-bold text-white border-b border-white/5 focus:border-brand-primary outline-none pb-2 mb-6 w-1/2"
                                                />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {(section.fields || []).map((field: any, fIdx: number) => (
                                                        <div key={field.id} className="space-y-2 p-4 bg-black/40 border border-white/5 rounded-xl group/field">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 flex-grow">
                                                                    <input
                                                                        type="text"
                                                                        value={field.label}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...clientFormData.config];
                                                                            newConfig[sIdx].fields[fIdx].label = e.target.value;
                                                                            setClientFormData({ ...clientFormData, config: newConfig });
                                                                        }}
                                                                        className="bg-transparent text-[10px] font-bold text-zinc-400 uppercase tracking-widest outline-none border-b border-white/10 focus:border-brand-primary"
                                                                    />
                                                                    <select
                                                                        value={field.type || 'text'}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...clientFormData.config];
                                                                            newConfig[sIdx].fields[fIdx].type = e.target.value;
                                                                            setClientFormData({ ...clientFormData, config: newConfig });
                                                                        }}
                                                                        className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[8px] text-zinc-500 focus:outline-none"
                                                                    >
                                                                        <option value="text">TEXT</option>
                                                                        <option value="password">PSWD</option>
                                                                        <option value="longtext">LONG</option>
                                                                        <option value="image">IMG</option>
                                                                        <option value="file">FILE</option>
                                                                    </select>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const newConfig = [...clientFormData.config];
                                                                        newConfig[sIdx].fields.splice(fIdx, 1);
                                                                        setClientFormData({ ...clientFormData, config: newConfig });
                                                                    }}
                                                                    className="text-zinc-600 hover:text-red-500 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>

                                                            {field.type === 'longtext' ? (
                                                                <textarea
                                                                    value={(clientFormData.credentials[section.id] || {})[field.id] || ""}
                                                                    onChange={(e) => {
                                                                        const newCreds = { ...clientFormData.credentials };
                                                                        if (!newCreds[section.id]) newCreds[section.id] = {};
                                                                        newCreds[section.id][field.id] = e.target.value;
                                                                        setClientFormData({ ...clientFormData, credentials: newCreds });
                                                                    }}
                                                                    className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-brand-primary/30 outline-none min-h-[100px] resize-none"
                                                                    placeholder={`Enter ${field.label}...`}
                                                                />
                                                            ) : field.type === 'image' || field.type === 'file' ? (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-4">
                                                                        <label className="flex-grow flex items-center justify-center p-3 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-brand-primary/30 hover:bg-white/5 transition-all">
                                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                                {(clientFormData.credentials[section.id] || {})[field.id] ? "CHANGE FILE" : `UPLOAD ${field.type.toUpperCase()}`}
                                                                            </span>
                                                                            <input
                                                                                type="file"
                                                                                accept={field.type === 'image' ? "image/*" : "*/*"}
                                                                                className="hidden"
                                                                                onChange={(e) => handleManualFileUpload(e, section.id, field.id)}
                                                                            />
                                                                        </label>
                                                                        {(clientFormData.credentials[section.id] || {})[field.id] && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newCreds = { ...clientFormData.credentials };
                                                                                    delete newCreds[section.id][field.id];
                                                                                    setClientFormData({ ...clientFormData, credentials: newCreds });
                                                                                }}
                                                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {(clientFormData.credentials[section.id] || {})[field.id] && field.type === 'image' && (
                                                                        <div className="relative group/img-preview">
                                                                            <img
                                                                                src={(clientFormData.credentials[section.id] || {})[field.id]}
                                                                                className="w-full h-32 object-cover rounded-xl border border-white/10"
                                                                                alt="Preview"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {(clientFormData.credentials[section.id] || {})[field.id] && field.type === 'file' && (
                                                                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-blue-500/10 text-blue-500 flex items-center justify-center rounded-lg">
                                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">File Uploaded</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type={field.type === 'password' ? 'password' : 'text'}
                                                                    value={(clientFormData.credentials[section.id] || {})[field.id] || ""}
                                                                    onChange={(e) => {
                                                                        const newCreds = { ...clientFormData.credentials };
                                                                        if (!newCreds[section.id]) newCreds[section.id] = {};
                                                                        newCreds[section.id][field.id] = e.target.value;
                                                                        setClientFormData({ ...clientFormData, credentials: newCreds });
                                                                    }}
                                                                    className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-sm text-white focus:border-brand-primary/30 outline-none"
                                                                    placeholder={`Enter ${field.label}...`}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        const newConfig = [...clientFormData.config];
                                                        if (!newConfig[sIdx].fields) newConfig[sIdx].fields = [];
                                                        newConfig[sIdx].fields.push({ id: crypto.randomUUID(), label: "New Field", type: "text" });
                                                        setClientFormData({ ...clientFormData, config: newConfig });
                                                    }}
                                                    className="border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center p-4 text-zinc-600 hover:text-brand-primary hover:border-brand-primary/20 transition-all font-bold text-[10px] uppercase tracking-widest mt-6 w-full"
                                                >
                                                    + ADD FIELD
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-white/10 bg-black/40 flex items-center justify-end gap-4 shrink-0">
                            <button
                                onClick={() => setIsClientDialogOpen(false)}
                                className="px-8 py-4 rounded-2xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={async () => {
                                    setIsConnecting(true);
                                    let result;
                                    if (isEditingClient && selectedClient) {
                                        result = await updateClient(selectedClient.id, clientFormData.clientName, clientFormData.credentials, clientFormData.config);
                                    } else {
                                        result = await createClient(clientFormData.clientName, clientFormData.credentials, clientFormData.config);
                                    }
                                    setIsConnecting(false);
                                    if (result.success) {
                                        setIsClientDialogOpen(false);
                                        fetchClientsList();
                                    } else {
                                        alert(result.message);
                                    }
                                }}
                                disabled={isConnecting || !clientFormData.clientName}
                                className="px-12 py-4 rounded-2xl bg-brand-primary text-black font-black text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50"
                            >
                                {isConnecting ? "SAVING..." : (isEditingClient ? "UPDATE CLIENT" : "CREATE CLIENT")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Details Drawer */}
            {isClientDetailsOpen && selectedClient && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsClientDetailsOpen(false)}></div>
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/10 h-full relative z-10 flex flex-col animate-in slide-in-from-right duration-500 shadow-2xl">
                        <div className="p-10 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-2xl border border-brand-primary/20">
                                    {selectedClient.clientName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-white leading-tight uppercase tracking-tight">{selectedClient.clientName}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${selectedClient.source === 'ONBOARDING' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {selectedClient.source}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-mono">CREATED: {new Date(selectedClient.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsClientDetailsOpen(false)} className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center transition-all">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-10 space-y-10 custom-scrollbar">
                            {Object.entries(selectedClient.credentials || {}).map(([sectionId, fields]: [string, any]) => {
                                const sectionConfig = (selectedClient.config || []).find((s: any) => s.id === sectionId);
                                const sectionTitle = sectionConfig?.title || sectionId;

                                return (
                                    <div key={sectionId} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <h4 className="text-sm font-black text-brand-primary uppercase tracking-[0.2em]">{sectionTitle}</h4>
                                            <div className="flex-grow h-px bg-gradient-to-r from-brand-primary/20 to-transparent"></div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {Object.entries(fields).map(([fieldId, value]) => {
                                                const fieldConfig = sectionConfig?.fields.find((f: any) => f.id === fieldId);
                                                const fieldLabel = fieldConfig?.label || fieldId;

                                                return (
                                                    <div key={fieldId} className="group/item">
                                                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-2 group-hover/item:text-zinc-400 transition-colors">{fieldLabel}</label>
                                                        <div className="relative">
                                                            <div className={`p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-sm font-mono text-zinc-300 select-all transition-all hover:border-brand-primary/20 ${fieldConfig?.type === 'longtext' ? 'whitespace-pre-wrap' : ''}`}>
                                                                {fieldConfig?.type === 'image' && typeof value === 'string' && value.startsWith('data:image') ? (
                                                                    <div className="space-y-4">
                                                                        <div
                                                                            className="relative group/img cursor-zoom-in overflow-hidden rounded-xl border border-white/10 shadow-2xl transition-all hover:border-brand-primary/50"
                                                                            onClick={() => {
                                                                                setPreviewImage(value);
                                                                                setIsPreviewOpen(true);
                                                                            }}
                                                                        >
                                                                            <img src={value} className="max-w-full h-auto transition-transform duration-500 group-hover/img:scale-110" alt={fieldLabel} />
                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-black/40 p-3 rounded-lg border border-white/5">
                                                                            <span>IMAGE DATA</span>
                                                                            <button onClick={() => navigator.clipboard.writeText(value)} className="text-brand-primary hover:text-white transition-colors">COPY BASE64</button>
                                                                        </div>
                                                                    </div>
                                                                ) : fieldConfig?.type === 'file' && typeof value === 'string' && value.startsWith('data:') ? (
                                                                    <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 flex items-center justify-center rounded-xl">
                                                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">FILE READY</span>
                                                                                <span className="text-xs text-zinc-500">Binary data stored securely</span>
                                                                            </div>
                                                                        </div>
                                                                        <button onClick={() => {
                                                                            const link = document.createElement('a');
                                                                            link.href = value;
                                                                            link.download = `file_${fieldId}`;
                                                                            link.click();
                                                                        }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all">DOWNLOAD</button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-between group/val">
                                                                        <span className="flex-grow break-all">{String(value)}</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(String(value));
                                                                            }}
                                                                            className="ml-4 p-2 rounded-lg bg-white/5 text-zinc-500 hover:text-brand-primary opacity-0 group-hover/val:opacity-100 transition-all"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Image Preview Modal */}
            {isPreviewOpen && previewImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
                    onClick={() => setIsPreviewOpen(false)}
                >
                    <button
                        className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-white/5 text-white hover:bg-white/10 flex items-center justify-center transition-all z-[110]"
                        onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(false); }}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div
                        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage}
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
                            alt="Preview High Res"
                        />
                    </div>

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl flex items-center gap-6">
                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = previewImage;
                                link.download = `preview_${Date.now()}.png`;
                                link.click();
                            }}
                            className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-brand-primary transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            DOWNLOAD
                        </button>
                        <div className="w-px h-4 bg-white/10"></div>
                        <button
                            onClick={() => setIsPreviewOpen(false)}
                            className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-white transition-colors"
                        >
                            CLOSE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
