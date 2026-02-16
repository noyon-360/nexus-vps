"use server";

import { Client } from "ssh2";
import { SshSessionManager } from "@/lib/ssh-session-manager";
import prisma from "@/lib/prisma";
import { getDynamicPrisma } from "@/lib/dynamic-db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface VpsData extends VpsConnectionData {
  clientName: string;
}

export interface VpsConnectionData {
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }
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
      echo "---PORTS---"
      (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "No port info")
    `;

    const output = await SshSessionManager.executeCommand(sessionId, { ip, user, password }, cmd);

    const sections = output.split(/---[A-Z0-9]+---/);
    const statsLines = (sections[1] || "").trim().split("\n");
    const processLines = (sections[2] || "").trim().split("\n");
    const domainLines = (sections[3] || "").trim().split("\n");
    const pm2Json = (sections[4] || "[]").trim();
    const portsOutput = (sections[5] || "").trim();

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

    // Parse ports from ss/netstat output
    // ss output format: State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
    // Example: LISTEN 0 511 *:3000 *:* users:(("node",pid=1234,fd=18))
    // netstat format: Proto Recv-Q Send-Q Local Address Foreign Address State PID/Program
    const portMap = new Map<number, string[]>(); // PID -> [ports]

    portsOutput.split('\n').forEach(line => {
      if (!line || line === "No port info") return;

      // Try to extract PID and port
      // ss format: look for pid=<number> and extract port from address
      const ssPidMatch = line.match(/pid=(\d+)/);
      const ssPortMatch = line.match(/[*:]:(\d+)\s/); // matches *:3000 or 0.0.0.0:3000

      // netstat format: look for <pid>/<program> at the end
      const netstatMatch = line.match(/(\d+)\/\S+\s*$/);
      const netstatPortMatch = line.match(/:(\d+)\s+.*?LISTEN/);

      let pid: number | null = null;
      let port: string | null = null;

      if (ssPidMatch && ssPortMatch) {
        pid = parseInt(ssPidMatch[1]);
        port = ssPortMatch[1];
      } else if (netstatMatch && netstatPortMatch) {
        pid = parseInt(netstatMatch[1]);
        port = netstatPortMatch[1];
      }

      if (pid && port) {
        if (!portMap.has(pid)) {
          portMap.set(pid, []);
        }
        if (!portMap.get(pid)!.includes(port)) {
          portMap.get(pid)!.push(port);
        }
      }
    });

    // Enrich PM2 processes with detected ports and prune
    pm2Processes = pm2Processes.map(proc => {
      const ports = portMap.get(proc.pid) || [];
      return prunePm2Process({ ...proc, ports });
    });

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
  ports?: string[];
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
    exec_interpreter: string;
    pm_exec_path: string;
    pm_out_log_path: string;
    pm_err_log_path: string;
  };
}

function prunePm2Process(proc: any): Pm2Process {
  return {
    name: proc.name,
    pid: proc.pid,
    pm_id: proc.pm_id,
    ports: proc.ports || [],
    monit: {
      memory: proc.monit?.memory || 0,
      cpu: proc.monit?.cpu || 0,
    },
    pm2_env: {
      status: proc.pm2_env?.status || 'unknown',
      restart_time: proc.pm2_env?.restart_time || 0,
      created_at: proc.pm2_env?.created_at || 0,
      pm_uptime: proc.pm2_env?.pm_uptime || 0,
      cwd: proc.pm2_env?.cwd || '',
      version: proc.pm2_env?.version || '',
      node_version: proc.pm2_env?.node_version || '',
      exec_interpreter: proc.pm2_env?.exec_interpreter || '',
      pm_exec_path: proc.pm2_env?.pm_exec_path || '',
      pm_out_log_path: proc.pm2_env?.pm_out_log_path || '',
      pm_err_log_path: proc.pm2_env?.pm_err_log_path || '',
    }
  };
}

export async function getPm2ProcessInfo(config: VpsConnectionData, domainName: string): Promise<{ success: boolean; process?: Pm2Process; fullList?: Pm2Process[]; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }
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
            const list: Pm2Process[] = JSON.parse(jsonStr).map(prunePm2Process);

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

export async function closeAllConnections(config: VpsConnectionData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }
  const { ip, user } = config;
  // We want to close all sessions related to this user and IP
  // Sessions follow patterns like: stats_user@ip, deploy_user@ip_timestamp, terminal_user@ip
  // So searching for "user@ip" should cover most of them.
  const searchPattern = `${user}@${ip}`;
  console.log(`[VPS] Closing all connections for pattern: ${searchPattern}`);

  // We can't import SshSessionManager directly if it wasn't exported or if there are circular deps, 
  // but it is imported at the top of this file.
  SshSessionManager.closeSessionsPattern(searchPattern);

  return { success: true, message: "All connections closed" };
}

export async function saveVps(data: VpsData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }

  const userId = (session.user as any).id;

  try {
    const db = await getDynamicPrisma();
    // Check if IP already exists for this user
    const existingVps = await db.vps.findUnique({
      where: {
        userId_ip: {
          userId,
          ip: data.ip,
        },
      },
    });

    if (existingVps) {
      return {
        success: false,
        message: `This IP address is already registered as "${existingVps.name}".`
      };
    }

    const vps = await db.vps.create({
      data: {
        name: data.clientName,
        ip: data.ip,
        user: data.user,
        password: data.password,
        userId,
      },
    });

    return { success: true, vps };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save VPS" };
  }
}

export async function getVpsList() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }

  const userId = (session.user as any).id;

  try {
    const db = await getDynamicPrisma();
    const vpsList = await db.vps.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, vpsList };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch VPS list" };
  }
}

export async function updateVps(id: string, data: Partial<VpsData>) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }

  const userId = (session.user as any).id;

  try {
    const db = await getDynamicPrisma();
    // Check if VPS exists and belongs to user
    const existingVps = await db.vps.findFirst({
      where: { id, userId },
    });

    if (!existingVps) {
      return { success: false, message: "VPS not found or unauthorized" };
    }

    // If IP is changing, check for uniqueness
    if (data.ip && data.ip !== existingVps.ip) {
      const duplicateIp = await db.vps.findUnique({
        where: {
          userId_ip: {
            userId,
            ip: data.ip,
          },
        },
      });

      if (duplicateIp) {
        return {
          success: false,
          message: `This IP address is already registered as "${duplicateIp.name}".`
        };
      }
    }

    const updatedVps = await db.vps.update({
      where: { id },
      data: {
        name: data.clientName,
        ip: data.ip,
        user: data.user,
        password: data.password,
      },
    });

    return { success: true, vps: updatedVps };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update VPS" };
  }
}

export async function deleteVps(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }

  const userId = (session.user as any).id;

  try {
    const db = await getDynamicPrisma();
    // Check if VPS exists and belongs to user
    const existingVps = await db.vps.findFirst({
      where: { id, userId },
    });

    if (!existingVps) {
      return { success: false, message: "VPS not found or unauthorized" };
    }

    await db.vps.delete({
      where: { id },
    });

    return { success: true, message: "VPS deleted successfully" };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete VPS" };
  }
}
