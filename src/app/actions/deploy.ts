"use server";

import { SshSessionManager } from "@/lib/ssh-session-manager";
import { DeployConfig, DeployResult } from "@/types/deploy";
import { VpsConnectionData } from "@/app/actions/vps";

export async function initDeployment(config: VpsConnectionData, deployConfig: DeployConfig) {
    const prisma = (await import("@/lib/prisma")).default;
    const { ip, user } = config;

    // Sanitize app name
    const appName = deployConfig.appName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    const vps = await prisma.vps.findFirst({
        where: { ip: ip, user: user }
    });

    if (!vps) {
        return { success: false, message: "VPS not found in database. Please add the VPS first." };
    }

    const steps = [
        { name: "System Setup", status: "pending" },
        { name: "Directory & Backup", status: "pending" },
        { name: "Clone Repository", status: "pending" },
        { name: "Install & Build", status: "pending" },
        { name: "Start Application", status: "pending" },
        { name: "Configure Nginx", status: "pending" },
        { name: "SSL Certificate", status: "pending" }
    ];

    const deploy = await prisma.deploy.create({
        data: {
            vpsId: vps.id,
            appName: appName,
            repoUrl: deployConfig.repoUrl,
            branch: deployConfig.branch,
            port: parseInt(deployConfig.port) || 3000,
            status: 'RUNNING',
            logs: `Initializing deployment for ${appName}...\n`,
            steps: steps
        }
    });

    return { success: true, deployId: deploy.id, message: "Initialized" };
}

