"use server";

import { SshSessionManager } from "@/lib/ssh-session-manager";
import { VpsConnectionData } from "@/app/actions/vps";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface FileItem {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    mtime?: number;
    permissions?: string;
}

export async function listFiles(config: VpsConnectionData, directoryPath: string): Promise<{ success: boolean; files?: FileItem[]; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_list_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            sftp.readdir(directoryPath, (err: any, list: any[]) => {
                sftp.end(); // Close channel
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                const files: FileItem[] = list.map(item => ({
                    name: item.filename,
                    path: directoryPath.endsWith('/') ? `${directoryPath}${item.filename}` : `${directoryPath}/${item.filename}`,
                    type: (item.attrs.isDirectory() ? 'directory' : 'file') as 'file' | 'directory',
                    size: item.attrs.size,
                    mtime: item.attrs.mtime,
                    permissions: item.longname.split(' ')[0]
                })).sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'directory' ? -1 : 1;
                });

                resolve({ success: true, files });
            });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createItem(config: VpsConnectionData, itemPath: string, type: 'file' | 'directory'): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_create_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            if (type === 'directory') {
                sftp.mkdir(itemPath, (err: any) => {
                    sftp.end();
                    if (err) resolve({ success: false, error: err.message });
                    else resolve({ success: true });
                });
            } else {
                sftp.writeFile(itemPath, '', (err: any) => {
                    sftp.end();
                    if (err) resolve({ success: false, error: err.message });
                    else resolve({ success: true });
                });
            }
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteItem(config: VpsConnectionData, itemPath: string, type: 'file' | 'directory'): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_delete_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            if (type === 'directory') {
                sftp.end(); // Close SFTP since we're using SSH for rm
                // Recursive delete is complex with SFTP, let's use SSH 'rm -rf'
                const sshSessionId = `files_rm_${config.user}@${config.ip}`;
                SshSessionManager.executeCommand(sshSessionId, config, `sudo rm -rf "${itemPath}"`)
                    .then(() => resolve({ success: true }))
                    .catch(e => resolve({ success: false, error: e.message }));
            } else {
                sftp.unlink(itemPath, (err: any) => {
                    sftp.end();
                    if (err) resolve({ success: false, error: err.message });
                    else resolve({ success: true });
                });
            }
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function renameItem(config: VpsConnectionData, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_rename_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            sftp.rename(oldPath, newPath, (err: any) => {
                sftp.end();
                if (err) resolve({ success: false, error: err.message });
                else resolve({ success: true });
            });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function uploadFile(config: VpsConnectionData, targetPath: string, fileName: string, base64Content: string): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_upload_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);
        const buffer = Buffer.from(base64Content, 'base64');
        const fullPath = targetPath.endsWith('/') ? `${targetPath}${fileName}` : `${targetPath}/${fileName}`;

        return new Promise((resolve) => {
            sftp.writeFile(fullPath, buffer, (err: any) => {
                sftp.end();
                if (err) resolve({ success: false, error: err.message });
                else resolve({ success: true });
            });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function moveItem(config: VpsConnectionData, sourcePath: string, destPath: string): Promise<{ success: boolean; error?: string }> {
    // SFTP rename works for move too
    return renameItem(config, sourcePath, destPath);
}

export async function copyItem(config: VpsConnectionData, sourcePath: string, destPath: string): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sshSessionId = `files_cp_${config.user}@${config.ip}`;
        await SshSessionManager.executeCommand(sshSessionId, config, `sudo cp -r "${sourcePath}" "${destPath}"`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function readFile(config: VpsConnectionData, filePath: string): Promise<{ success: boolean; content?: string; isBinary?: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_read_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            sftp.readFile(filePath, (err: any, buffer: Buffer) => {
                sftp.end();
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                // Simple binary check: look for null bytes or check extension
                // For now, let's treat it as text if it's UTF-8 compatible
                const content = buffer.toString('utf8');
                const isBinary = /[\x00-\x08\x0E-\x1F]/.test(content);

                if (isBinary) {
                    resolve({ success: true, content: buffer.toString('base64'), isBinary: true });
                } else {
                    resolve({ success: true, content, isBinary: false });
                }
            });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function saveFile(config: VpsConnectionData, filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const sessionId = `files_save_${config.user}@${config.ip}`;
        const sftp = await SshSessionManager.getSftp(sessionId, config);

        return new Promise((resolve) => {
            sftp.writeFile(filePath, content, (err: any) => {
                sftp.end();
                if (err) resolve({ success: false, error: err.message });
                else resolve({ success: true });
            });
        });
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
