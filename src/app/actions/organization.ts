"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { testDatabaseConnection, initializeOrganizationDb } from "@/lib/db-manager";
import crypto from "crypto";

/**
 * Generate a URL-safe slug from a name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Create a new organization
 */
export async function createOrganization(data: {
    name: string;
    slug?: string;
    dbUrl: string;
    description?: string;
}) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Generate slug if not provided
        const slug = data.slug || generateSlug(data.name);

        // Check if slug is already taken
        const existingOrg = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existingOrg) {
            return { success: false, error: "Organization slug already exists" };
        }

        // Test database connection
        const connectionTest = await testDatabaseConnection(data.dbUrl);
        if (!connectionTest.success) {
            return {
                success: false,
                error: `Database connection failed: ${connectionTest.error}`,
            };
        }

        // Initialize organization database
        const initResult = await initializeOrganizationDb(data.dbUrl);
        if (!initResult.success) {
            return {
                success: false,
                error: `Database initialization failed: ${initResult.error}`,
            };
        }

        // Create organization
        const organization = await prisma.organization.create({
            data: {
                name: data.name,
                slug,
                dbUrl: data.dbUrl,
                description: data.description,
                ownerId: user.id,
            },
        });

        // Add owner as a member with OWNER role
        await prisma.organizationMember.create({
            data: {
                organizationId: organization.id,
                userId: user.id,
                role: "OWNER",
            },
        });

        return { success: true, organization };
    } catch (error: any) {
        console.error("Create organization error:", error);
        return { success: false, error: error.message || "Failed to create organization" };
    }
}

/**
 * Get all organizations user owns or is a member of
 */
export async function getOrganizations() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                ownedOrganizations: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        image: true,
                                    },
                                },
                            },
                        },
                    },
                },
                organizationMemberships: {
                    include: {
                        organization: {
                            include: {
                                owner: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        image: true,
                                    },
                                },
                                members: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true,
                                                image: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Combine owned and member organizations and deduplicate by ID
        const orgMap = new Map<string, any>();

        user.ownedOrganizations.forEach((org: any) => {
            orgMap.set(org.id, {
                ...org,
                userRole: "OWNER",
            });
        });

        user.organizationMemberships.forEach((membership: any) => {
            orgMap.set(membership.organization.id, {
                ...membership.organization,
                userRole: membership.role,
            });
        });

        const organizations = Array.from(orgMap.values());

        return { success: true, organizations };
    } catch (error: any) {
        console.error("Get organizations error:", error);
        return { success: false, error: error.message || "Failed to get organizations" };
    }
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(organizationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const organization = await (prisma as any).organization.findUnique({
            where: { id: organizationId },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                image: true,
                            },
                        },
                    },
                },
                invitations: {
                    where: {
                        status: "PENDING",
                    },
                    include: {
                        invitedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!organization) {
            return { success: false, error: "Organization not found" };
        }

        // Check if user is a member
        const isMember = organization.members.some((m: any) => m.userId === user.id);
        if (!isMember) {
            return { success: false, error: "Access denied" };
        }

        // Get user's role
        const userMembership = organization.members.find((m: any) => m.userId === user.id);

        return {
            success: true,
            organization: {
                ...organization,
                userRole: userMembership?.role,
            },
        };
    } catch (error: any) {
        console.error("Get organization error:", error);
        return { success: false, error: error.message || "Failed to get organization" };
    }
}

/**
 * Update organization
 */
export async function updateOrganization(
    organizationId: string,
    data: {
        name?: string;
        description?: string;
        avatar?: string;
    }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Check if user is owner or admin
        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: user.id,
                },
            },
        });

        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
            return { success: false, error: "Access denied" };
        }

        const organization = await prisma.organization.update({
            where: { id: organizationId },
            data,
        });

        return { success: true, organization };
    } catch (error: any) {
        console.error("Update organization error:", error);
        return { success: false, error: error.message || "Failed to update organization" };
    }
}

