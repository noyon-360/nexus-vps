"use client";

import { useState, useEffect } from "react";
import { getMyInvitations, acceptInvitation, rejectInvitation } from "@/app/actions/organization";

export default function InvitationList() {
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInvitations();
    }, []);

    const loadInvitations = async () => {
        setLoading(true);
        const result = await getMyInvitations();
        if (result.success) {
            setInvitations(result.invitations || []);
        }
        setLoading(false);
    };

    const handleAccept = async (token: string) => {
        const result = await acceptInvitation(token);
        if (result.success) {
            alert("Invitation accepted! You are now a member of the organization.");
            loadInvitations();
        } else {
            alert(result.error || "Failed to accept invitation");
        }
    };

    const handleReject = async (token: string) => {
        const result = await rejectInvitation(token);
        if (result.success) {
            loadInvitations();
        } else {
            alert(result.error || "Failed to reject invitation");
        }
    };

    if (loading) {
        return <div className="text-gray-400">Loading invitations...</div>;
    }

    if (invitations.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400">No pending invitations</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {invitations.map((invitation) => (
                <div
                    key={invitation.id}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {invitation.organization.name}
                            </h3>
                            <p className="text-gray-400 mb-4">
                                {invitation.organization.description || "No description"}
                            </p>

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Invited by:</span>
                                    <span className="text-white">
                                        {invitation.invitedBy.name || invitation.invitedBy.email}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Role:</span>
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${invitation.role === "ADMIN"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-gray-700 text-gray-300"
                                            }`}
                                    >
                                        {invitation.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Expires:</span>
                                    <span className="text-white">
                                        {new Date(invitation.expiresAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                            <button
                                onClick={() => handleAccept(invitation.token)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                                Accept
                            </button>
                            <button
                                onClick={() => handleReject(invitation.token)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
