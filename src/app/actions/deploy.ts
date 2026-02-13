"use server";

import { SshSessionManager } from "@/lib/ssh-session-manager";
import { DeployConfig, DeployResult } from "@/types/deploy";
import { VpsConnectionData } from "@/app/actions/vps";

export async function deployProject(config: VpsConnectionData, deployConfig: DeployConfig): Promise<DeployResult> {
    const { ip, user, password } = config;
    const { 
        appName, repoUrl, branch, token, 
        gitUsername, gitPassword,
        port, startCommand, buildCommand, rootDirectory,
        domain, envVars, framework 
    } = deployConfig;

    const sessionId = `deploy_${user}@${ip}_${Date.now()}`;
    const logs: string[] = [];

    const log = (msg: string) => {
        console.log(`[Deploy ${appName}] ${msg}`);
        logs.push(msg);
    };

    try {
        log(`Starting deployment for ${appName}...`);

        // 1. Prepare Paths
        const baseProjectDir = `~/projects/${appName}`;
        // If rootDirectory is provided, the actual app runs from there
        const appDir = rootDirectory ? `${baseProjectDir}/${rootDirectory}` : baseProjectDir;

        let repoAuthUrl = repoUrl;
        if (token) {
            repoAuthUrl = repoUrl.replace("https://", `https://${token}@`);
        } else if (gitUsername && gitPassword) {
            repoAuthUrl = repoUrl.replace("https://", `https://${encodeURIComponent(gitUsername)}:${encodeURIComponent(gitPassword)}@`);
        }

        // 2. clone or pull
        // check if dir exists
        const checkDirCmd = `if [ -d "${baseProjectDir}" ]; then echo "EXISTS"; else echo "MISSING"; fi`;
        const dirStatus = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkDirCmd);

        if (dirStatus.trim() === "EXISTS") {
             log("Project directory exists. Pulling latest changes...");
             const pullCmd = `cd ${baseProjectDir} && git fetch && git reset --hard origin/${branch}`;
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, pullCmd);
        } else {
             log(`Cloning repository from branch ${branch}...`);
             const cloneCmd = `mkdir -p ~/projects && git clone -b ${branch} ${repoAuthUrl} ${baseProjectDir}`;
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cloneCmd);
        }

        // 3. Install Dependencies
        log("Installing dependencies...");
        // Check for lock files to decide install command
        const checkLockCmd = `if [ -f "${appDir}/yarn.lock" ]; then echo "YARN"; elif [ -f "${appDir}/package-lock.json" ]; then echo "NPM"; else echo "NONE"; fi`;
        const lockType = (await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkLockCmd)).trim();

        let installCmd = "";
        if (lockType === "YARN") {
             installCmd = `cd ${appDir} && yarn install --frozen-lockfile`;
        } else if (lockType === "NPM") {
             installCmd = `cd ${appDir} && npm ci --legacy-peer-deps`; // safety for old projects
        } else {
             installCmd = `cd ${appDir} && npm install`;
        }
        
        // Execute install
        const installOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, installCmd);
        if (installOutput.toLowerCase().includes("error") && !installOutput.includes("warn")) {
            // naive error check, strictly npm output usually has "ERR!"
        }

        // 4. Build (if nextjs/react or custom build command)
        if (buildCommand) {
            log(`Running build command: ${buildCommand}...`);
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && ${buildCommand}`);
        } else if (framework === "next" || installOutput.includes("next")) {
            log("Building Next.js application...");
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && npm run build`);
        }

        // 5. Environment Variables
        if (envVars) {
            log("Configuring environment variables...");
            // Escape double quotes?? For now assume simple key=value
            const envContent = envVars;
            // We use printf to write file safely
            const writeEnvCmd = `cd ${appDir} && printf "${envContent.replace(/\n/g, '\\n')}" > .env`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, writeEnvCmd);
        }

        // 6. Start with PM2
        log("Starting with PM2...");
        // Check if process exists and delete it first to ensure fresh config
        const checkPm2 = `pm2 describe ${appName} > /dev/null 2>&1 && pm2 delete ${appName} || echo "No process to delete"`;
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkPm2);

        let pm2Cmd = "";
        // Default to generic start command construction
        let script = startCommand;
        let args = "";

        if (framework === "next") {
             // Next.js production: pm2 start npm --name "app" -- start -- -p 3000
             // MUST run from appDir
             script = "npm";
             args = ` -- start -- -p ${port}`;
        } else if (framework === "node") {
             // standard node app
             // if startCommand is a file (e.g. dist/main.js) -> pm2 start dist/main.js --name ...
             // if startCommand is npm script -> pm2 start npm --name ... -- run start
             if (startCommand.startsWith("npm")) {
                 const runScript = startCommand.split(" ")[1] || "start";
                 script = "npm";
                 args = ` -- run ${runScript} -- --port ${port}`; 
             } else {
                 // pm2 start dist/main.js --name "app" -- --port 3000
                 args = ` -- --port ${port}`;
             }
        } else if (framework === "static") {
             // PM2 serve
             pm2Cmd = `cd ${appDir} && pm2 serve . ${port} --name "${appName}" --spa`;
        } else if (framework === "python") {
             // pm2 start script.py --interpreter python3
             pm2Cmd = `cd ${appDir} && pm2 start ${startCommand} --name "${appName}" --interpreter python3`; 
        }

        if (!pm2Cmd) {
            pm2Cmd = `cd ${appDir} && pm2 start ${script} --name "${appName}"${args}`;
        }
        
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, pm2Cmd);
        
        // Save PM2 list
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `pm2 save`);

        // 7. Nginx Configuration
        if (domain) {
            log(`Configuring Nginx for ${domain}...`);
            const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
            // Write config to temp file then move (to avoid permission issues if possible, but we need sudo for /etc/nginx)
            // Assuming user has sudo or is root. If not root, this might fail.
            const configPath = `/etc/nginx/sites-available/${appName}`;
            const linkPath = `/etc/nginx/sites-enabled/${appName}`;
            
            // We use a tricky way to write file with sudo: echo 'content' | sudo tee file
            // Escape single quotes in config?
            const safeConfig = nginxConfig.replace(/'/g, "'\\''");
            
            const writeNginxCmd = `echo '${safeConfig}' | sudo tee ${configPath}`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, writeNginxCmd);
            
            const symlinkCmd = `sudo ln -sf ${configPath} ${linkPath}`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, symlinkCmd);
            
            const reloadCmd = `sudo nginx -t && sudo systemctl reload nginx`;
            const reloadOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, reloadCmd);
            
            if (reloadOutput.includes("fail") || reloadOutput.includes("error")) {
                 log("Nginx reload failed. Check syntax.");
                 logs.push(`Nginx Error: ${reloadOutput}`);
            } else {
                 log("Nginx configured and reloaded.");
            }
        }

        log("Deployment successful!");
        return { success: true, message: "Deployment successful", logs };

    } catch (error: any) {
        log(`Error: ${error.message}`);
        console.error("Deploy Error:", error);
        return { success: false, message: error.message, logs };
    }
}