/**
 * Delete organization
 */
export async function deleteOrganization(organizationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Check if user is owner
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            return { success: false, error: "Organization not found" };
        }

        if (organization.ownerId !== user.id) {
            return { success: false, error: "Only the owner can delete the organization" };
        }

        await (prisma as any).organization.delete({
            where: { id: organizationId },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Delete organization error:", error);
        return { success: false, error: error.message || "Failed to delete organization" };
    }
}

/**
 * Leave organization
 */
export async function leaveOrganization(organizationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Check if user is the owner
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (organization?.ownerId === user.id) {
            return { success: false, error: "Owner cannot leave the organization. Transfer ownership or delete the organization instead." };
        }

        await prisma.organizationMember.delete({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: user.id,
                },
            },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Leave organization error:", error);
        return { success: false, error: error.message || "Failed to leave organization" };
    }
}

/**
 * Search users by email
 */
export async function searchUsers(query: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        // Search for exact email match only (privacy)
        const users = await prisma.user.findMany({
            where: {
                email: {
                    equals: query,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
            },
            take: 5,
        });

        return { success: true, users };
    } catch (error: any) {
        console.error("Search users error:", error);
        return { success: false, error: error.message || "Failed to search users" };
    }
}

/**
 * Get organization members
 */
export async function getOrganizationMembers(organizationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Check if user is a member
        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: user.id,
                },
            },
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        const members = await prisma.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                joinedAt: "asc",
            },
        });

        return { success: true, members };
    } catch (error: any) {
        console.error("Get members error:", error);
        return { success: false, error: error.message || "Failed to get members" };
    }
}

/**
 * Update member role
 */
export async function updateMemberRole(
    organizationId: string,
    userId: string,
    role: string
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const currentUser = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!currentUser) {
            return { success: false, error: "User not found" };
        }

        // Check if current user is owner or admin
        const currentMembership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: currentUser.id,
                },
            },
        });

        if (!currentMembership || (currentMembership.role !== "OWNER" && currentMembership.role !== "ADMIN")) {
            return { success: false, error: "Access denied" };
        }

        // Cannot change owner's role
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (organization?.ownerId === userId) {
            return { success: false, error: "Cannot change owner's role" };
        }

        const member = await prisma.organizationMember.update({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
            data: { role },
        });

        return { success: true, member };
    } catch (error: any) {
        console.error("Update member role error:", error);
        return { success: false, error: error.message || "Failed to update member role" };
    }
}

/**
 * Remove member from organization
 */
export async function removeMember(organizationId: string, userId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const currentUser = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!currentUser) {
            return { success: false, error: "User not found" };
        }

        // Check if current user is owner or admin
        const currentMembership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: currentUser.id,
                },
            },
        });

        if (!currentMembership || (currentMembership.role !== "OWNER" && currentMembership.role !== "ADMIN")) {
            return { success: false, error: "Access denied" };
        }

        // Cannot remove owner
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (organization?.ownerId === userId) {
            return { success: false, error: "Cannot remove owner" };
        }

        await prisma.organizationMember.delete({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Remove member error:", error);
        return { success: false, error: error.message || "Failed to remove member" };
    }
}

/**
 * Send invitation
 */