export async function deployProject(config: VpsConnectionData, deployConfig: DeployConfig, existingDeployId?: string): Promise<DeployResult> {
    const { ip, user, password } = config;
    let {
        appName, repoUrl, branch, token,
        gitUsername, gitPassword,
        port, startCommand, buildCommand, rootDirectory,
        domain, envVars, framework, authType
    } = deployConfig;

    // Sanitize app name
    appName = appName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    // Determine Home Directory
    const homeDir = user === 'root' ? '/root' : `/home/${user}`;

    // Database Integration
    const prisma = (await import("@/lib/prisma")).default;

    let deployRecordId = existingDeployId || null;

    // Initial steps if not provided
    const steps: any[] = [
        { name: "System Setup", status: "pending" },
        { name: "Directory & Backup", status: "pending" },
        { name: "Clone Repository", status: "pending" },
        { name: "Install & Build", status: "pending" },
        { name: "Start Application", status: "pending" },
        { name: "Configure Nginx", status: "pending" },
        { name: "SSL Certificate", status: "pending" }
    ];

    if (!deployRecordId) {
        // Fallback for direct calls
        const vps = await prisma.vps.findFirst({
            where: { ip: ip, user: user }
        });
        if (vps) {
            const deploy = await prisma.deploy.create({
                data: {
                    vpsId: vps.id,
                    appName: appName,
                    repoUrl: repoUrl,
                    branch: branch,
                    port: parseInt(port) || 3000,
                    status: 'RUNNING',
                    logs: `Starting deployment for ${appName}...\n`,
                    steps: steps
                }
            });
            deployRecordId = deploy.id;
        }
    }

    if (!deployRecordId) throw new Error("Failed to initialize deployment record");
    const sessionId = `deploy_${deployRecordId}`;

    const logs: string[] = [`Starting deployment for ${appName}...`];

    const updateDB = async (status?: string) => {
        if (!deployRecordId) return;
        try {
            await prisma.deploy.update({
                where: { id: deployRecordId },
                data: {
                    status: status || 'RUNNING',
                    steps: steps,
                    logs: logs.join('\n')
                }
            });
        } catch (e) {
            console.error("DB Update Failed", e);
        }
    };

    const updateStep = (index: number, status: 'running' | 'success' | 'failure', details?: string) => {
        steps[index].status = status;
        if (details) steps[index].details = details;
        updateDB();
    };

    const log = (msg: string) => {
        console.log(`[Deploy ${appName}] ${msg}`);
        logs.push(msg);
        updateDB(); // Realtime update
    };

    const isCancelled = async () => {
        if (!deployRecordId) return false;
        const d = await prisma.deploy.findUnique({ where: { id: deployRecordId } });
        return d?.status === 'CANCELLED';
    };

    try {
        log(`Starting deployment for ${appName}...`);

        // --- Step 0: System Setup ---
        if (await isCancelled()) throw new Error("CANCELLED");
        updateStep(0, 'running');
        log(`Connecting to ${user}@${ip}... (Home: ${homeDir})`);

        log("Checking/Installing system dependencies...");
        // Running non-interactive apt install
        const setupCmd = `export DEBIAN_FRONTEND=noninteractive && sudo apt-get update && sudo apt-get install -y git nginx nodejs npm && sudo npm install -g pm2`;
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, setupCmd);
        updateStep(0, 'success');

        // --- Step 1: Directory & Backup ---
        if (await isCancelled()) throw new Error("CANCELLED");
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
            // Check if we are redeploying (matching repo URL and branch) or if we should backup
            // For now, if it exists, we backup to avoid overwriting unless we implement a "hot update"
            // But usually users want a fresh deploy.
            const timestamp = Math.floor(Date.now() / 1000);
            const backupDir = `${baseProjectDir}_backup_${timestamp}`;
            log(`Backing up existing project to ${backupDir}...`);
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mv ${baseProjectDir} ${backupDir}`);
        }
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mkdir -p ${baseProjectDir}`);
        updateStep(1, 'success');

        // --- Step 2: Clone Repository ---
        if (await isCancelled()) throw new Error("CANCELLED");
        updateStep(2, 'running');
        let repoAuthUrl = repoUrl;

        // Handle OAuth / Deploy Key Strategy
        if (authType === 'oauth' && token) {
            log("Configuring Deploy Key for secure access...");

            // 1. Generate SSH Key for this app
            // FIX: Use dynamic homeDir
            const keyPath = `${homeDir}/.ssh/deploy_key_${appName}`;

            // Ensure .ssh dir exists
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mkdir -p ${homeDir}/.ssh && chmod 700 ${homeDir}/.ssh`);

            // Corrected key generation command
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `ssh-keygen -t ed25519 -f ${keyPath} -N "" -C "deploy_key_${appName}"`);

            // 2. Read Public Key
            const publicKey = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cat ${keyPath}.pub`);
            // Check content of publicKey carefully
            if (!publicKey || publicKey.includes("No such file") || !publicKey.startsWith("ssh-")) {
                throw new Error(`Failed to generate deploy key. Output: ${publicKey}`);
            }

            // 3. Add to GitHub
            // Extract owner and repo from URL
            // Expected format: https://github.com/owner/repo or https://github.com/owner/repo.git
            console.log(`[DEPLOY] Parsing repo URL: ${repoUrl}`);
            const cleanUrl = repoUrl.replace('.git', '').replace(/\/$/, '');
            const parts = cleanUrl.split('/'); // [https:, , github.com, owner, repo]
            const repoName = parts[parts.length - 1];
            const ownerName = parts[parts.length - 2];

            console.log(`[DEPLOY] Parsed: owner=${ownerName}, repo=${repoName}`);
            console.log(`[DEPLOY] Token length: ${token.length}, Safe prefix: ${token.substring(0, 4)}...`);

            if (ownerName && repoName) {
                const { addDeployKey } = await import("./github");
                const keyResult = await addDeployKey(token, ownerName, repoName, publicKey.trim(), `NexusVPS - ${appName} (${ip})`);
                if (!keyResult.success) {
                    console.error(`[DEPLOY] GitHub Error: ${keyResult.message}`);
                    throw new Error(`Failed to add deploy key to GitHub: ${keyResult.message}`);
                }
                log("Deploy Key added to GitHub successfully.");
            } else {
                console.error(`[DEPLOY] Failed to parse URL parts: ${parts}`);
                throw new Error("Could not parse owner/repo from URL for Deploy Key");
            }

            // 4. Configure SSH wrapper or use GIT_SSH_COMMAND for this clone
            // We use GIT_SSH_COMMAND to specify the key file
            // Use SSH URL instead of HTTPS
            repoAuthUrl = `git@github.com:${ownerName}/${repoName}.git`;

            log(`Cloning repository (${branch}) using Deploy Key...`);
            // We need to ensure known_hosts has github.com, so we scan it first
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `ssh-keyscan github.com >> ${homeDir}/.ssh/known_hosts`);

            const cloneCmd = `GIT_SSH_COMMAND='ssh -i ${keyPath} -o IdentitiesOnly=yes' git clone -b ${branch} ${repoAuthUrl} ${baseProjectDir} 2>&1`;
            const cloneOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cloneCmd);

            if (cloneOutput.toLowerCase().includes("fatal") || cloneOutput.toLowerCase().includes("error")) {
                log(`Clone output: ${cloneOutput}`);
                if (cloneOutput.includes("denied")) throw new Error("Git Access Denied. Deploy Key might not have triggered correctly.");
                throw new Error(`Git Clone failed: ${cloneOutput}`);
            }

        } else {
            // Standard Token/UserPass Clone
            if (token) {
                repoAuthUrl = repoUrl.replace("https://", `https://${token}@`);
            } else if (gitUsername && gitPassword) {
                const encodedUser = encodeURIComponent(gitUsername);
                const encodedPass = encodeURIComponent(gitPassword);
                repoAuthUrl = repoUrl.replace("https://", `https://${encodedUser}:${encodedPass}@`);
            }

            log(`Cloning repository (${branch})...`);
            // Clone into current dir (.) inside baseProjectDir
            const cloneCmd = `git clone -b ${branch} ${repoAuthUrl} ${baseProjectDir} 2>&1`;
            const cloneOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cloneCmd);

            if (cloneOutput.toLowerCase().includes("fatal") || cloneOutput.toLowerCase().includes("error")) {
                log(`Clone output: ${cloneOutput}`);
                if (cloneOutput.includes("Authentication failed")) throw new Error("Git Authentication failed.");
                if (cloneOutput.includes("Repository not found")) throw new Error("Repository not found.");
                throw new Error(`Git Clone failed: ${cloneOutput}`);
            }
        }

        // Verify clone
        log(`Verifying clone in ${appDir}...`);
        const fileCheck = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `ls -a ${appDir}`);

        if (framework === 'node' || framework === 'next') {
            if (!fileCheck.includes('package.json')) {
                log(`Directory contents: ${fileCheck}`);
                throw new Error(`Critical file missing: package.json not found in ${appDir}. Please check your root directory setting.`);
            }
            log("Verified package.json existence.");
        } else {
            if (!fileCheck || fileCheck.trim() === "." || fileCheck.trim() === "..") {
                throw new Error(`Clone failed or directory is empty: ${appDir}`);
            }
        }
        updateStep(2, 'success');

        // --- Step 3: Install & Build ---
        if (await isCancelled()) throw new Error("CANCELLED");
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
        if (await isCancelled()) throw new Error("CANCELLED");
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
        if (await isCancelled()) throw new Error("CANCELLED");
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
        if (await isCancelled()) throw new Error("CANCELLED");
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
        updateDB('SUCCESS');
        return { success: true, message: "Deployment successful", logs, steps, deployId: deployRecordId };

    } catch (error: any) {
        log(`CRITICAL ERROR: ${error.message}`);
        console.error("Deploy Error:", error);
        // Mark current running step as failed
        const runningStepIndex = steps.findIndex(s => s.status === 'running');
        if (runningStepIndex !== -1) updateStep(runningStepIndex, 'failure', error.message);

        updateDB('FAILED');
        return { success: false, message: error.message, logs, steps, deployId: deployRecordId };
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
        console.log(`[PM2] Executing: ${cmd} on ${ip}`);
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

export async function getDeployStatus(deployId: string) {
    try {
        const prisma = (await import("@/lib/prisma")).default;
        const deploy = await prisma.deploy.findUnique({
            where: { id: deployId }
        });

        if (!deploy) return { success: false, message: "Deploy not found" };

        return {
            success: true,
            status: deploy.status,
            logs: deploy.logs ? deploy.logs.split('\n') : [],
            steps: deploy.steps
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getRepoBranches(config: VpsConnectionData, appName: string) {
    const { ip, user, password } = config;
    try {
        const sessionId = `branches_${appName}_${Date.now()}`;
        const appDir = `/var/www/${appName}`;

        // Fetch all remote branches
        const cmd = `cd ${appDir} && git fetch && git branch -r`;
        const output = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);

        if (!output || output.includes("fatal") || output.includes("Not a git repository")) {
            return { success: false, branches: [] };
        }

        // Parse: origin/HEAD -> origin/main, origin/main, origin/dev
        const branches = output.split('\n')
            .map(b => b.trim())
            .filter(b => b && !b.includes('->'))
            .map(b => b.replace('origin/', ''));

        return { success: true, branches: Array.from(new Set(branches)) };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function switchBranch(config: VpsConnectionData, appName: string, branch: string) {
    const { ip, user, password } = config;
    try {
        const sessionId = `switch_${appName}_${Date.now()}`;
        const appDir = `/var/www/${appName}`;

        // Checkout branch, pull, and restart PM2
        const cmd = `cd ${appDir} && git fetch origin && git checkout ${branch} && git pull origin ${branch} && (npm install || true) && pm2 restart ${appName}`;
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);

        return { success: true, message: `Switched to ${branch} and restarted.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function stopDeployment(config: VpsConnectionData, deployId: string, appName: string) {
    console.log(`[STOP] Received request to stop deployment: ${deployId} for app: ${appName}`);
    try {
        const prisma = (await import("@/lib/prisma")).default;

        // 1. Mark as Cancelled in DB
        const current = await prisma.deploy.findUnique({ where: { id: deployId }, select: { logs: true } });
        if (!current) {
            console.error(`[STOP] Deployment ${deployId} not found`);
            return { success: false, message: "Deployment record not found" };
        }

        await prisma.deploy.update({
            where: { id: deployId },
            data: {
                status: 'CANCELLED',
                logs: (current?.logs || "") + '\n[SYSTEM] Deployment cancelled by user. Cleaning up...'
            }
        });
        console.log(`[STOP] Marked ${deployId} as CANCELLED`);

        // 2. Kill Active SSH Session for this deploy
        console.log(`[STOP] Killing SSH sessions for pattern: ${deployId}`);
        SshSessionManager.closeSessionsPattern(deployId);

        // 3. Perform Cleanup (Reusing deleteApp logic)
        console.log(`[STOP] Starting cleanup for ${appName} on ${config.ip}...`);
        const cleanupResult = await deleteApp(config, appName);
        console.log(`[STOP] Cleanup result for ${appName}:`, cleanupResult);

        return cleanupResult;
    } catch (error: any) {
        console.error(`[STOP] Stop failed for ${deployId}:`, error);
        return { success: false, message: `Stop failed: ${error.message}` };
    }
}
