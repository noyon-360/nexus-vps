import { Client, ClientChannel } from "ssh2";

interface SshConnection {
    client: Client;
    shell?: ClientChannel;
    lastActive: number;
    isConnecting?: Promise<SshConnection>;
}

// Global variable to hold sessions in development (to survive HMR)
const globalForSsh = global as unknown as { sshConnections: Map<string, SshConnection> };

export const sshConnections = globalForSsh.sshConnections || new Map<string, SshConnection>();

if (process.env.NODE_ENV !== "production") globalForSsh.sshConnections = sshConnections;

export class SshSessionManager {
    private static async getConnection(id: string, config: any): Promise<SshConnection> {
        let connection = sshConnections.get(id);

        // If active connection exists and ready
        if (connection && !connection.isConnecting) {
            // Check if client is still writable/connected roughly
            // ssh2 client doesn't have a simple 'connected' prop, but we can rely on 'close' event cleanup
            connection.lastActive = Date.now();
            return connection;
        }

        // If connecting, wait for it
        if (connection?.isConnecting) {
            return connection.isConnecting;
        }

        // Start new connection
        const connectPromise = new Promise<SshConnection>((resolve, reject) => {
            const client = new Client();

            client.on("ready", () => {
                const conn: SshConnection = {
                    client,
                    lastActive: Date.now()
                };
                // Remove the promise wrapper and store actual connection
                // BUT keep the promise in the map? No, map should store the struct.
                // We update the map entry to remove 'isConnecting'
                sshConnections.set(id, conn);
                resolve(conn);
            });

            client.on("error", (err) => {
                console.error(`SSH Connection Error (${id}):`, err);
                sshConnections.delete(id);
                // If we were the ones connecting, rejecting is handled by the promise
                reject(err);
            });

            client.on("close", () => {
                sshConnections.delete(id);
            });

            try {
                client.connect({
                    host: config.host || config.ip,
                    port: 22,
                    username: config.user,
                    password: config.password,
                    keepaliveInterval: 10000,
                    readyTimeout: 20000
                });
            } catch (error) {
                reject(error);
            }
        });

        // Store the promise temporarily so concurrent requests wait
        // We cast it to SshConnection for storage but handle it carefully
        const tempConn: SshConnection = {
            client: null as any, // Placeholder
            lastActive: Date.now(),
            isConnecting: connectPromise
        };
        sshConnections.set(id, tempConn);

        return connectPromise;
    }

    static async getOrCreateSession(id: string, config: any): Promise<{ client: Client; stream: ClientChannel }> {
        const conn = await this.getConnection(id, config);

        // Check if existing shell is alive
        if (conn.shell && conn.shell.writable) {
            return { client: conn.client, stream: conn.shell };
        }

        // Create new shell
        return new Promise((resolve, reject) => {
            conn.client.shell({ term: "xterm-color" }, (err, stream) => {
                if (err) {
                    // Start over if shell creation fails? or just reject
                    return reject(err);
                }
                conn.shell = stream;
                resolve({ client: conn.client, stream });
            });
        });
    }

    static async executeCommand(id: string, config: any, command: string): Promise<string> {
        const conn = await this.getConnection(id, config);

        return new Promise((resolve, reject) => {
            conn.client.exec(command, (err, stream) => {
                if (err) return reject(err);

                let output = "";
                let error = "";

                stream.on("data", (data: Buffer) => { output += data.toString(); });
                stream.on("stderr", (data: Buffer) => { error += data.toString(); });

                stream.on("close", (code: any, signal: any) => {
                    resolve(output + error); // Combine for simplicity, or handle error separately
                });
            });
        });
    }
    static closeSession(id: string) {
        const conn = sshConnections.get(id);
        if (conn) {
            console.log(`[SSH] Closing session: ${id}`);
            try {
                conn.client.end();
            } catch (e) {
                console.error(`[SSH] Error closing session ${id}:`, e);
            }
            sshConnections.delete(id);
        }
    }

    static closeSessionsByPrefix(prefix: string) {
        for (const [id, conn] of sshConnections.entries()) {
            if (id.startsWith(prefix)) {
                this.closeSession(id);
            }
        }
    }

    static closeSessionsPattern(pattern: string) {
        for (const [id, conn] of sshConnections.entries()) {
            if (id.includes(pattern)) {
                this.closeSession(id);
            }
        }
    }

    static async getSftp(id: string, config: any): Promise<any> {
        const conn = await this.getConnection(id, config);
        return new Promise((resolve, reject) => {
            conn.client.sftp((err, sftp) => {
                if (err) return reject(err);
                resolve(sftp);
            });
        });
    }
}

