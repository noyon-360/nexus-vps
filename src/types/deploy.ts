export interface DeployConfig {
    appName: string;
    repoUrl: string;
    branch: string;
    token?: string;
    gitUsername?: string;
    gitPassword?: string;
    port: string;
    startCommand: string;
    buildCommand?: string;
    rootDirectory?: string;
    entryFile?: string;
    domain?: string;
    envVars?: string; // KEY=VALUE\nKEY2=VALUE
    authType?: 'token' | 'userpass' | 'oauth';
    framework: "node" | "next" | "static" | "python" | "other";
}

export interface DeployStep {
    name: string;
    status: 'pending' | 'running' | 'success' | 'failure';
    details?: string;
}

export interface DeployResult {
    success: boolean;
    message: string;
    logs: string[];
    steps: DeployStep[];
    deployId?: string | null;
}
