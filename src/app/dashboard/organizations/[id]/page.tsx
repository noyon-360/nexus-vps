"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    getOrganizationById,
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
} from "@/app/actions/organization";
import MemberManagement from "@/components/MemberManagement";

export default function OrganizationDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const organizationId = params.id as string;

    const [organization, setOrganization] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        loadOrganization();
    }, [organizationId]);

    const loadOrganization = async () => {
        setLoading(true);
        const result = await getOrganizationById(organizationId);
        if (result.success && result.organization) {
            setOrganization(result.organization);
            setName(result.organization.name);
            setDescription(result.organization.description || "");
        } else {
            alert(result.error || "Failed to load organization");
            router.push("/dashboard/organizations");
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        const result = await updateOrganization(organizationId, {
            name,
            description,
        });

        if (result.success && result.organization) {
            setEditing(false);
            setOrganization(result.organization);
            setName(result.organization.name);
            setDescription(result.organization.description || "");
        } else {
            alert(result.error || "Failed to update organization");
        }
    };

    const handleDelete = async () => {
        if (
            !confirm(
                "Are you sure you want to delete this organization? This action cannot be undone."
            )
        ) {
            return;
        }

        const result = await deleteOrganization(organizationId);
        if (result.success) {
            router.push("/dashboard/organizations");
        } else {
            alert(result.error || "Failed to delete organization");
        }
    };

    const handleLeave = async () => {
        if (
            !confirm(
                "Are you sure you want to leave this organization? You will lose access to all resources."
            )
        ) {
            return;
        }

        const result = await leaveOrganization(organizationId);
        if (result.success) {
            router.push("/dashboard/organizations");
        } else {
            alert(result.error || "Failed to leave organization");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 p-8">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    if (!organization) {
        return null;
    }

    const canEdit = organization.userRole === "OWNER" || organization.userRole === "ADMIN";
    const isOwner = organization.userRole === "OWNER";

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/dashboard/organizations")}
                        className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        Back to Organizations
                    </button>

                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        {editing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Organization Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleUpdate}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditing(false);
                                            setName(organization.name);
                                            setDescription(organization.description || "");
                                        }}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-white mb-2">
                                            {organization.name}
                                        </h1>
                                        <p className="text-gray-400">@{organization.slug}</p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`px-3 py-1 rounded text-sm font-medium ${organization.userRole === "OWNER"
                                                ? "bg-purple-500/20 text-purple-400"
                                                : organization.userRole === "ADMIN"
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "bg-gray-700 text-gray-300"
                                                }`}
                                        >
                                            {organization.userRole}
                                        </span>

                                        {canEdit && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {organization.description && (
                                    <p className="text-gray-400">{organization.description}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Member Management */}
                <MemberManagement
                    organizationId={organizationId}
                    userRole={organization.userRole}
                />

                {/* Danger Zone */}
                <div className="mt-8 bg-red-500/10 border border-red-500 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h3>

                    <div className="space-y-4">
                        {!isOwner && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-white font-medium">Leave Organization</div>
                                    <div className="text-sm text-gray-400">
                                        You will lose access to all resources in this organization
                                    </div>
                                </div>
                                <button
                                    onClick={handleLeave}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Leave Organization
                                </button>
                            </div>
                        )}

                        {isOwner && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-white font-medium">Delete Organization</div>
                                    <div className="text-sm text-gray-400">
                                        Permanently delete this organization and all its data
                                    </div>
                                </div>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Delete Organization
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
