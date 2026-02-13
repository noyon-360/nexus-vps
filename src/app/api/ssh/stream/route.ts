import { NextRequest, NextResponse } from "next/server";
import { SshSessionManager, sshSessions } from "@/lib/ssh-session-manager";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const host = searchParams.get("host");
    const user = searchParams.get("user");
    const encodedPass = searchParams.get("password");

    if (!host || !user || !encodedPass) {
        return new NextResponse("Missing credentials", { status: 400 });
    }

    let password = "";
    try {
        password = atob(encodedPass);
    } catch {
        return new NextResponse("Invalid password encoding", { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Ensure session exists or create one
                // Using host as ID for simplicity in this demo. 
                // In prod, use a unique session ID.
                const sessionId = `${user}@${host}`;
                
                // Check if session exists and recreate if stream is dead
                let session = sshSessions.get(sessionId);
                if (!session || !session.stream.writable) {
                     session = await SshSessionManager.getOrCreateSession(sessionId, { host, user, password });
                }

                // Attach data listener
                const onData = (data: Buffer) => {
                    const text = data.toString("utf-8");
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "output", data: text })}\n\n`));
                };

                const onClose = () => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "exit", data: "Connection closed" })}\n\n`));
                    } catch (e) {
                        // Controller might already be closed
                    }
                    controller.close();
                };

                session.stream.on("data", onData);
                session.stream.on("close", onClose);

                // Keep-alive loop or specific disconnect logic could go here
                
                // Cleanup listener when client disconnects (SSE standard behavior is tricky in Next.js)
                // We rely on the fact that if the controller errors (client disconnect), we stop writing.
            } catch (error: any) {
                console.error("SSE Error:", error);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", data: error.message })}\n\n`));
                controller.close();
            }
        },
        cancel() {
            // Logic to cleanup if needed, though session persists.
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
