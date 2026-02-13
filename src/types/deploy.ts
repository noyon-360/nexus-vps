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
    domain?: string;
    envVars?: string; // KEY=VALUE\nKEY2=VALUE
    framework: "node" | "next" | "static" | "python" | "other";
}

export interface DeployResult {
    success: boolean;
    message: string;
    logs: string[];
}
