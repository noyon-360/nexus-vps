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

    // Sanitize app name (alphanumeric and dashes only)
    appName = appName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    const sessionId = `deploy_${user}@${ip}_${Date.now()}`;
    const logs: string[] = [];

    const log = (msg: string) => {
        console.log(`[Deploy ${appName}] ${msg}`);
        logs.push(msg);
    };

    try {
        log(`Starting deployment for ${appName}...`);
        log(`Target: ${user}@${ip} | Port: ${port}`);

        // 1. Prepare Paths & Smart Cleanup
        const projectsRoot = `~/projects`;
        const baseProjectDir = `${projectsRoot}/${appName}`;
        const appDir = rootDirectory ? `${baseProjectDir}/${rootDirectory}` : baseProjectDir;

        // Ensure projects root exists
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mkdir -p ${projectsRoot}`);

        // Check if project exists and backup if so
        const checkDirCmd = `if [ -d "${baseProjectDir}" ]; then echo "EXISTS"; else echo "MISSING"; fi`;
        const dirStatus = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkDirCmd);

        if (dirStatus.trim() === "EXISTS") {
             const timestamp = Math.floor(Date.now() / 1000);
             const backupDir = `${baseProjectDir}_backup_${timestamp}`;
             log(`Existing project found. Backing up to ${backupDir}...`);
             // We use 'mv' to rename. 
             await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `mv ${baseProjectDir} ${backupDir}`);
             // Limit backups? (Optional: remove backups older than X? maybe later)
        }

        // 2. Fresh Clone
        let repoAuthUrl = repoUrl;
        if (token) {
            // Support both https://token@github... and https://user:token@github... 
            // GHP tokens usually work as username or password. clean way: https://token@github.com/...
            repoAuthUrl = repoUrl.replace("https://", `https://${token}@`);
        } else if (gitUsername && gitPassword) {
            repoAuthUrl = repoUrl.replace("https://", `https://${encodeURIComponent(gitUsername)}:${encodeURIComponent(gitPassword)}@`);
        }

        log(`Cloning repository (${branch})...`);
        const cloneCmd = `git clone -b ${branch} ${repoAuthUrl} ${baseProjectDir}`;
        const cloneOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cloneCmd);

        if (cloneOutput.toLowerCase().includes("fatal") || cloneOutput.toLowerCase().includes("error")) {
            if (cloneOutput.includes("Authentication failed")) {
               throw new Error("Git Authentication failed. Please check your token or credentials.");
            }
            if (cloneOutput.includes("Repository not found")) {
                throw new Error("Repository not found. Check the URL or permissions.");
            }
            // If the error is just standard stderr noise but successful, git clone usually doesn't output "fatal" unless it failed.
            if (cloneOutput.includes("fatal:")) {
                 throw new Error(`Git Clone failed: ${cloneOutput.split("fatal:")[1] || cloneOutput}`);
            }
        }

        // 3. Install Dependencies
        log("Installing dependencies...");
        // Check for lock files to decide install command
        const checkLockCmd = `if [ -f "${appDir}/yarn.lock" ]; then echo "YARN"; elif [ -f "${appDir}/pnpm-lock.yaml" ]; then echo "PNPM"; elif [ -f "${appDir}/package-lock.json" ]; then echo "NPM"; else echo "NONE"; fi`;
        const lockType = (await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkLockCmd)).trim();

        let installCmd = "";
        if (lockType === "YARN") {
             installCmd = `cd ${appDir} && yarn install --frozen-lockfile`;
        } else if (lockType === "PNPM") {
             // Assume pnpm is installed or try to install it? For now assume npm fallbacks or pnpm exists
             // corepack enable? 
             installCmd = `cd ${appDir} && npm install -g pnpm && pnpm install`;
        } else if (lockType === "NPM") {
             installCmd = `cd ${appDir} && npm ci --legacy-peer-deps`; // safety for old projects
        } else {
             // Default to npm install if no lockfile or unknown
             installCmd = `cd ${appDir} && npm install`;
        }
        
        // Skip install for static/python if not needed? 
        // Python usually needs pip install -r requirements.txt
        if (framework === 'python') {
            const checkReq = `if [ -f "${appDir}/requirements.txt" ]; then echo "YES"; else echo "NO"; fi`;
            const hasReq = (await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkReq)).trim();
            if (hasReq === "YES") {
                 installCmd = `cd ${appDir} && pip3 install -r requirements.txt`;
            } else {
                installCmd = "echo 'No requirements.txt found, skipping python install'";
            }
        } else if (framework === 'static') {
            // Static sites might use npm for build tools
             if ((await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `if [ -f "${appDir}/package.json" ]; then echo "YES"; else echo "NO"; fi`)).trim() !== "YES") {
                 installCmd = "echo 'No package.json, skipping install'";
             }
        }

        const installOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, installCmd);
        // logs.push(installOutput); // Verbose logs?

        // 4. Build
        if (buildCommand) {
            log(`Running build command: ${buildCommand}...`);
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && ${buildCommand}`);
        } else if (framework === "next" || (lockType !== "NONE" && framework !== "python" && framework !== "static")) {
             // Try to find if there is a build script
             const hasBuildScript = `cd ${appDir} && cat package.json | grep "\\"build\\":"`;
             const buildCheck = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, hasBuildScript);
             if (buildCheck.includes("build")) {
                 log("Detected build script. Running build...");
                 await SshSessionManager.executeCommand(sessionId, { ip, user, password }, `cd ${appDir} && npm run build`);
             }
        }

        // 5. Environment Variables
        if (envVars) {
            log("Configuring environment variables...");
            // Escape double quotes?? For now assume simple key=value
            const envContent = envVars;
            // We use printf to write file safely
            const writeEnvCmd = `cd ${appDir} && printf "${envContent.replace(/\n/g, '\\n').replace(/"/g, '\\"')}" > .env`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, writeEnvCmd);
        }

        // 6. Start with PM2
        log("Starting with PM2...");
        // Check if process exists and delete it first
        const checkPm2 = `pm2 describe ${appName} > /dev/null 2>&1 && pm2 delete ${appName} || echo "No process to delete"`;
        await SshSessionManager.executeCommand(sessionId, { ip, user, password }, checkPm2);

        let pm2Cmd = "";
        // Default to generic start command construction
        let script = startCommand;
        let args = "";

        if (framework === "next") {
             // Next.js production: pm2 start npm --name "app" -- start -- -p 3000
             script = "npm";
             args = ` -- start -- -p ${port}`;
        } else if (framework === "node") {
             if (startCommand.startsWith("npm")) {
                  const runScript = startCommand.split(" ")[1] || "start";
                  script = "npm";
                  args = ` -- run ${runScript} -- --port ${port}`; 
             } else {
                 if (!startCommand) startCommand = "index.js"; // Fallback
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
        
        const pm2Output = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, pm2Cmd);
        if (pm2Output.includes("ERROR")) {
            throw new Error(`PM2 Start failed: ${pm2Output}`);
        }
        
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
            const configPath = `/etc/nginx/sites-available/${appName}`;
            const linkPath = `/etc/nginx/sites-enabled/${appName}`;
            const safeConfig = nginxConfig.replace(/'/g, "'\\''");
            
            const writeNginxCmd = `echo '${safeConfig}' | sudo tee ${configPath}`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, writeNginxCmd);
            
            const symlinkCmd = `sudo ln -sf ${configPath} ${linkPath}`;
            await SshSessionManager.executeCommand(sessionId, { ip, user, password }, symlinkCmd);
            
            const reloadCmd = `sudo nginx -t && sudo systemctl reload nginx`;
            const reloadOutput = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, reloadCmd);
            
            if (reloadOutput.includes("fail") || reloadOutput.includes("error")) {
                 log("Nginx warning: Configuration might be invalid.");
                 logs.push(`Nginx output: ${reloadOutput}`);
            } else {
                 log("Nginx configured and reloaded.");
            }
        }

        log("Deployment completed successfully!");
        return { success: true, message: "Deployment successful", logs };

    } catch (error: any) {
        log(`CRITICAL ERROR: ${error.message}`);
        console.error("Deploy Error:", error);
        return { success: false, message: error.message, logs };
    }
}
