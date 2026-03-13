"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BACKEND_URL = "http://13.200.253.221:3000";

export async function connectVpsToAI(vpsData: any) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const response = await fetch(`${BACKEND_URL}/vps-expert/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vpsData)
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, ...data };
        } else {
            return { success: false, error: data.error || "Failed to connect to AI Expert" };
        }
    } catch (error: any) {
        console.error("AI Connect Proxy Error:", error);
        return { success: false, error: error.message };
    }
}

export async function sendAiTask(sessionId: string, prompt: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const response = await fetch(`${BACKEND_URL}/vps-expert/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, prompt })
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, ...data };
        } else {
            return { success: false, error: data.error || "Failed to start AI task" };
        }
    } catch (error: any) {
        console.error("AI Task Proxy Error:", error);
        return { success: false, error: error.message };
    }
}