export async function sendInvitation(
    organizationId: string,
    email: string,
    role: string = "MEMBER"
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const currentUser = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!currentUser) {
            return { success: false, error: "User not found" };
        }

        // Check if current user is owner or admin
        const currentMembership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: currentUser.id,
                },
            },
        });

        if (!currentMembership || (currentMembership.role !== "OWNER" && currentMembership.role !== "ADMIN")) {
            return { success: false, error: "Access denied" };
        }

        // Check if user exists
        const invitedUser = await prisma.user.findUnique({
            where: { email },
        });

        if (!invitedUser) {
            return { success: false, error: "User not found" };
        }

        // Check if user is already a member
        const existingMember = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: invitedUser.id,
                },
            },
        });

        if (existingMember) {
            return { success: false, error: "User is already a member" };
        }

        // Check if invitation already exists
        const existingInvitation = await prisma.organizationInvitation.findUnique({
            where: {
                organizationId_invitedEmail: {
                    organizationId,
                    invitedEmail: email,
                },
            },
        });

        if (existingInvitation && existingInvitation.status === "PENDING") {
            return { success: false, error: "Invitation already sent" };
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString("hex");

        // Create invitation (expires in 7 days)
        const invitation = await prisma.organizationInvitation.create({
            data: {
                organizationId,
                invitedEmail: email,
                invitedById: currentUser.id,
                role,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            include: {
                organization: true,
                invitedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return { success: true, invitation };
    } catch (error: any) {
        console.error("Send invitation error:", error);
        return { success: false, error: error.message || "Failed to send invitation" };
    }
}

/**
 * Get invitations for organization
 */
export async function getInvitations(organizationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Check if user is a member
        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: user.id,
                },
            },
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        const invitations = await prisma.organizationInvitation.findMany({
            where: { organizationId },
            include: {
                invitedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return { success: true, invitations };
    } catch (error: any) {
        console.error("Get invitations error:", error);
        return { success: false, error: error.message || "Failed to get invitations" };
    }
}

/**
 * Get invitations for current user
 */
export async function getMyInvitations() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const invitations = await prisma.organizationInvitation.findMany({
            where: {
                invitedEmail: session.user.email,
                status: "PENDING",
                expiresAt: {
                    gt: new Date(),
                },
            },
            include: {
                organization: true,
                invitedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return { success: true, invitations };
    } catch (error: any) {
        console.error("Get my invitations error:", error);
        return { success: false, error: error.message || "Failed to get invitations" };
    }
}

/**
 * Accept invitation
 */
export async function acceptInvitation(token: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const invitation = await prisma.organizationInvitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            return { success: false, error: "Invitation not found" };
        }

        if (invitation.invitedEmail !== user.email) {
            return { success: false, error: "This invitation is not for you" };
        }

        if (invitation.status !== "PENDING") {
            return { success: false, error: "Invitation has already been processed" };
        }

        if (invitation.expiresAt < new Date()) {
            return { success: false, error: "Invitation has expired" };
        }

        // Add user as member
        await prisma.organizationMember.create({
            data: {
                organizationId: invitation.organizationId,
                userId: user.id,
                role: invitation.role,
            },
        });

        // Update invitation status
        await prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: "ACCEPTED" },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Accept invitation error:", error);
        return { success: false, error: error.message || "Failed to accept invitation" };
    }
}

/**
 * Reject invitation
 */
export async function rejectInvitation(token: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const invitation = await prisma.organizationInvitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            return { success: false, error: "Invitation not found" };
        }

        if (invitation.invitedEmail !== user.email) {
            return { success: false, error: "This invitation is not for you" };
        }

        if (invitation.status !== "PENDING") {
            return { success: false, error: "Invitation has already been processed" };
        }

        await prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: "REJECTED" },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Reject invitation error:", error);
        return { success: false, error: error.message || "Failed to reject invitation" };
    }
}

/**
 * Cancel invitation
 */
export async function cancelInvitation(invitationId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const invitation = await prisma.organizationInvitation.findUnique({
            where: { id: invitationId },
        });

        if (!invitation) {
            return { success: false, error: "Invitation not found" };
        }

        // Check if user is owner/admin or the sender
        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: invitation.organizationId,
                    userId: user.id,
                },
            },
        });

        const canCancel =
            invitation.invitedById === user.id ||
            (membership && (membership.role === "OWNER" || membership.role === "ADMIN"));

        if (!canCancel) {
            return { success: false, error: "Access denied" };
        }

        await prisma.organizationInvitation.update({
            where: { id: invitationId },
            data: { status: "CANCELLED" },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Cancel invitation error:", error);
        return { success: false, error: error.message || "Failed to cancel invitation" };
    }
}
