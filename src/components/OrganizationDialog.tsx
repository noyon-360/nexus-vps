"use client";

import { useState } from "react";
import { createOrganization } from "@/app/actions/organization";
import { testDatabaseConnection } from "@/lib/db-manager";

interface OrganizationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function OrganizationDialog({
    isOpen,
    onClose,
    onSuccess,
}: OrganizationDialogProps) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [dbUrl, setDbUrl] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        error?: string;
    } | null>(null);
    const [error, setError] = useState("");

    const handleNameChange = (value: string) => {
        setName(value);
        // Auto-generate slug from name
        if (!slug || slug === generateSlug(name)) {
            setSlug(generateSlug(value));
        }
    };

    const generateSlug = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    const handleTestConnection = async () => {
        if (!dbUrl) {
            setTestResult({ success: false, error: "Please enter a database URL" });
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const result = await testDatabaseConnection(dbUrl);
            setTestResult(result);
        } catch (err: any) {
            setTestResult({ success: false, error: err.message });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await createOrganization({
                name,
                slug,
                dbUrl,
                description,
            });

            if (result.success) {
                onSuccess?.();
                onClose();
                // Reset form
                setName("");
                setSlug("");
                setDbUrl("");
                setDescription("");
                setTestResult(null);
            } else {
                setError(result.error || "Failed to create organization");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold text-white">Create Organization</h2>
                    <p className="text-gray-400 mt-1">
                        Set up a new organization with its own database
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Organization Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="My Organization"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Slug *
                        </label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="my-organization"
                            pattern="[a-z0-9-]+"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            URL-safe identifier (lowercase letters, numbers, and hyphens only)
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            PostgreSQL Database URL *
                        </label>
                        <input
                            type="text"
                            value={dbUrl}
                            onChange={(e) => setDbUrl(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                            placeholder="postgresql://user:password@host:5432/database"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This database will store all organization data (VPS, clients, etc.)
                        </p>

                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testing || !dbUrl}
                            className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {testing ? "Testing..." : "Test Connection"}
                        </button>

                        {testResult && (
                            <div
                                className={`mt-2 px-3 py-2 rounded text-sm ${testResult.success
                                        ? "bg-green-500/10 border border-green-500 text-green-500"
                                        : "bg-red-500/10 border border-red-500 text-red-500"
                                    }`}
                            >
                                {testResult.success
                                    ? "✓ Connection successful!"
                                    : `✗ ${testResult.error}`}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="Brief description of your organization"
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name || !slug || !dbUrl}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? "Creating..." : "Create Organization"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
