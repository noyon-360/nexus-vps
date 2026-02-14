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
                        Please provide the requested credentials for <b>{request.clientName}</b> below. data is encrypted and secure.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Dynamic Sections */}
                    {request.config?.apple && (
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-.93 3.69-.93.95 0 1.95.43 2.5 1.05-2.26 1.25-1.93 4.29.28 5.43-.59 1.77-1.47 3.65-2.55 4.68zm-4.38-16c-1.12.06-2.49.69-3.05 1.78-.63 1.25.1 2.91 1.25 2.84 1.09 0 2.59-.69 3.08-1.78.58-1.28.02-2.84-1.28-2.84z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Apple App Store</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Developer Account Access</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Apple ID Email</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                            onChange={(e) => handleInputChange('apple', 'email', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Password</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                            onChange={(e) => handleInputChange('apple', 'password', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">2FA / Security Code (if usually required)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                        placeholder="Optional - or provide recovery key"
                                        onChange={(e) => handleInputChange('apple', '2fa_note', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {request.config?.google && (
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                    {/* Google G Icon equivalent */}
                                    <span className="text-2xl font-bold text-white">G</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Google Play Console</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Developer Account</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Google Email</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                            onChange={(e) => handleInputChange('google', 'email', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Password</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                            onChange={(e) => handleInputChange('google', 'password', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Service Account JSON (Optional)</label>
                                    <div className="relative border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-brand-primary/30 transition-colors bg-black/30">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => handleFileChange('google', 'service_account', e)}
                                        />
                                        <p className="text-sm text-zinc-400 font-medium">Click to upload .json file</p>
                                        {formData.google?.service_account && <p className="text-xs text-brand-primary mt-2">File selected</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {request.config?.mongo && (
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-green-500">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">MongoDB Atlas</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Database Access</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Connection String (URI)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors font-mono text-sm"
                                        placeholder="mongodb+srv://..."
                                        onChange={(e) => handleInputChange('mongo', 'uri', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {request.config?.googleEmail && (
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <span className="text-lg font-bold text-white">@</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Google Email</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Workspace Account</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                        onChange={(e) => handleInputChange('googleEmail', 'email', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Password</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors"
                                        onChange={(e) => handleInputChange('googleEmail', 'password', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {request.config?.cloudStorage && (
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/5 transition-colors"></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Cloud Storage</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Access Keys or Config</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Sensitive Data / Config JSON</label>
                                    <textarea
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary/50 focus:outline-none transition-colors h-32 font-mono text-sm"
                                        placeholder="Paste JSON keys or access details here..."
                                        onChange={(e) => handleInputChange('cloudStorage', 'config', e.target.value)}
                                    ></textarea>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Key File (Optional)</label>
                                    <input
                                        type="file"
                                        className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                                        onChange={(e) => handleFileChange('cloudStorage', 'keyFile', e)}
                                    />
                                </div>
                            </div>
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
