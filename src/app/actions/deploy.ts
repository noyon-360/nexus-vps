"use server";

import { SshSessionManager } from "@/lib/ssh-session-manager";
import { DeployConfig, DeployResult } from "@/types/deploy";
import { VpsConnectionData } from "@/app/actions/vps";

export async function deployProject(config: VpsConnectionData, deployConfig: DeployConfig): Promise<DeployResult> {
    const { ip, user, password } = config;
    let { 
        appName, repoUrl, branch, token, 
        gitUsername, gitPassword,
        port, startCommand, buildCommand, rootDirectory,
        domain, envVars, framework 
    } = deployConfig;

    // Sanitize app name
    appName = appName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const sessionId = `deploy_${user}@${ip}_${Date.now()}`;
    const logs: string[] = [];
    
    // Initialize Steps
    const steps: any[] = [
        { name: "System Setup", status: "pending" },
        { name: "Directory & Backup", status: "pending" },
        { name: "Clone Repository", status: "pending" },
        { name: "Install & Build", status: "pending" },
        { name: "Start Application", status: "pending" },
        { name: "Configure Nginx", status: "pending" },
        { name: "SSL Certificate", status: "pending" }
    ];

    const updateStep = (index: number, status: 'running' | 'success' | 'failure', details?: string) => {
        steps[index].status = status;
        if (details) steps[index].details = details;
    };

    const log = (msg: string) => {
        console.log(`[Deploy ${appName}] ${msg}`);
        logs.push(msg);
    };

    try {
        log(`Starting deployment for ${appName}...`);

        // --- Step 0: System Setup ---
        updateStep(0, 'running');
        log("Checking/Installing system dependencies...");
        // Running non-interactive apt install
        const setupCmd = `export DEBIAN_FRONTEND=noninteractive && sudo apt-get update && sudo apt-get install -y git nginx nodejs npm && sudo npm install -g pm2`;
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, setupCmd);
        updateStep(0, 'success');

        // --- Step 1: Directory & Backup ---
        updateStep(1, 'running');
        const projectsRoot = `/var/www`; // User requested /var/www specific path
        // Check permissions for /var/www (user needs to own it or use sudo)
        // We will try to create it with sudo and chown it to current user
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo mkdir -p ${projectsRoot} && sudo chown -R ${user}:${user} ${projectsRoot}`);
        
        const baseProjectDir = `${projectsRoot}/${appName}`;
        const appDir = rootDirectory ? `${baseProjectDir}/${rootDirectory}` : baseProjectDir;

        // Smart Backup
        const checkDirCmd = `if [ -d "${baseProjectDir}" ]; then echo "EXISTS"; else echo "MISSING"; fi`;
        const dirStatus = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkDirCmd);

        if (dirStatus.trim() === "EXISTS") {
             const timestamp = Math.floor(Date.now() / 1000);
             const backupDir = `${baseProjectDir}_backup_${timestamp}`;
             log(`Backing up existing project to ${backupDir}...`);
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mv ${baseProjectDir} ${backupDir}`);
        }
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mkdir -p ${baseProjectDir}`);
        updateStep(1, 'success');

        // --- Step 2: Clone Repository ---
        updateStep(2, 'running');
        let repoAuthUrl = repoUrl;
        if (token) {
            repoAuthUrl = repoUrl.replace("https://", `https://${token}@`);
        }
        
        log(`Cloning repository (${branch})...`);
        // Clone into current dir (.) inside baseProjectDir
        const cloneCmd = `git clone -b ${branch} ${repoAuthUrl} ${baseProjectDir}`;
        const cloneOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cloneCmd);
        
        if (cloneOutput.toLowerCase().includes("fatal") || cloneOutput.toLowerCase().includes("error")) {
            if (cloneOutput.includes("Authentication failed")) throw new Error("Git Authentication failed.");
            if (cloneOutput.includes("Repository not found")) throw new Error("Repository not found.");
            // throw new Error(`Git Clone failed: ${cloneOutput}`); // git stderr is noisy, be careful
        }
        // Verify clone
        const verifyClone = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `ls ${baseProjectDir}`);
        if (!verifyClone) throw new Error("Clone failed: Directory is empty");
        updateStep(2, 'success');

        // --- Step 3: Install & Build ---
        updateStep(3, 'running');
        log("Installing dependencies...");
        
        // npm install
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && npm install`);

        // Build
        if (framework === 'next') {
            log("Building Next.js application...");
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && npm run build`);
        } else if (buildCommand) {
             log(`Running build command: ${buildCommand}`);
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && ${buildCommand}`);
        }
        
        // Env Vars
        if (envVars) {
             log("Writing .env file...");
             const writeEnvCmd = `cd ${appDir} && printf "${envVars.replace(/\n/g, '\\n').replace(/"/g, '\\"')}" > .env`;
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, writeEnvCmd);
        }
        updateStep(3, 'success');

        // --- Step 4: Start Application ---
        updateStep(4, 'running');
        log("Starting application with PM2...");
        
        // Setup PM2 Command based on Framework
        let pm2Cmd = "";
        if (framework === 'next') {
             // Next.js: pm2 start npm --name "app" -- start -- -p 3000
             pm2Cmd = `cd ${appDir} && pm2 start npm --name "${appName}" -- start -- -p ${port}`;
        } else if (framework === 'node') {
             // Node.js: pm2 start dist/index.js --name "app"
             const script = deployConfig.entryFile || "dist/index.js";
             pm2Cmd = `cd ${appDir} && pm2 start ${script} --name "${appName}"`;
        } else {
             // Generic fallback
             const cmd = startCommand || "index.js";
             pm2Cmd = `cd ${appDir} && pm2 start ${cmd} --name "${appName}"`;
        }
        
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, pm2Cmd);
        
        // Save PM2 process list to resurrect on reboot
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, "pm2 save");
        updateStep(4, 'success');

        // --- Step 5: Configure Nginx ---
        updateStep(5, 'running');
        const serverName = domain || ip;
        if (serverName) {
            log(`Configuring Nginx for ${serverName}...`);
            const nginxConfig = `server {
    listen 80;
    server_name ${serverName};
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
            const configPath = `/etc/nginx/sites-available/${appName}`;
            const linkPath = `/etc/nginx/sites-enabled/${appName}`;
            
            // Write config
            const safeConfig = nginxConfig.replace(/'/g, "'\\''");
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `echo '${safeConfig}' | sudo tee ${configPath}`);
            
            // Enable site
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo ln -sf ${configPath} ${linkPath}`);
            
            // Verify and Restart
            const nginxTest = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo nginx -t`);
            if (nginxTest.includes("successful")) {
                 await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo systemctl restart nginx`);
                 updateStep(5, 'success');
            } else {
                 log(`Nginx validation failed: ${nginxTest}`);
                 updateStep(5, 'failure', 'Nginx config invalid');
            }
        } else {
            updateStep(5, 'success', 'Skipped (No Domain/IP)');
        }

        // --- Step 6: SSL Certificate ---
        updateStep(6, 'running');
        if (domain) {
            log("Installing SSL Certificate...");
            // Install certbot if missing
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo apt-get install -y certbot python3-certbot-nginx`);
            
            const email = "fsdteam.saa@gmail.com"; // Default for now
            const certbotCmd = `sudo certbot --nginx -d ${domain} -m ${email} --agree-tos --non-interactive --redirect`;
            
            const sslOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, certbotCmd);
            if (sslOutput.includes("Congratulations")) {
                 updateStep(6, 'success');
            } else {
                 log(`SSL installation warning: ${sslOutput}`);
                 updateStep(6, 'failure', 'Certbot failed or domain not pointing to IP');
            }
        } else {
            updateStep(6, 'success', 'Skipped (No Domain)');
        }

        log("Deployment completed successfully!");
        return { success: true, message: "Deployment successful", logs, steps };

    } catch (error: any) {
        log(`CRITICAL ERROR: ${error.message}`);
        console.error("Deploy Error:", error);
        // Mark current running step as failed
        const runningStepIndex = steps.findIndex(s => s.status === 'running');
        if (runningStepIndex !== -1) updateStep(runningStepIndex, 'failure', error.message);
        
        return { success: false, message: error.message, logs, steps };
    }
}

export async function deleteApp(config: VpsConnectionData, appName: string) {
    const { ip, user, password } = config;
    try {
        const sessionId = `delete_${appName}_${Date.now()}`;
        
        // 1. Stop and Delete PM2 Process
        try {
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `pm2 delete ${appName}`);
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `pm2 save`);
        } catch (e) {
            console.warn(`PM2 delete failed (might verify later): ${e}`);
        }

        // 2. Remove Nginx Config
        const availablePath = `/etc/nginx/sites-available/${appName}`;
        const enabledPath = `/etc/nginx/sites-enabled/${appName}`;
        
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo rm -f ${enabledPath}`);
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo rm -f ${availablePath}`);

        // 3. Reload Nginx
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo systemctl reload nginx`);
        
        // 4. Remove Project Directory
        // Sanitize again just to be safe (though input should be safe)
        const safeAppName = appName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        if (safeAppName && safeAppName.length > 1) {
             const projectDir = `/var/www/${safeAppName}`;
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `sudo rm -rf ${projectDir}`);
        }

        return { success: true, message: `Application ${appName} deleted successfully.` };
    } catch (error: any) {
        console.error("Delete app failed:", error);
        return { success: false, message: `Failed to delete app: ${error.message}` };
    }
}

export async function manageProcess(config: VpsConnectionData, appName: string, action: 'restart' | 'stop' | 'start') {
    const { ip, user, password } = config;
    try {
        const sessionId = `${action}_${appName}_${Date.now()}`;
        const cmd = `pm2 ${action} ${appName}`;
        console.log(`[PM2] Executing: ${cmd}`);
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `pm2 save`);
        
        return { success: true, message: `Process ${appName} ${action}ed.` };
    } catch (error: any) {
        console.error(`PM2 ${action} failed:`, error);
        return { success: false, message: `Failed to ${action} process: ${error.message}` };
    }
}

export async function getPm2Logs(config: VpsConnectionData, appName: string) {
    const { ip, user, password } = config;
    try {
        const sessionId = `logs_${appName}_${Date.now()}`;
        const cmd = `pm2 logs ${appName} --lines 100 --no-daemon`;
        const output = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);
        
        return { success: true, logs: output };
    } catch (error: any) {
        console.error("PM2 Logs failed:", error);
        return { success: false, message: `Failed to fetch logs: ${error.message}` };
    }
}
