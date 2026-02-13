import { Client, ClientChannel } from "ssh2";

interface Session {
    client: Client;
    stream: ClientChannel;
    lastActive: number;
}

// Global variable to hold sessions in development (to survive HMR)
const globalForSsh = global as unknown as { sshSessions: Map<string, Session> };

export const sshSessions = globalForSsh.sshSessions || new Map<string, Session>();

if (process.env.NODE_ENV !== "production") globalForSsh.sshSessions = sshSessions;

export class SshSessionManager {
    static async getOrCreateSession(id: string, config: any): Promise<Session> {
        if (sshSessions.has(id)) {
            const session = sshSessions.get(id)!;
            // Check if stream is writable
            if (session.stream.writable) {
                session.lastActive = Date.now();
                return session;
            }
            // If not writable, cleanup and reconnect
            session.client.end();
            sshSessions.delete(id);
        }

        return new Promise((resolve, reject) => {
            const client = new Client();
            
            client.on("ready", () => {
                client.shell({ term: "xterm-color" }, (err, stream) => {
                    if (err) {
                        client.end();
                        return reject(err);
                    }
                    
                    const session: Session = {
                        client,
                        stream,
                        lastActive: Date.now()
                    };
                    
                    sshSessions.set(id, session);
                    resolve(session);
                });
            });

            client.on("error", (err) => {
                console.error(`SSH Connection Error (${id}):`, err);
                sshSessions.delete(id);
                reject(err);
            });
            
            client.on("close", () => {
                 sshSessions.delete(id);
            });

            try {
                client.connect({
                    host: config.host,
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
    }

    static getSession(id: string): Session | undefined {
        return sshSessions.get(id);
    }

    static splitToLines(data: string): string[] {
        return data.split(/\r?\n/);
    }
}
