"use client";

import { useState, useEffect } from "react";
import {
    searchUsers,
    sendInvitation,
    getOrganizationMembers,
    getInvitations,
    updateMemberRole,
    removeMember,
    cancelInvitation,
} from "@/app/actions/organization";

interface MemberManagementProps {
    organizationId: string;
    userRole: string;
}

export default function MemberManagement({
    organizationId,
    userRole,
}: MemberManagementProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState("MEMBER");

    const canManage = userRole === "OWNER" || userRole === "ADMIN";

    useEffect(() => {
        loadData();
    }, [organizationId]);

    const loadData = async () => {
        setLoading(true);
        const [membersResult, invitationsResult] = await Promise.all([
            getOrganizationMembers(organizationId),
            getInvitations(organizationId),
        ]);

        if (membersResult.success) {
            setMembers(membersResult.members || []);
        }

        if (invitationsResult.success) {
            setInvitations(invitationsResult.invitations || []);
        }

        setLoading(false);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        const result = await searchUsers(searchQuery);
        if (result.success) {
            setSearchResults(result.users || []);
        }
        setSearching(false);
    };

    const handleInvite = async (email: string) => {
        const result = await sendInvitation(organizationId, email, selectedRole);
        if (result.success) {
            alert("Invitation sent successfully!");
            setSearchQuery("");
            setSearchResults([]);
            loadData();
        } else {
            alert(result.error || "Failed to send invitation");
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        const result = await updateMemberRole(organizationId, userId, newRole);
        if (result.success) {
            loadData();
        } else {
            alert(result.error || "Failed to update role");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        const result = await removeMember(organizationId, userId);
        if (result.success) {
            loadData();
        } else {
            alert(result.error || "Failed to remove member");
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        const result = await cancelInvitation(invitationId);
        if (result.success) {
            loadData();
        } else {
            alert(result.error || "Failed to cancel invitation");
        }
    };

    if (loading) {
        return <div className="text-gray-400">Loading...</div>;
    }

    return (
        <div className="space-y-8">
            {/* User Search Section */}
            {canManage && (
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        Invite Members
                    </h3>

                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <input
                                type="email"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                                placeholder="Search by email..."
                                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            />
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            <button
                                onClick={handleSearch}
                                disabled={searching}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {searching ? "Searching..." : "Search"}
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="space-y-2">
                                {searchResults.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold">
                                                {user.name?.[0] || user.email[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">
                                                    {user.name || "No name"}
                                                </div>
                                                <div className="text-sm text-gray-400">{user.email}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleInvite(user.email)}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                                        >
                                            Invite as {selectedRole}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Current Members Section */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Members ({members.length})
                </h3>

                <div className="space-y-2">
                    {members.map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold">
                                    {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-white font-medium">
                                        {member.user.name || "No name"}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        {member.user.email}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {canManage && member.role !== "OWNER" ? (
                                    <select
                                        value={member.role}
                                        onChange={(e) =>
                                            handleRoleChange(member.userId, e.target.value)
                                        }
                                        className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="MEMBER">Member</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                ) : (
                                    <span
                                        className={`px-3 py-1 rounded text-sm font-medium ${member.role === "OWNER"
                                                ? "bg-purple-500/20 text-purple-400"
                                                : member.role === "ADMIN"
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "bg-gray-700 text-gray-300"
                                            }`}
                                    >
                                        {member.role}
                                    </span>
                                )}

                                {canManage && member.role !== "OWNER" && (
                                    <button
                                        onClick={() => handleRemoveMember(member.userId)}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pending Invitations Section */}
            {canManage && invitations.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        Pending Invitations ({invitations.length})
                    </h3>

                    <div className="space-y-2">
                        {invitations.map((invitation) => (
                            <div
                                key={invitation.id}
                                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                            >
                                <div>
                                    <div className="text-white font-medium">
                                        {invitation.invitedEmail}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        Invited by {invitation.invitedBy.name || invitation.invitedBy.email} •{" "}
                                        {new Date(invitation.createdAt).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span
                                        className={`px-3 py-1 rounded text-sm font-medium ${invitation.status === "PENDING"
                                                ? "bg-yellow-500/20 text-yellow-400"
                                                : invitation.status === "ACCEPTED"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-gray-700 text-gray-400"
                                            }`}
                                    >
                                        {invitation.status}
                                    </span>

                                    <span className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300">
                                        {invitation.role}
                                    </span>

                                    {invitation.status === "PENDING" && (
                                        <button
                                            onClick={() => handleCancelInvitation(invitation.id)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
