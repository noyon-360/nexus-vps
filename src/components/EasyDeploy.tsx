"use client";

import { useState } from "react";
import { Loader2, Terminal, Globe, Github, Server, Play, ShieldAlert } from "lucide-react";
import { DeployConfig, DeployResult } from "@/types/deploy";
import { deployProject } from "@/app/actions/deploy";
import { VpsConnectionData } from "@/app/actions/vps";

interface EasyDeployProps {
    config: VpsConnectionData;
    onSuccess?: () => void;
}

export function EasyDeploy({ config, onSuccess }: EasyDeployProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [deployStats, setDeployStats] = useState<DeployResult | null>(null);
    const [formData, setFormData] = useState<DeployConfig>({
        appName: "",
        repoUrl: "",
        branch: "main",
        token: "",
        gitUsername: "",
        gitPassword: "",
        port: "3000",
        startCommand: "npm start",
        buildCommand: "",
        rootDirectory: "",
        domain: "",
        envVars: "",
        framework: "node"
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDeploy = async () => {
        setIsLoading(true);
        setDeployStats(null);
        try {
            const result = await deployProject(config, formData);
            setDeployStats(result);
            if (result.success && onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            setDeployStats({
                success: false,
                message: error.message,
                logs: ["Deployment failed due to client-side error."]
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        const updates: any = { repoUrl: url };

        // Auto-extract app name from URL if name is empty
        if (url && !formData.appName) {
            try {
                // Handle https://github.com/user/repo.git or https://github.com/user/repo
                const parts = url.replace('.git', '').split('/').filter(Boolean);
                const name = parts[parts.length - 1];
                if (name) {
                    updates.appName = name;
                }
            } catch (e) {
                // ignore parsing errors
            }
        }
        setFormData({ ...formData, ...updates });
    };

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    return (
        <div className="bg-[#050505] rounded-xl border border-white/5 overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between p-4 bg-white/5 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Play size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white">New Service</h3>
                        <p className="text-xs text-zinc-500">Deploy a new web service from GitHub</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-8 flex-grow overflow-y-auto custom-scrollbar">

                {/* 1. Source Code */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Source Code</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs text-zinc-400">GitHub Repository URL</label>
                            <div className="relative">
                                <Github className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="repoUrl" required
                                    value={formData.repoUrl} onChange={handleUrlChange}
                                    placeholder="https://github.com/username/repository"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Branch</label>
                            <input
                                name="branch"
                                value={formData.branch} onChange={handleChange}
                                placeholder="main"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Project Details */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Project Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Name</label>
                            <input
                                name="appName" required
                                value={formData.appName} onChange={handleChange}
                                placeholder="my-awesome-app"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                            />
                            <p className="text-[10px] text-zinc-600">Unique identifier for this service.</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Language / Framework</label>
                            <select
                                name="framework"
                                value={formData.framework} onChange={handleChange}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50 appearance-none"
                            >
                                <option value="node">Node.js</option>
                                <option value="next">Next.js</option>
                                <option value="static">Static Site (HTML/JS)</option>
                                <option value="python">Python</option>
                                <option value="other">Other / Docker</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 3. Build & Start Commands */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Build & Start</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Build Command</label>
                            <input
                                name="buildCommand"
                                value={formData.buildCommand} onChange={handleChange}
                                placeholder={formData.framework === 'static' ? 'npm run build' : 'npm install'}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Start Command</label>
                            <div className="relative">
                                <Terminal className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="startCommand"
                                    value={formData.startCommand} onChange={handleChange}
                                    placeholder={
                                        formData.framework === 'node' ? 'npm start' :
                                            formData.framework === 'python' ? 'gunicorn app:app' :
                                                './start.sh'
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 font-mono"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs text-zinc-400">Root Directory (Optional)</label>
                            <input
                                name="rootDirectory"
                                value={formData.rootDirectory} onChange={handleChange}
                                placeholder="./"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 font-mono"
                            />
                            <p className="text-[10px] text-zinc-600">If your app is in a subdirectory (monorepo), specify it here.</p>
                        </div>
                    </div>
                </div>

                {/* 4. Networking */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Networking</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Port</label>
                            <input
                                name="port"
                                value={formData.port} onChange={handleChange}
                                placeholder="3000"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50 font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Custom Domain</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="domain"
                                    value={formData.domain} onChange={handleChange}
                                    placeholder="api.example.com"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Advanced (Collapsible) */}
                <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                    <button
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="w-full flex items-center justify-between p-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <span>Advanced Settings</span>
                        <span className={`transform transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isAdvancedOpen && (
                        <div className="p-4 space-y-6 bg-black/40 border-t border-white/5">
                            {/* Env Vars */}
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400">Environment Variables</label>
                                <textarea
                                    name="envVars"
                                    value={formData.envVars} onChange={handleChange}
                                    placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=12345'}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-zinc-300 font-mono focus:outline-none focus:border-brand-primary/50 min-h-[100px]"
                                />
                            </div>

                            {/* Private Git Config */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert size={14} className="text-zinc-500" />
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Private Repository Access</label>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">Personal Access Token (Preferred)</label>
                                        <input
                                            name="token" type="password"
                                            value={formData.token} onChange={handleChange}
                                            placeholder="ghp_..."
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                        />
                                    </div>
                                    <div className="relative flex items-center gap-4 py-2">
                                        <div className="h-px bg-white/5 flex-grow"></div>
                                        <span className="text-[10px] text-zinc-600 uppercase">OR WITH USER/PASS</span>
                                        <div className="h-px bg-white/5 flex-grow"></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            name="gitUsername"
                                            value={formData.gitUsername} onChange={handleChange}
                                            placeholder="Git Username"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                        />
                                        <input
                                            name="gitPassword" type="password"
                                            value={formData.gitPassword} onChange={handleChange}
                                            placeholder="Git Password"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/5 space-y-4 pb-4">
                    <button
                        onClick={handleDeploy}
                        disabled={isLoading || !formData.appName || !formData.repoUrl}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold tracking-wide text-sm transition-all shadow-xl ${isLoading
                            ? 'bg-brand-primary/20 text-brand-primary cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-brand-primary hover:from-blue-500 hover:to-brand-primary/80 text-white shadow-blue-900/20 hover:shadow-blue-900/40 transform hover:-translate-y-0.5'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Server size={18} />}
                        {isLoading ? "INITIALIZING DEPLOYMENT..." : "CREATE WEB SERVICE"}
                    </button>

                    {deployStats && (
                        <div className={`p-4 rounded-lg border ${deployStats.success ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {deployStats.success ? (
                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                ) : (
                                    <ShieldAlert size={16} className="text-red-500" />
                                )}
                                <span className={`text-sm font-medium ${deployStats.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {deployStats.message}
                                </span>
                            </div>

                            <div className="mt-2 bg-black/50 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-[10px] text-zinc-400 border border-white/5">
                                {deployStats.logs.map((log, i) => (
                                    <div key={i} className="py-0.5 border-b border-white/5 last:border-0">{log}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
