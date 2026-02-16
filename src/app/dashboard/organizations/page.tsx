"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getOrganizations } from "@/app/actions/organization";
import OrganizationDialog from "@/components/OrganizationDialog";
import InvitationList from "@/components/InvitationList";

export default function OrganizationsPage() {
    const router = useRouter();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showInvitations, setShowInvitations] = useState(false);

    useEffect(() => {
        loadOrganizations();
    }, []);

    const loadOrganizations = async () => {
        setLoading(true);
        const result = await getOrganizations();
        if (result.success) {
            setOrganizations(result.organizations || []);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 p-8">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Organizations</h1>
                        <p className="text-gray-400">
                            Manage your organizations and team members
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowInvitations(!showInvitations)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        >
                            {showInvitations ? "Hide Invitations" : "View Invitations"}
                        </button>
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            + Create Organization
                        </button>
                    </div>
                </div>

                {showInvitations && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            Pending Invitations
                        </h2>
                        <InvitationList />
                    </div>
                )}

                {organizations.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-12 text-center">
                        <p className="text-gray-400 mb-4">
                            You don't have any organizations yet
                        </p>
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Create Your First Organization
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {organizations.map((org) => (
                            <div
                                key={org.id}
                                className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                                onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-white mb-1">
                                            {org.name}
                                        </h3>
                                        <p className="text-sm text-gray-400">@{org.slug}</p>
                                    </div>

                                    <span
                                        className={`px-3 py-1 rounded text-xs font-medium ${org.userRole === "OWNER"
                                                ? "bg-purple-500/20 text-purple-400"
                                                : org.userRole === "ADMIN"
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "bg-gray-700 text-gray-300"
                                            }`}
                                    >
                                        {org.userRole}
                                    </span>
                                </div>

                                {org.description && (
                                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                        {org.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                            />
                                        </svg>
                                        <span>{org.members?.length || 0} members</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <OrganizationDialog
                isOpen={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onSuccess={loadOrganizations}
            />
        </div>
    );
}
