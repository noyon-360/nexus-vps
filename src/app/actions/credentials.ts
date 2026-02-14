"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export type FieldType = 'text' | 'password' | 'longtext' | 'image' | 'file';

export interface CredentialField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    description?: string;
    placeholder?: string;
}

export interface CredentialSection {
    id: string;
    title: string;
    description?: string;
    guideUrl?: string; // YouTube or Doc link
    fields: CredentialField[];
}

// Config is now a list of sections
export type CredentialRequestConfig = CredentialSection[];

// Data submission structure: key is sectionId, value is object with fieldId keys
export interface CredentialRequestData {
    [sectionId: string]: {
        [fieldId: string]: string | string[]; // string for text, string[] for multi-file/image base64
    }
}


// Admin Action: Create a new request
export async function createCredentialRequest(clientName: string, config: CredentialRequestConfig) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const request = await prisma.credentialRequest.create({
            data: {
                clientName,
                config: config as any,
                status: "PENDING",
                // Add this → very useful for your /collect/[slug] route
                slug: crypto.randomUUID().slice(0, 20), // or use nanoid, or slugify(clientName) + random suffix
            },
        });
        return { success: true, request };
    } catch (error: any) {
        console.error("Failed to create credential request:", error);
        // Better error shape for frontend
        return {
            success: false,
            message: "Could not create request. Please try again.",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        };
    }
}

// Admin Action: Get all requests
export async function getAllCredentialRequests() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const requests = await prisma.credentialRequest.findMany({
            orderBy: { createdAt: "desc" },
        });
        return { success: true, requests };
    } catch (error: any) {
        console.error("Failed to fetch credential requests:", error);
        return { success: false, message: error.message };
    }
}

// Admin Action: Delete a request
export async function deleteCredentialRequest(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await prisma.credentialRequest.delete({
            where: { id },
        });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete credential request:", error);
        return { success: false, message: error.message };
    }
}

// Public Action (Client View): Get request by slug to render form
export async function getCredentialRequestBySlug(slug: string) {
    try {
        const request = await prisma.credentialRequest.findUnique({
            where: { slug },
        });

        if (!request) {
            return { success: false, message: "Request not found" };
        }

        // Determine if we should show the form or if it's already submitted
        // For now, even if submitted, we might want to allow editing or just show "Submitted" state.
        // The requirement says "url only open after provide client name", which implies some security,
        // but the system prompt says "url only open after provide client name" which might mean a password?
        // "and the url only open after provide client name" -> This might mean a simple gatekeeping screen.
        // For now, we return the request. The UI will handle the "Client Name" check if needed,
        // though the slug is unique enough. 
        // Wait, re-reading: "make a url, and the url only open after provide client name"
        // This sounds like a secondary check. "Enter Client Name" -> if matches -> show form.

        return { success: true, request };
    } catch (error: any) {
        console.error("Failed to fetch credential request:", error);
        return { success: false, message: error.message };
    }
}

// Public Action (Client View): Submit data
export async function submitCredentialData(slug: string, data: CredentialRequestData) {
    try {
        const request = await prisma.credentialRequest.findUnique({
            where: { slug },
        });

        if (!request) {
            return { success: false, message: "Request not found" };
        }

        await prisma.credentialRequest.update({
            where: { slug },
            data: {
                data: data as any,
                status: "SUBMITTED",
            },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Failed to submit credential data:", error);
        return { success: false, message: error.message };
    }
}
