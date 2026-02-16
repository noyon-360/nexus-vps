"use client";

import { useState } from "react";
import { Loader2, Terminal, Globe, Github, Server, Play, ShieldAlert } from "lucide-react";
import { DeployConfig, DeployResult } from "@/types/deploy";
import { deployProject } from "@/app/actions/deploy";
import { VpsConnectionData } from "@/app/actions/vps";

interface EasyDeployProps {
    config: VpsConnectionData;
    onSuccess?: () => void;
    onDeployStart?: () => void;
    onDeployComplete?: (result: DeployResult) => void;
}

// Easy Deploy Component with GitHub Integration
export function EasyDeploy({ config, onSuccess, onDeployStart, onDeployComplete }: EasyDeployProps) {
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
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // GitHub Integration State
    const [githubToken, setGithubToken] = useState("");
    const [repos, setRepos] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [branches, setBranches] = useState<any[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);



    const handleSelectRepo = async (repo: any) => {
        setFormData(prev => ({
            ...prev,
            repoUrl: repo.html_url,
            appName: repo.name,
            branch: repo.default_branch,
            // Guess framework
            framework:
                repo.language === 'TypeScript' || repo.language === 'JavaScript' ? 'node' :
                    repo.language === 'Python' ? 'python' :
                        'other'
        }));
        setIsPickerOpen(false); // Close picker after selection

        // Fetch Branches
        setIsLoadingBranches(true);
        setBranches([]);
        try {
            // Repo full_name is "owner/repo"
            const [owner, name] = repo.full_name.split('/');
            const result = await import("@/app/actions/github").then(mod => mod.fetchGithubBranches(githubToken, owner, name));
            if (result.success) {
                setBranches(result.branches);
            }
        } catch (e) {
            console.error("Failed to fetch branches", e);
        } finally {
            setIsLoadingBranches(false);
        }
    };

    const filteredRepos = repos.filter(r => r.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const [activeTab, setActiveTab] = useState<'activity' | 'console'>('activity');

    // Auto-fill commands based on Framework
    // ensuring we don't overwrite user changes if they switch back and forth too much, 
    // but for "Easy" deploy, opinions are good.
    const [lastFramework, setLastFramework] = useState(formData.framework);
    if (formData.framework !== lastFramework) {
        setLastFramework(formData.framework);
        if (formData.framework === 'next') {
            setFormData(prev => ({ ...prev, startCommand: "npm start", buildCommand: "npm run build" }));
        } else if (formData.framework === 'node') {
            setFormData(prev => ({ ...prev, startCommand: "dist/index.js", buildCommand: "npm install && tsc" }));
        }
    }

    const handleConnect = async () => {
        if (!githubToken) return;
        setIsConnecting(true);
        try {
            const result = await import("@/app/actions/github").then(mod => mod.fetchGithubRepos(githubToken));
            if (result.success) {
                setRepos(result.repos);
                setIsConnected(true);
                setFormData(prev => ({ ...prev, token: githubToken }));
            } else {
                setDeployStats({
                    success: false,
                    message: result.message || "Failed to connect",
                    logs: ["GitHub Connection Failed"],
                    steps: []
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDeploy = async () => {
        setIsLoading(true);
        // setDeployStats(null); // Managed by parent now
        // setActiveTab('activity'); // Managed by parent now

        if (onDeployStart) onDeployStart();

        try {
            const result = await deployProject(config, formData);
            // setDeployStats(result); // Managed by parent

            if (onDeployComplete) onDeployComplete(result);

            if (result.success && onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            const errorResult = {
                success: false,
                message: error.message,
                logs: ["Deployment failed due to client-side error."],
                steps: []
            };
            // setDeployStats(errorResult); // Managed by parent
            if (onDeployComplete) onDeployComplete(errorResult);
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
                        <h3 className="text-sm font-medium text-white">New Service</h3>
                        <p className="text-xs text-zinc-500">Deploy a new web service from GitHub</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-8 flex-grow overflow-y-auto custom-scrollbar">

                {/* 1. Source Code */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Source Code</h4>
                        {/* Status Indicator if connected */}
                        {isConnected && !isPickerOpen && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                                <Github size={10} className="text-green-400" />
                                <span className="text-[10px] font-bold text-green-400">Connected</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs text-zinc-400">GitHub Repository URL</label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <Github className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                    <input
                                        name="repoUrl" required
                                        value={formData.repoUrl} onChange={handleUrlChange}
                                        placeholder="https://github.com/username/repository"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all whitespace-nowrap ${isPickerOpen ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {isPickerOpen ? "Cancel" : (isConnected ? "Change Repo" : "Browse GitHub")}
                                </button>
                            </div>

                            {/* Integrated Picker UI */}
                            {isPickerOpen && (
                                <div className="mt-2 p-3 bg-blue-900/10 rounded-xl border border-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {!isConnected ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Connect GitHub</h5>
                                                <a
                                                    href="https://github.com/settings/tokens/new?scopes=repo&description=NexusVPS"
                                                    target="_blank"
                                                    className="text-[10px] text-zinc-500 hover:text-blue-400 underline decoration-dotted"
                                                >
                                                    Generate Token (Scope: repo)
                                                </a>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    value={githubToken}
                                                    onChange={(e) => setGithubToken(e.target.value)}
                                                    placeholder="Paste Personal Access Token (ghp_...)"
                                                    className="flex-grow bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                />
                                                <button
                                                    onClick={handleConnect}
                                                    disabled={isConnecting || !githubToken}
                                                    className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                                                >
                                                    {isConnecting ? <Loader2 className="animate-spin" size={14} /> : "Connect"}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-zinc-500">
                                                We use this token to list your repositories and clone private projects. It is only used for this session deployment.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Type to filter repositories..."
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                autoFocus
                                            />
                                            <div className="max-h-[140px] overflow-y-auto custom-scrollbar space-y-1 relative">
                                                {filteredRepos.map(repo => (
                                                    <div
                                                        key={repo.id}
                                                        onClick={() => handleSelectRepo(repo)}
                                                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${formData.repoUrl === repo.html_url ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-white/5 border border-transparent hover:border-white/5'}`}
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            {repo.private ? <ShieldAlert size={10} className="text-yellow-500 shrink-0" /> : <Globe size={10} className="text-zinc-500 shrink-0" />}
                                                            <span className="text-xs text-zinc-200 truncate">{repo.full_name}</span>
                                                        </div>
                                                        <div className="text-[9px] text-zinc-500 shrink-0">{repo.language}</div>
                                                    </div>
                                                ))}
                                                {filteredRepos.length === 0 && <div className="text-center text-[10px] text-zinc-600 py-4">No repositories found matching "{searchTerm}"</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                        <div className="space-y-2 relative">
                            <label className="text-xs text-zinc-400">Branch</label>
                            {isLoadingBranches ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-lg">
                                    <Loader2 className="animate-spin text-zinc-500" size={14} />
                                    <span className="text-xs text-zinc-500">Fetching branches...</span>
                                </div>
                            ) : (branches.length > 0 && isConnected) ? (
                                <select
                                    name="branch"
                                    value={formData.branch} onChange={handleChange}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50 appearance-none"
                                >
                                    {branches.map((b: any) => (
                                        <option key={b.name} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    name="branch"
                                    value={formData.branch} onChange={handleChange}
                                    placeholder="main"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
                                />
                            )}
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
                                <option value="node">Node.js (Backend)</option>
                                <option value="next">Next.js (Dashboard/App)</option>
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
                        {formData.framework === 'node' ? (
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400">Entry File (Main Script)</label>
                                <input
                                    name="entryFile"
                                    value={formData.entryFile || ''}
                                    onChange={handleChange}
                                    placeholder="dist/index.js"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 font-mono"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400">Start Command</label>
                                <div className="relative">
                                    <Terminal className="absolute left-3 top-2.5 text-zinc-600" size={14} />
                                    <input
                                        name="startCommand"
                                        value={formData.startCommand} onChange={handleChange}
                                        placeholder={
                                            formData.framework === 'next' ? 'npm start' :
                                                formData.framework === 'python' ? 'gunicorn app:app' :
                                                    './start.sh'
                                        }
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary/50 font-mono"
                                    />
                                </div>
                            </div>
                        )}
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

                    {/* Results / Activity Tab - REMOVED (Moved to Parent) */}
                </div>
            </div>
        </div>
    );
}
