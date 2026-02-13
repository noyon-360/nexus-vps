"use server";

import { Client } from "ssh2";
import { SshSessionManager } from "@/lib/ssh-session-manager";

interface VpsConnectionData {
  ip: string;
  user: string;
  password?: string;
}

interface ConnectionResult {
  success: boolean;
  message: string;
}

export interface ProcessInfo {
  user: string;
  pid: string;
  cpu: string;
  mem: string;
  command: string;
}

export interface DomainInfo {
  name: string; // The config filename
  file: string;
  serverNames: string[];
  status: "live" | "unknown" | "error";
  path: string;
}

export interface SystemStats {
  cpu: string;
  memory: string;
  storage: string;
  loadAvg: string;
  uptime: string;
  processes: ProcessInfo[];
  domains: DomainInfo[];
  pm2Processes?: Pm2Process[];
}

export async function testVpsConnection(formData: VpsConnectionData): Promise<ConnectionResult> {
  const { ip, user, password } = formData;
  
  return new Promise((resolve) => {
    const conn = new Client();
    
    conn.on("ready", () => {
      conn.end();
      resolve({ success: true, message: "Connected successfully" });
    })
    .on("error", (err: Error) => {
      resolve({ success: false, message: err.message });
    })
    .connect({
      host: ip,
      port: 22,
      username: user,
      password: password,
      readyTimeout: 10000,
    });
  });
}

export async function getSystemStats(config: VpsConnectionData): Promise<{ success: boolean; stats?: SystemStats; error?: string }> {
  const { ip, user, password } = config;

  try {
    const sessionId = `stats_${user}@${ip}`;
    
    // Combined command with section markers and labeled stats
    const cmd = `
      echo "---STATS---"
      top -bn1 | grep 'Cpu(s)' | awk '{print "CPU_VAL:" $2 + $4}'
      free -m | awk 'NR==2{printf "MEM_VAL:%.0f", $3*100/$2 }'
      df -h / | awk 'NR==2{print "DISK_VAL:" $5}'
      uptime | awk '{print "UPTIME_VAL:" $0}'
      echo "---PROCESSES---"
      ps aux --sort=-%cpu --no-headers | head -15 | awk '{print $1"|"$2"|"$3"|"$4"|"$11}'
      echo "---DOMAINS---"
      (grep "server_name" /etc/nginx/sites-enabled/* 2>/dev/null || grep "ServerName" /etc/apache2/sites-enabled/* 2>/dev/null || echo "No sites found")
      echo "---PM2---"
      (pm2 jlist 2>/dev/null || echo "[]")
    `;

    const output = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);
    
    const sections = output.split(/---[A-Z0-9]+---/);
    const statsLines = (sections[1] || "").trim().split("\n");
    const processLines = (sections[2] || "").trim().split("\n");
    const domainLines = (sections[3] || "").trim().split("\n");
    const pm2Json = (sections[4] || "[]").trim();

    // Helper to extract value by prefix
    const getVal = (prefix: string) => {
       const line = statsLines.find(l => l.startsWith(prefix));
       return line ? line.replace(prefix, "").trim() : "";
    };

    const cpuVal = getVal("CPU_VAL:");
    const memVal = getVal("MEM_VAL:");
    const diskVal = getVal("DISK_VAL:");
    const uptimeLine = getVal("UPTIME_VAL:");

    const loadAvgMatch = uptimeLine.match(/load average:\s*(.*)/);
    const uptimeMatch = uptimeLine.match(/up\s*(.*?),/);

    // Parse Processes
    const processes: ProcessInfo[] = processLines
      .filter(line => line.includes("|"))
      .map(line => {
        const parts = line.split("|");
        if (parts.length < 5) return null;
        const [user, pid, cpu, mem, cmd] = parts;
        return { 
          user: user || "?", 
          pid: pid || "?", 
          cpu: (cpu || "0") + "%", 
          mem: (mem || "0") + "%", 
          command: cmd ? cmd.split("/").pop() || cmd : "unknown" 
        };
      })
      .filter((p): p is ProcessInfo => p !== null);

    // Parse Domains from Config
    const domainMap = new Map<string, Set<string>>();

    domainLines.forEach(line => {
        if (!line || line === "No sites found") return;
        
        const firstColon = line.indexOf(':');
        if (firstColon === -1) return;

        const filePath = line.substring(0, firstColon).trim();
        const content = line.substring(firstColon + 1).trim();

        let cleaned = content
            .replace(/server_name/g, "")
            .replace(/ServerName/g, "")
            .replace(/;/g, "")
            .trim();
        
        const domains = cleaned.split(/\s+/).filter(d => d && d !== "_" && !d.includes("*"));

        if (!domainMap.has(filePath)) {
            domainMap.set(filePath, new Set());
        }
        domains.forEach(d => domainMap.get(filePath)?.add(d));
    });

    const domains: DomainInfo[] = Array.from(domainMap.entries()).map(([path, domainSet]) => ({
        name: path.split('/').pop() || "unknown",
        file: path,
        serverNames: Array.from(domainSet),
        status: "live",
        path: path
    }));

    // Parse PM2
    let pm2Processes: Pm2Process[] = [];
    try {
        pm2Processes = JSON.parse(pm2Json);
    } catch (e) {
        console.error("PM2 Parse Error:", e);
    }

    const stats: SystemStats = {
        cpu: cpuVal ? `${parseFloat(cpuVal).toFixed(1)}%` : "0%",
        memory: memVal ? `${memVal}` : "0",
        storage: diskVal || "0%",
        loadAvg: loadAvgMatch ? loadAvgMatch[1] : "0.00, 0.00, 0.00",
        uptime: uptimeMatch ? uptimeMatch[1] : "unknown",
        processes,
        domains,
        pm2Processes
    };

    return { success: true, stats };
  } catch (error: any) {
    console.error("Stats Error:", error);
    return { success: false, error: error.message };
  }
}

