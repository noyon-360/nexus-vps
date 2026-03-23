"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Activity, 
    Calendar, 
    ChevronRight, 
    Search, 
    BarChart3, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    XCircle,
    FileText,
    ExternalLink,
    Filter
} from "lucide-react";

interface Report {
    id: string;
    kind: string;
    agent: string;
    createdAt: string;
    reportWindow: {
        start: string;
        end: string;
    };
    topCategories: any[];
    comparison: {
        available: boolean;
        summary: string;
    };
    sources: {
        name: string;
        status: string;
        detail: string;
    }[];
    notes: string[];
    markdown: string;
    localPath: string;
}

export default function AnalyzePage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchReports = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch("http://13.202.16.50:3030/api/reports?kind=weekly_publish_trend&limit=10");
            const data = await response.json();
            if (data.ok) {
                setReports(data.reports || []);
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const filteredReports = reports.filter(report => 
        report.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.kind.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatFullDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex-grow flex flex-col h-full overflow-hidden bg-black text-white">
            {/* AppBar */}
            <header className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-[#050505]/40 backdrop-blur-xl z-20">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Activity className="w-6 h-6 text-brand-primary" />
                        Analyze Results
                    </h2>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Dashboard / Analyze</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-brand-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 transition-all w-64"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow p-10 overflow-y-auto relative">
                <div className="absolute top-0 right-0 w-[5000px] h-[5000px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
                
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 border-4 border-brand-primary/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-brand-primary rounded-full animate-spin"></div>
                        </div>
                    </div>
                ) : filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredReports.map((report, index) => (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedReport(report)}
                                className="group bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 hover:border-brand-primary/30 transition-all duration-500 hover:shadow-[0_0_50px_rgba(246,148,77,0.05)] relative overflow-hidden cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/10 transition-colors"></div>
                                
                                <div className="flex items-start justify-between mb-8 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform duration-500">
                                        <BarChart3 className="w-7 h-7" />
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                                        {report.kind.replace(/_/g, ' ')}
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8 relative z-10">
                                    <div>
                                        <h4 className="text-xl font-bold text-white group-hover:text-brand-primary transition-colors truncate">
                                            {formatDate(report.createdAt)} Report
                                        </h4>
                                        <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(report.reportWindow.start)} - {formatDate(report.reportWindow.end)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                            <Activity className="w-4 h-4 text-zinc-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Agent</p>
                                            <p className="text-sm font-medium text-zinc-300">{report.agent}</p>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold tracking-widest uppercase hover:bg-brand-primary hover:text-black hover:border-transparent transition-all duration-300 group-hover:shadow-[0_10px_30px_rgba(246,148,77,0.1)] flex items-center justify-center gap-2">
                                    View Analytics
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-zinc-600 mb-8 rotate-12">
                            <FileText className="w-12 h-12" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">No reports found</h3>
                        <p className="text-zinc-500 leading-relaxed">
                            There are no analysis reports available at the moment. Please check back later or start a new analysis.
                        </p>
                    </div>
                )}
            </main>

            {/* Report Detail Modal */}
            <AnimatePresence>
                {selectedReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 md:px-10 py-10 bg-black/90 backdrop-blur-2xl overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-5xl h-full bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(246,148,77,0.1)] relative flex flex-col overflow-hidden"
                        >
                            {/* Header Accent */}
                            <div className="h-1.5 w-full bg-brand-primary/40 absolute top-0 left-0"></div>

                            {/* Modal Header */}
                            <div className="p-8 md:p-10 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                        <BarChart3 className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">
                                                Weekly Publish Trend
                                            </h3>
                                            <span className="px-2 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-bold text-brand-primary">
                                                STABLE
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            Generated on {formatFullDate(selectedReport.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedReport(null)}
                                    className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-grow overflow-y-auto p-8 md:p-10">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                    {/* Left Column: Stats & Info */}
                                    <div className="space-y-8 lg:col-span-1">
                                        <section className="space-y-4">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Source Health</h5>
                                            <div className="space-y-3">
                                                {selectedReport.sources.map((source, i) => (
                                                    <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold text-zinc-300">{source.name}</span>
                                                            {source.status === 'ok' ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                            ) : (
                                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-zinc-500 leading-relaxed">{source.detail}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Comparison</h5>
                                            <div className="p-5 rounded-3xl border border-brand-primary/20 bg-brand-primary/5">
                                                <p className="text-sm text-zinc-300 leading-relaxed">
                                                    {selectedReport.comparison.summary}
                                                </p>
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Agent Metadata</h5>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                                    <p className="text-[10px] text-zinc-500 uppercase mb-1">Agent ID</p>
                                                    <p className="text-xs font-mono text-zinc-300 truncate">{selectedReport.agent}</p>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                                    <p className="text-[10px] text-zinc-500 uppercase mb-1">Batch ID</p>
                                                    <p className="text-xs font-mono text-zinc-300 truncate">{selectedReport.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Right Column: Markdown Content */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Full Report Content</h5>
                                            <button className="text-[10px] font-bold text-brand-primary flex items-center gap-1 hover:underline">
                                                <ExternalLink className="w-3 h-3" />
                                                EXPORT PDF
                                            </button>
                                        </div>
                                        
                                        <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 md:p-10 prose prose-invert max-w-none">
                                            <div className="whitespace-pre-wrap font-sans text-sm md:text-base text-zinc-400 leading-loose">
                                                {selectedReport.markdown}
                                            </div>
                                        </div>

                                        {selectedReport.notes && selectedReport.notes.length > 0 && (
                                            <div className="space-y-4">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Analysis Notes</h5>
                                                <ul className="space-y-3">
                                                    {selectedReport.notes.map((note, i) => (
                                                        <li key={i} className="flex gap-3 text-xs text-zinc-500 leading-relaxed">
                                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                                                            {note}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-end">
                                <button
                                    onClick={() => setSelectedReport(null)}
                                    className="px-8 py-3 rounded-xl bg-white/5 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                                >
                                    Close Report
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
