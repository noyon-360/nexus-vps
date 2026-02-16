"use client";

import React, { useState, useEffect } from "react";
import { getCredentialPresets, saveCredentialPreset, updateCredentialPreset, deleteCredentialPreset } from "@/app/actions/credentials";
import { useSession } from "next-auth/react";

export default function PresetsPage() {
    const { data: session } = useSession();

    const [myPresets, setMyPresets] = useState<any[]>([]);
    const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
    const [isEditingPreset, setIsEditingPreset] = useState(false);
    const [targetPresetId, setTargetPresetId] = useState<string | null>(null);
    const [presetFormData, setPresetFormData] = useState({
        name: "",
        config: [] as any[],
    });
    const [isConnecting, setIsConnecting] = useState(false); // Used for loading state during save/update

    const fetchPresets = async () => {
        const result = await getCredentialPresets();
        if (result.success) {
            setMyPresets(result.presets || []);
        }
    };

    useEffect(() => {
        if (session) {
            fetchPresets();
        }
    }, [session]);

    const handleCreateOrUpdatePreset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsConnecting(true);
        try {
            let result;
            if (isEditingPreset && targetPresetId) {
                result = await updateCredentialPreset(targetPresetId, presetFormData.name, presetFormData.config);
            } else {
                result = await saveCredentialPreset(presetFormData.name, presetFormData.config);
            }

            if (result.success) {
                setIsPresetDialogOpen(false);
                setPresetFormData({ name: "", config: [] });
                setIsEditingPreset(false);
                setTargetPresetId(null);
                fetchPresets();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error("Preset action error:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDeletePresetAction = async (id: string) => {
        if (!confirm("Are you sure you want to delete this preset?")) return;
        try {
            await deleteCredentialPreset(id);
            fetchPresets();
        } catch (error) {
            console.error("Delete preset error:", error);
        }
    };

    const openEditPresetDialog = (preset: any) => {
        setIsEditingPreset(true);
        setTargetPresetId(preset.id);
        setPresetFormData({
            name: preset.name,
            config: Array.isArray(preset.config) ? preset.config : [],
        });
        setIsPresetDialogOpen(true);
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* AppBar */}
            <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20 sticky top-0">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Presets</h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / Presets</p>
                </div>

                <button
                    onClick={() => {
                        setIsEditingPreset(false);
                        setPresetFormData({ name: "", config: [] });
                        setIsPresetDialogOpen(true);
                    }}
                    className="px-6 py-3 rounded-xl bg-brand-primary text-black text-sm font-extrabold transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 shadow-xl shadow-brand-primary/10"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    NEW PRESET
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-grow p-10 overflow-y-auto bg-black relative">
                <div className="absolute top-0 right-0 w-[5000px] h-[5000px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {myPresets.map((preset) => (
                        <div
                            key={preset.id}
                            className="group bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 hover:border-brand-primary/30 transition-all duration-500 relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditPresetDialog(preset)}
                                        className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeletePresetAction(preset.id)}
                                        className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-red-500"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2 group-hover:text-brand-primary transition-colors">{preset.name}</h4>
                            <p className="text-xs text-zinc-500 mb-6 font-medium">
                                {Array.isArray(preset.config) ? preset.config.length : 0} Sections • {Array.isArray(preset.config) ? preset.config.reduce((acc: number, s: any) => acc + (s.fields?.length || 0), 0) : 0} Fields
                            </p>
                            <button
                                onClick={() => openEditPresetDialog(preset)}
                                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary hover:text-black hover:border-transparent transition-all"
                            >
                                EDIT PRESET
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => {
                            setIsEditingPreset(false);
                            setPresetFormData({ name: "", config: [] });
                            setIsPresetDialogOpen(true);
                        }}
                        className="border-2 border-dashed border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center hover:border-brand-primary/20 hover:bg-white/[0.02] transition-all group min-h-[250px]"
                    >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 mb-4 group-hover:scale-110 group-hover:text-brand-primary transition-all">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold text-zinc-500 group-hover:text-white transition-colors">Create New Preset</p>
                    </button>
                </div>
            </main>

            {/* Preset Dialog */}
            {isPresetDialogOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPresetDialogOpen(false)}></div>
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/10 h-full relative z-10 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-20">
                            <div>
                                <h3 className="text-2xl font-black text-white">{isEditingPreset ? "Edit Preset" : "New Preset"}</h3>
                                <p className="text-xs text-brand-primary uppercase tracking-[0.2em] font-bold mt-1">Configure Template</p>
                            </div>
                            <button onClick={() => setIsPresetDialogOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrUpdatePreset} className="flex-grow flex flex-col overflow-hidden">
                            <div className="flex-grow overflow-y-auto p-8 space-y-8 scrollbar-hide">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Preset Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={presetFormData.name}
                                            onChange={(e) => setPresetFormData({ ...presetFormData, name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary transition-all text-sm font-bold shadow-inner"
                                            placeholder="e.g. My Custom VPS Setup"
                                        />
                                    </div>

                                    <div className="pt-4">
                                        <div className="flex items-center justify-between mb-4 pl-1">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Configuration Builder</label>
                                            <button
                                                type="button"
                                                onClick={() => setPresetFormData({
                                                    ...presetFormData,
                                                    config: [...presetFormData.config, { id: crypto.randomUUID(), title: 'New Section', fields: [] }]
                                                })}
                                                className="px-4 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-[10px] font-black tracking-widest uppercase hover:bg-brand-primary hover:text-black transition-all"
                                            >
                                                + Section
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            {presetFormData.config.length === 0 && (
                                                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-600 text-sm bg-white/[0.01]">
                                                    Add a section to start building your template.
                                                </div>
                                            )}

                                            {presetFormData.config.map((section: any, sIdx: number) => (
                                                <div key={section.id} className="bg-white/5 border border-white/5 rounded-[2rem] p-6 relative group transition-all hover:border-white/10">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newConfig = [...presetFormData.config];
                                                            newConfig.splice(sIdx, 1);
                                                            setPresetFormData({ ...presetFormData, config: newConfig });
                                                        }}
                                                        className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>

                                                    <div className="space-y-4 mb-6">
                                                        <input
                                                            type="text"
                                                            value={section.title}
                                                            onChange={(e) => {
                                                                const newConfig = [...presetFormData.config];
                                                                newConfig[sIdx].title = e.target.value;
                                                                setPresetFormData({ ...presetFormData, config: newConfig });
                                                            }}
                                                            className="bg-transparent border-b-2 border-white/5 w-full text-white font-black focus:outline-none focus:border-brand-primary text-lg pb-2 transition-colors"
                                                            placeholder="Section Title"
                                                        />
                                                        <div className="space-y-4 mt-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Guide Links</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newConfig = [...presetFormData.config];
                                                                        if (!newConfig[sIdx].guides) newConfig[sIdx].guides = [];
                                                                        newConfig[sIdx].guides.push({ url: "", comment: "" });
                                                                        setPresetFormData({ ...presetFormData, config: newConfig });
                                                                    }}
                                                                    className="text-[10px] text-brand-primary hover:text-white font-bold transition-colors"
                                                                >
                                                                    + Add Link
                                                                </button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {section.guides?.map((guide: any, gIdx: number) => (
                                                                    <div key={gIdx} className="space-y-1 bg-black/20 p-2 rounded-xl relative group/guide border border-white/5">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newConfig = [...presetFormData.config];
                                                                                newConfig[sIdx].guides.splice(gIdx, 1);
                                                                                setPresetFormData({ ...presetFormData, config: newConfig });
                                                                            }}
                                                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/guide:opacity-100 transition-opacity text-[10px]"
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                        <input
                                                                            type="text"
                                                                            value={guide.url}
                                                                            onChange={(e) => {
                                                                                const newConfig = [...presetFormData.config];
                                                                                newConfig[sIdx].guides[gIdx].url = e.target.value;
                                                                                setPresetFormData({ ...presetFormData, config: newConfig });
                                                                            }}
                                                                            className="bg-transparent text-zinc-300 text-[10px] w-full focus:outline-none focus:text-white border-b border-white/5 pb-1 mb-1 font-mono"
                                                                            placeholder="URL (https://...)"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={guide.comment || ""}
                                                                            onChange={(e) => {
                                                                                const newConfig = [...presetFormData.config];
                                                                                newConfig[sIdx].guides[gIdx].comment = e.target.value;
                                                                                setPresetFormData({ ...presetFormData, config: newConfig });
                                                                            }}
                                                                            className="bg-transparent text-zinc-500 text-[9px] w-full focus:outline-none focus:text-white font-bold uppercase tracking-wide"
                                                                            placeholder="Link Label"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>


                                                    <div className="space-y-3 pl-4 border-l-2 border-white/5">
                                                        {section.fields?.map((field: any, fIdx: number) => (
                                                            <div key={field.id} className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/5 group/field hover:border-white/10 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="text"
                                                                        value={field.label}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...presetFormData.config];
                                                                            newConfig[sIdx].fields[fIdx].label = e.target.value;
                                                                            setPresetFormData({ ...presetFormData, config: newConfig });
                                                                        }}
                                                                        className="bg-transparent text-xs font-bold text-white border-b border-white/10 focus:border-brand-primary focus:outline-none flex-grow pb-1 placeholder:text-zinc-700"
                                                                        placeholder="Field Label"
                                                                    />
                                                                    <select
                                                                        value={field.type}
                                                                        onChange={(e) => {
                                                                            const newConfig = [...presetFormData.config];
                                                                            newConfig[sIdx].fields[fIdx].type = e.target.value;
                                                                            setPresetFormData({ ...presetFormData, config: newConfig });
                                                                        }}
                                                                        className="bg-white/5 rounded-lg px-2 py-1 text-[10px] uppercase font-bold text-zinc-400 border border-white/5 focus:outline-none focus:text-white"
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
                                                                            const newConfig = [...presetFormData.config];
                                                                            newConfig[sIdx].fields.splice(fIdx, 1);
                                                                            setPresetFormData({ ...presetFormData, config: newConfig });
                                                                        }}
                                                                        className="text-zinc-600 hover:text-red-500 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                    </button>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={field.description || ""}
                                                                    onChange={(e) => {
                                                                        const newConfig = [...presetFormData.config];
                                                                        newConfig[sIdx].fields[fIdx].description = e.target.value;
                                                                        setPresetFormData({ ...presetFormData, config: newConfig });
                                                                    }}
                                                                    className="bg-transparent px-2 text-[10px] text-zinc-500 focus:outline-none w-full focus:text-zinc-300"
                                                                    placeholder="Field description (optional)"
                                                                />
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newConfig = [...presetFormData.config];
                                                                if (!newConfig[sIdx].fields) newConfig[sIdx].fields = [];
                                                                newConfig[sIdx].fields.push({
                                                                    id: crypto.randomUUID(),
                                                                    label: 'New Field',
                                                                    type: 'text',
                                                                    required: true
                                                                });
                                                                setPresetFormData({ ...presetFormData, config: newConfig });
                                                            }}
                                                            className="text-[10px] text-zinc-500 hover:text-brand-primary font-black uppercase tracking-widest mt-2 flex items-center gap-2 py-2 px-1"
                                                        >
                                                            <span>+ Add Field</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-white/10 bg-black/40 flex items-center justify-end gap-4 shrink-0 backdrop-blur-md">
                                <button
                                    type="button"
                                    onClick={() => setIsPresetDialogOpen(false)}
                                    className="px-8 py-4 rounded-2xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all"
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="submit"
                                    disabled={!presetFormData.name || isConnecting}
                                    className="px-12 py-4 rounded-2xl bg-brand-primary text-black font-black text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isConnecting ? "SAVING..." : (isEditingPreset ? "UPDATE PRESET" : "CREATE PRESET")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
