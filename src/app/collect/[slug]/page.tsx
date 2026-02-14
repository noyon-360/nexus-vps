"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getCredentialRequestBySlug, submitCredentialData } from "@/app/actions/credentials";

export default function CollectCredentialsPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [isLoading, setIsLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Verification State
    const [isVerified, setIsVerified] = useState(false);
    const [verificationInput, setVerificationInput] = useState("");
    const [verificationError, setVerificationError] = useState("");

    // Form State
    const [formData, setFormData] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        const fetchRequest = async () => {
            try {
                const result = await getCredentialRequestBySlug(slug);
                if (result.success && result.request) {
                    setRequest(result.request);
                    // Initialize form data structure based on config
                    const initialData: any = {};
                    const config = result.request.config as Record<string, any>;
                    if (config) {
                        Object.keys(config).forEach(key => {
                            if (config[key]) {
                                initialData[key] = {};
                            }
                        });
                    }
                    setFormData(initialData);

                    // Check if already submitted
                    if (result.request.status === 'SUBMITTED') {
                        setIsSubmitted(true);
                    }
                } else {
                    setError(result.message || "Request not found");
                }
            } catch (err) {
                setError("Failed to load request");
            } finally {
                setIsLoading(false);
            }
        };

        if (slug) {
            fetchRequest();
        }
    }, [slug]);

    const handleVerification = (e: React.FormEvent) => {
        e.preventDefault();
        if (request && verificationInput.trim().toLowerCase() === request.clientName.trim().toLowerCase()) {
            setIsVerified(true);
            setVerificationError("");
        } else {
            setVerificationError("Client name does not match the request.");
        }
    };

    const handleInputChange = (section: string, field: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleFileChange = async (section: string, field: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File is too large (max 5MB)");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Store as array to support multiple files eventually? For now single file per field is fine or array.
                // Let's store as a list of strings for flexibility
                setFormData((prev: any) => {
                    const currentFiles = prev[section]?.[field] || [];
                    return {
                        ...prev,
                        [section]: {
                            ...prev[section],
                            [field]: [...(Array.isArray(currentFiles) ? currentFiles : []), base64String]
                        }
                    };
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await submitCredentialData(slug, formData);
            if (result.success) {
                setIsSubmitted(true);
            } else {
                alert(result.message || "Failed to submit data.");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred during submission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Unavailable</h1>
                    <p className="text-zinc-500">{error || "This link is invalid or has expired."}</p>
                </div>
            </div>
        );
    }

    // Step 1: Verification
    if (!isVerified && !isSubmitted) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[100px] -z-10"></div>
                <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl p-10 relative">
                    <div className="mb-8 text-center">
                        <div className="inline-block px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-bold tracking-widest uppercase mb-4">
                            Secure Onboarding
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight mb-2">Verify Identity</h1>
                        <p className="text-zinc-500 text-sm">Please enter your organization name to access the secure credential form.</p>
                    </div>

                    <form onSubmit={handleVerification} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Client Name</label>
                            <input
                                type="text"
                                value={verificationInput}
                                onChange={(e) => setVerificationInput(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-700/50 focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all text-sm font-medium"
                                placeholder="e.g. Acme Corp"
                                autoFocus
                            />
                        </div>

                        {verificationError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold text-center">
                                {verificationError}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-4 rounded-xl bg-brand-primary text-black font-bold text-xs tracking-widest uppercase hover:bg-white transition-all shadow-lg shadow-brand-primary/20"
                        >
                            Verify & Continue
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Step 3: Success State
    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-lg w-full bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>
                    <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 mx-auto mb-8">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Submission Received</h2>
                    <p className="text-zinc-500 leading-relaxed mb-8">
                        Thank you for submitting your credentials. Our team has been notified and will proceed with the deployment process. You may close this window.
                    </p>
                </div>
            </div>
        );
    }

    const renderFieldInput = (sectionId: string, field: any) => {
        const commonClasses = "w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors text-sm";

        if (field.type === 'longtext') {
            return (
                <textarea
                    required={field.required}
                    placeholder={field.placeholder}
                    className={`${commonClasses} h-32 font-mono`}
                    onChange={(e) => handleInputChange(sectionId, field.id, e.target.value)}
                />
            );
        }

        if (field.type === 'file' || field.type === 'image') {
            return (
                <div className="relative border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-brand-primary/30 transition-colors bg-black/30">
                    <input
                        type="file"
                        // accept={field.type === 'image' ? "image/*" : "*"} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => handleFileChange(sectionId, field.id, e)}
                    />
                    <div className="pointer-events-none">
                        <p className="text-sm text-zinc-400 font-medium">Click to upload {field.type === 'image' ? 'Image' : 'File'}</p>
                        {formData[sectionId]?.[field.id] && (
                            <p className="text-xs text-brand-primary mt-2 font-mono">
                                {Array.isArray(formData[sectionId][field.id])
                                    ? `${formData[sectionId][field.id].length} file(s) selected`
                                    : "File selected"}
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <input
                type={field.type === 'password' ? 'password' : 'text'}
                required={field.required}
                placeholder={field.placeholder}
                className={commonClasses}
                onChange={(e) => handleInputChange(sectionId, field.id, e.target.value)}
            />
        );
    };

    // Step 2: Main Form
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-primary/30">
            <header className="fixed top-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-xl border-b border-white/10 z-40 flex items-center justify-between px-6 md:px-12">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-black font-bold text-lg">N</div>
                    <span className="font-bold text-lg tracking-tight">Nexus VPS</span>
                </div>
                <div className="text-xs font-mono text-zinc-500">
                    SECURE ID: <span className="text-white">{slug.slice(0, 8).toUpperCase()}</span>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4 md:px-0 max-w-3xl mx-auto">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
                        Credential Collection
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-xl mx-auto">
                        Please provide the requested credentials for <b>{request.clientName}</b> below. Data is encrypted and secure.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Dynamic Sections */}
                    {Array.isArray(request.config) ? (
                        request.config.map((section: any) => (
                            <div key={section.id} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-brand-primary">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{section.title}</h3>
                                            <p className="text-xs text-zinc-500 uppercase tracking-wider">{section.description || "Secure Entry"}</p>
                                        </div>
                                    </div>
                                    {section.guides && section.guides.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {section.guides.map((guide: any, gIdx: number) => (
                                                <a
                                                    key={gIdx}
                                                    href={guide.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {guide.comment || "View Guide"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6 relative z-10">
                                    {section.fields.map((field: any) => (
                                        <div key={field.id} className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">
                                                {field.label} {field.required && <span className="text-brand-primary">*</span>}
                                            </label>

                                            {field.description && (
                                                <p className="text-[10px] text-zinc-600 ml-1 leading-relaxed">
                                                    {field.description}
                                                </p>
                                            )}

                                            {renderFieldInput(section.id, field)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        // Fallback for old requests
                        <div className="p-8 text-center border border-white/10 rounded-2xl">
                            <p className="text-zinc-500">Legacy request format detected. Please contact support.</p>
                        </div>
                    )}

                    <div className="pt-8">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-5 rounded-[1.25rem] bg-brand-primary text-black font-black text-sm tracking-[0.05em] uppercase shadow-2xl shadow-brand-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Encrypting & Submitting..." : "Submit Securely"}
                        </button>
                        <p className="text-center text-xs text-zinc-600 mt-6 flex items-center justify-center gap-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            End-to-End Encrypted Submission
                        </p>
                    </div>
                </form>
            </main>
        </div>
    );
}
