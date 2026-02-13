import { NextRequest, NextResponse } from "next/server";
import { SshSessionManager, sshConnections } from "@/lib/ssh-session-manager";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { host, user, data, cols, rows } = body;

        if (!host || !user) {
            return new NextResponse("Missing session identifiers", { status: 400 });
        }

        const sessionId = `${user}@${host}`;
        const connection = sshConnections.get(sessionId);

        if (!connection || !connection.shell) {
            return new NextResponse("Session not found", { status: 404 });
        }

        if (data) {
            connection.shell.write(data);
        }

        if (cols && rows) {
            connection.shell.setWindow(rows, cols, 0, 0);
        }

        return new NextResponse("OK", { status: 200 });
    } catch (error: any) {
        console.error("SSH Input Error:", error);
        return new NextResponse(error.message, { status: 500 });
    }
}
