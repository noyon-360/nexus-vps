"use server";

import { Client } from "ssh2";

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
  name: string;
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

  return new Promise((resolve) => {
    const conn = new Client();

    conn.on("ready", () => {
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
        (ls /etc/nginx/sites-enabled/ 2>/dev/null || ls /etc/apache2/sites-enabled/ 2>/dev/null || echo "No sites found")
      `;
      
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return resolve({ success: false, error: err.message });
        }

        let output = "";
        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.on("close", () => {
          conn.end();
          
          try {
            const sections = output.split(/---[A-Z]+---/);
            // sections[0] is empty or whitespace
            // sections[1] -> STATS
            // sections[2] -> PROCESSES
            // sections[3] -> DOMAINS

            const statsLines = (sections[1] || "").trim().split("\n");
            const processLines = (sections[2] || "").trim().split("\n");
            const domainLines = (sections[3] || "").trim().split("\n");

            // Helper to extract value by prefix
            const getVal = (prefix: string) => {
               const line = statsLines.find(l => l.startsWith(prefix));
               return line ? line.replace(prefix, "").trim() : "";
            };

            const cpuVal = getVal("CPU_VAL:");
            const memVal = getVal("MEM_VAL:");
            const diskVal = getVal("DISK_VAL:");
            const uptimeLine = getVal("UPTIME_VAL:");

            // Parse Uptime & Load from the full uptime output line
            // Example: 14:37:39 up 149 days, 23:01, 2 users, load average: 0.00, 0.00, 0.00
            const loadAvgMatch = uptimeLine.match(/load average:\s*(.*)/);
            const uptimeMatch = uptimeLine.match(/up\s*(.*?),/);

            // Parse Processes
            const processes: ProcessInfo[] = processLines
              .filter(line => line.includes("|"))
              .map(line => {
                const parts = line.split("|");
                // ps aux output can vary, ensure we have enough parts
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

            // Parse Domains
            const domains: DomainInfo[] = domainLines
              .filter(line => line && line !== "No sites found" && line !== "default")
              .map(name => ({
                name: name.trim(),
                status: "live", // Assuming live if enabled
                path: `/etc/system/sites/${name.trim()}`
              }));

            const finalStats: SystemStats = {
              cpu: parseFloat(cpuVal || "0").toFixed(0) + "%",
              memory: (memVal || "0") + "%",
              storage: diskVal || "0%",
              loadAvg: loadAvgMatch ? loadAvgMatch[1] : "N/A",
              uptime: uptimeMatch ? uptimeMatch[1] : "Just started",
              processes,
              domains
            };

            resolve({ success: true, stats: finalStats });
          } catch (parseError) {
            resolve({ success: false, error: "Critical telemetry parsing failure" });
          }
        });
      });
    }).on("error", (err) => {
      resolve({ success: false, error: err.message });
    }).connect({
      host: ip,
      port: 22,
      username: user,
      password: password,
      readyTimeout: 10000,
    });
  });
}