export interface Pm2Process {
  name: string;
  pid: number;
  pm_id: number;
  monit: {
    memory: number;
    cpu: number;
  };
  pm2_env: {
    status: string;
    restart_time: number;
    created_at: number;
    pm_uptime: number;
    cwd: string;
    version: string;
    node_version: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export async function getPm2ProcessInfo(config: VpsConnectionData, domainName: string): Promise<{ success: boolean; process?: Pm2Process; fullList?: Pm2Process[]; error?: string }> {
  const { ip, user, password } = config;

  return new Promise((resolve) => {
    const conn = new Client();
    
    conn.on("ready", () => {
      // Execute pm2 jlist
      // We try 'pm2' directly, if not found, we might need a full path, but usually for interactive user it is in path.
      // If the user uses nvm, it might be tricky. standard path is often /usr/local/bin/pm2 or ~/.npm-global/bin/pm2
      // Let's try a command that sources .bashrc or similar if possible, but 'pm2' is standard.
      conn.exec("pm2 jlist", (err, stream) => {
        if (err) {
            conn.end();
            resolve({ success: false, error: "Failed to execute PM2 command: " + err.message });
            return;
        }

        let output = "";
        let errorOutput = "";

        stream.on("data", (data: Buffer) => {
            output += data.toString();
        });

        stream.on("stderr", (data: Buffer) => {
            errorOutput += data.toString();
        });

        stream.on("close", () => {
            conn.end();
            try {
                // Find JSON array in output
                const start = output.indexOf("[");
                const end = output.lastIndexOf("]");
                
                if (start === -1 || end === -1) {
                    console.error("PM2 Output Error:", output, errorOutput);
                    resolve({ success: false, error: "Invalid PM2 output. Ensure PM2 is installed and running." });
                    return;
                }

                const jsonStr = output.substring(start, end + 1);
                const list: Pm2Process[] = JSON.parse(jsonStr);

                // Strategy:
                // 1. Exact match name
                // 2. Domain starts with name (e.g. app 'api' for 'api.domain.com')
                // 3. Name is in domain
                const cleanDomain = domainName.toLowerCase();
                
                let match = list.find(p => p.name.toLowerCase() === cleanDomain);
                if (!match) {
                    match = list.find(p => cleanDomain.startsWith(p.name.toLowerCase()));
                }
                if (!match) {
                    match = list.find(p => p.name.toLowerCase().includes(cleanDomain));
                }

                resolve({ success: true, process: match, fullList: list });
            } catch (e) {
                console.error("PM2 Parse Error:", e);
                resolve({ success: false, error: "Failed to parse PM2 JSON data" });
            }
        });
      });
    }).on("error", (err) => {
        resolve({ success: false, error: "SSH Connection Failed: " + err.message });
    }).connect({
        host: ip,
        port: 22,
        username: user,
        password: password,
        readyTimeout: 10000,
    });
  });
}
