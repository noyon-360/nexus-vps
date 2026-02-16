"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Folder, File, ChevronRight, Search, Plus,
    Trash2, Edit3, RefreshCw, Upload, ArrowLeft,
    MoreVertical, FolderPlus, FilePlus, Copy, Move, X, Eye, Save
} from "lucide-react";
import {
    listFiles, createItem, deleteItem, renameItem,
    uploadFile, moveItem, copyItem, readFile, saveFile, FileItem
} from "@/app/actions/files";
import { VpsConnectionData } from "@/app/actions/vps";

interface FileExplorerProps {
    config: VpsConnectionData;
}

export function FileExplorer({ config }: FileExplorerProps) {
    const [currentPath, setCurrentPath] = useState("/var/www");
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // Modal states
    const [showNewItemModal, setShowNewItemModal] = useState<{ show: boolean, type: 'file' | 'directory' }>({ show: false, type: 'file' });
    const [newItemName, setNewItemName] = useState("");
    const [showRenameModal, setShowRenameModal] = useState<{ show: boolean, item: FileItem | null }>({ show: false, item: null });
    const [renameValue, setRenameValue] = useState("");
    const [showFileModal, setShowFileModal] = useState<{ show: boolean, file: FileItem | null }>({ show: false, file: null });
    const [fileContent, setFileContent] = useState<{ content: string, isBinary: boolean } | null>(null);
    const [isReadingFile, setIsReadingFile] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [clipboard, setClipboard] = useState<{ path: string, type: 'file' | 'directory', mode: 'copy' | 'move' } | null>(null);

    const fetchFiles = useCallback(async (path: string) => {
        setIsLoading(true);
        setError(null);
        const result = await listFiles(config, path);
        if (result.success && result.files) {
            setFiles(result.files);
        } else {
            setError(result.error || "Failed to load files");
        }
        setIsLoading(false);
    }, [config]);

    useEffect(() => {
        fetchFiles(currentPath);
    }, [currentPath, fetchFiles]);

    const handleNavigate = (path: string) => {
        setCurrentPath(path);
        setSelectedItems([]);
    };

    const handleGoBack = () => {
        const parts = currentPath.split('/').filter(p => p);
        parts.pop();
        setCurrentPath('/' + parts.join('/'));
    };

    const handleCreate = async () => {
        if (!newItemName) return;
        const targetPath = currentPath.endsWith('/') ? `${currentPath}${newItemName}` : `${currentPath}/${newItemName}`;
        const result = await createItem(config, targetPath, showNewItemModal.type);
        if (result.success) {
            setShowNewItemModal({ show: false, type: 'file' });
            setNewItemName("");
            fetchFiles(currentPath);
        } else {
            alert(result.error);
        }
    };

    const handleDelete = async (item: FileItem) => {
        if (!confirm(`Delete ${item.name}?`)) return;
        const result = await deleteItem(config, item.path, item.type);
        if (result.success) {
            fetchFiles(currentPath);
        } else {
            alert(result.error);
        }
    };

    const handleRename = async () => {
        if (!renameValue || !showRenameModal.item) return;
        const oldPath = showRenameModal.item.path;
        const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + renameValue;
        const result = await renameItem(config, oldPath, newPath);
        if (result.success) {
            setShowRenameModal({ show: false, item: null });
            setRenameValue("");
            fetchFiles(currentPath);
        } else {
            alert(result.error);
        }
    };

    const handleViewFile = async (file: FileItem) => {
        setIsReadingFile(true);
        setFileContent(null);
        setEditedContent("");
        setIsEditing(false);
        setShowFileModal({ show: true, file });

        try {
            const result = await readFile(config, file.path);
            if (result.success) {
                setFileContent({ content: result.content || "", isBinary: !!result.isBinary });
                setEditedContent(result.content || "");
            } else {
                alert(result.error || "Failed to read file");
                setShowFileModal({ show: false, file: null });
            }
        } catch (err: any) {
            alert(err.message || "An error occurred");
            setShowFileModal({ show: false, file: null });
        } finally {
            setIsReadingFile(false);
        }
    };

    const handleSave = async () => {
        if (!showFileModal.file) return;
        setIsSaving(true);
        try {
            const result = await saveFile(config, showFileModal.file.path, editedContent);
            if (result.success) {
                setFileContent({ content: editedContent, isBinary: false });
                setIsEditing(false);
            } else {
                alert(result.error || "Failed to save file");
            }
        } catch (err: any) {
            alert(err.message || "An error occurred while saving");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            const result = await uploadFile(config, currentPath, file.name, base64);
            if (result.success) {
                fetchFiles(currentPath);
            } else {
                alert(result.error);
            }
        };
        reader.readAsDataURL(file);
    };

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const breadcrumbs = currentPath.split('/').filter(p => p);

    return (
        <div className="flex flex-col h-full bg-[#050505] rounded-xl overflow-hidden border border-white/5">
            {/* Explorer Toolbar */}
            <div className="p-4 border-b border-white/5 bg-black/20 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGoBack}
                            disabled={currentPath === "/"}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 disabled:opacity-20 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">File Explorer</h4>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => fetchFiles(currentPath)}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <label className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors cursor-pointer" title="Upload">
                            <Upload className="w-4 h-4" />
                            <input type="file" className="hidden" onChange={handleUpload} />
                        </label>
                        <button
                            onClick={() => setShowNewItemModal({ show: true, type: 'directory' })}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
                            title="New Folder"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setShowNewItemModal({ show: true, type: 'file' })}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
                            title="New File"
                        >
                            <FilePlus className="w-4 h-4" />
                        </button>
                        {clipboard && (
                            <button
                                onClick={async () => {
                                    const fileName = clipboard.path.split('/').pop() || 'item';
                                    const targetPath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
                                    const result = clipboard.mode === 'copy'
                                        ? await copyItem(config, clipboard.path, targetPath)
                                        : await moveItem(config, clipboard.path, targetPath);

                                    if (result.success) {
                                        if (clipboard.mode === 'move') setClipboard(null);
                                        fetchFiles(currentPath);
                                    } else {
                                        alert(result.error);
                                    }
                                }}
                                className="p-2 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 transition-colors flex items-center gap-2 px-3 overflow-hidden animate-in fade-in slide-in-from-right-2"
                                title={`Paste ${clipboard.mode}`}
                            >
                                <Plus className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase">Paste</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Path / Breadcrumbs */}
                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button onClick={() => handleNavigate('/')} className="hover:text-white transition-colors">root</button>
                    {breadcrumbs.map((part, i) => (
                        <React.Fragment key={i}>
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <button
                                onClick={() => handleNavigate('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                                className={`hover:text-white transition-colors ${i === breadcrumbs.length - 1 ? 'text-brand-primary font-bold' : ''}`}
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-[11px] text-zinc-300 focus:outline-none focus:border-brand-primary/50 transition-colors"
                    />
                </div>
            </div>

            {/* File List */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {isLoading && files.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-600">
                        <div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Reading directory...</span>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
                        <X className="w-8 h-8 text-red-500/50" />
                        <p className="text-xs text-red-400 font-medium">{error}</p>
                        <button
                            onClick={() => fetchFiles(currentPath)}
                            className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 opacity-40">
                        <Folder className="w-8 h-8" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Empty Directory</span>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.02]">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.path}
                                className="group flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                                onClick={() => file.type === 'directory' && handleNavigate(file.path)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${file.type === 'directory' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-white/5 text-zinc-400'}`}>
                                        {file.type === 'directory' ? <Folder className="w-4 h-4 fill-current" /> : <File className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-xs font-medium truncate ${file.type === 'directory' ? 'text-zinc-200' : 'text-zinc-400'}`}>
                                            {file.name}
                                        </span>
                                        <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-mono">
                                            {file.type === 'file' && <span>{(file.size || 0 / 1024).toFixed(1)} KB</span>}
                                            {file.permissions && <span>{file.permissions}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    {file.type === 'file' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleViewFile(file); }}
                                            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                                            title="View"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setClipboard({ path: file.path, type: file.type, mode: 'copy' }); }}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                                        title="Copy"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setClipboard({ path: file.path, type: file.type, mode: 'move' }); }}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                                        title="Move"
                                    >
                                        <Move className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowRenameModal({ show: true, item: file }); setRenameValue(file.name); }}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                                        title="Rename"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showNewItemModal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                {showNewItemModal.type === 'directory' ? <FolderPlus className="w-5 h-5" /> : <FilePlus className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">New {showNewItemModal.type === 'directory' ? 'Folder' : 'File'}</h3>
                                <p className="text-[10px] text-zinc-500">Enter a name for the new item</p>
                            </div>
                        </div>
                        <input
                            autoFocus
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary/50"
                            placeholder="Name..."
                        />
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowNewItemModal({ show: false, type: 'file' })}
                                className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-400 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                className="flex-1 px-4 py-2 rounded-xl bg-brand-primary text-black hover:bg-brand-primary/90 text-[10px] font-bold transition-colors"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRenameModal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
                                <Edit3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Rename Item</h3>
                                <p className="text-[10px] text-zinc-500">Change the name of {showRenameModal.item?.name}</p>
                            </div>
                        </div>
                        <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary/50"
                            placeholder="New name..."
                        />
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowRenameModal({ show: false, item: null })}
                                className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-400 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                className="flex-1 px-4 py-2 rounded-xl bg-brand-primary text-black hover:bg-brand-primary/90 text-[10px] font-bold transition-colors"
                            >
                                Rename
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFileModal.show && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                    <File className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">{showFileModal.file?.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-mono">{showFileModal.file?.path}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!fileContent?.isBinary && !isReadingFile && (
                                    <button
                                        onClick={() => setIsEditing(!isEditing)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isEditing ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20'}`}
                                    >
                                        {isEditing ? 'Cancel Edit' : 'Edit File'}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowFileModal({ show: false, file: null });
                                        setIsEditing(false);
                                    }}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-auto p-0 bg-black/40 custom-scrollbar min-h-[400px] flex flex-col">
                            {isReadingFile ? (
                                <div className="flex-grow flex flex-col items-center justify-center gap-4 py-20">
                                    <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Reading file content...</span>
                                </div>
                            ) : fileContent?.isBinary ? (
                                <div className="flex-grow flex flex-col items-center justify-center gap-4 py-20 text-zinc-500">
                                    <X className="w-12 h-12 opacity-20" />
                                    <p className="text-xs font-medium">This is a binary file and cannot be displayed as text.</p>
                                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">BASE64 Preview Available (Binary Data)</p>
                                </div>
                            ) : isEditing ? (
                                <textarea
                                    autoFocus
                                    spellCheck={false}
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="flex-grow w-full bg-transparent text-xs font-mono text-zinc-300 p-6 focus:outline-none resize-none leading-relaxed border-none"
                                />
                            ) : (
                                <pre className="p-6 text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {fileContent?.content || "File is empty."}
                                </pre>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                            <div className="text-[10px] text-zinc-500 font-mono px-2">
                                {isEditing ? "Editing Mode" : "Read Only"}
                            </div>
                            <div className="flex gap-2">
                                {isEditing && (
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-6 py-2 rounded-xl bg-brand-primary text-black hover:bg-brand-primary/90 text-[10px] font-bold transition-colors uppercase tracking-wider flex items-center gap-2"
                                    >
                                        {isSaving ? (
                                            <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Save className="w-3 h-3" />
                                        )}
                                        Save Changes
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowFileModal({ show: false, file: null });
                                        setIsEditing(false);
                                    }}
                                    className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-400 transition-colors uppercase tracking-wider"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
