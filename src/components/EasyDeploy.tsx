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

    return (
        <div className="bg-[#050505] rounded-xl border border-white/5 overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between p-4 bg-white/5 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Play size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white">Easy Deploy</h3>
                        <p className="text-xs text-zinc-500">Deploy apps from GitHub in seconds</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 flex-grow overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Config */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-400">Project Name</label>
                                <input
                                    name="appName" required
                                    value={formData.appName} onChange={handleChange}
                                    placeholder="my-app"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-400">Root Directory</label>
                                <input
                                    name="rootDirectory"
                                    value={formData.rootDirectory} onChange={handleChange}
                                    placeholder="./ (optional)"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-400">Framework</label>
                                <select
                                    name="framework"
                                    value={formData.framework} onChange={handleChange}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="node">Node.js</option>
                                    <option value="next">Next.js</option>
                                    <option value="static">Static Site</option>
                                    <option value="python">Python</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-400">Port</label>
                                <input
                                    name="port"
                                    value={formData.port} onChange={handleChange}
                                    placeholder="3000"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">GitHub Repo URL</label>
                            <div className="relative">
                                <Github className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="repoUrl" required
                                    value={formData.repoUrl} onChange={handleChange}
                                    placeholder="https://github.com/user/repo"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Git Credentials (Optional)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    name="token" type="password"
                                    value={formData.token} onChange={handleChange}
                                    placeholder="Auth Token (GHP)"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                                <input
                                    name="branch"
                                    value={formData.branch} onChange={handleChange}
                                    placeholder="Branch (main)"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    name="gitUsername"
                                    value={formData.gitUsername} onChange={handleChange}
                                    placeholder="Username"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                                <input
                                    name="gitPassword" type="password"
                                    value={formData.gitPassword} onChange={handleChange}
                                    placeholder="Password"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Runtime & Domain */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Start Command</label>
                            <div className="relative">
                                <Terminal className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="startCommand"
                                    value={formData.startCommand} onChange={handleChange}
                                    placeholder="npm start, dist/main.js"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Build Command (Optional)</label>
                            <div className="relative">
                                <input
                                    name="buildCommand"
                                    value={formData.buildCommand} onChange={handleChange}
                                    placeholder="npm run build"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Domain Name (Optional)</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                <input
                                    name="domain"
                                    value={formData.domain} onChange={handleChange}
                                    placeholder="api.example.com"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-600">Auto-configures Nginx reverse proxy</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-400">Environment Variables</label>
                            <textarea
                                name="envVars"
                                value={formData.envVars} onChange={handleChange}
                                placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=12345'}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500/50 min-h-[80px]"
                            />
                        </div>
                    </div>
                </div>

                {/* Action & Logs */}
                <div className="pt-2 border-t border-white/5 space-y-4">
                    <button
                        onClick={handleDeploy}
                        disabled={isLoading || !formData.appName || !formData.repoUrl}
                        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${isLoading
                            ? 'bg-blue-600/50 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Server size={18} />}
                        {isLoading ? "Deploying Project..." : "Deploy Application"}
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

                            <div className="mt-2 bg-black/50 rounded p-3 max-h-[200px] overflow-y-auto font-mono text-xs text-zinc-400 border border-white/5">
                                {deployStats.logs.map((log, i) => (
                                    <div key={i} className="py-0.5">{log}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
