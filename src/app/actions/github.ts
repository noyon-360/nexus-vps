"use server";

export async function fetchGithubRepos(token: string) {
    if (!token) {
        return { success: false, message: "Token is required" };
    }

    try {
        let allRepos: any[] = [];
        let page = 1;
        const perPage = 100;
        const maxPages = 5; // Fetch up to 500 repos to be safe

        while (page <= maxPages) {
            const response = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=${perPage}&type=all&page=${page}`, {
                headers: {
                    "Authorization": `token ${token}`,
                    "Accept": "application/vnd.github.v3+json"
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                if (page === 1) { // Only fail if the first page fails
                    if (response.status === 401) {
                        return { success: false, message: "Invalid Token. Please check your credentials." };
                    }
                    return { success: false, message: `GitHub API Error: ${response.statusText}` };
                }
                break; // Stop fetching if subsequent pages fail
            }

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                break;
            }

            allRepos = [...allRepos, ...data];

            if (data.length < perPage) {
                break; // No more pages
            }
            page++;
        }

        // Map to simpler structure
        const repos = allRepos.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            html_url: repo.html_url,
            private: repo.private,
            default_branch: repo.default_branch,
            language: repo.language,
            updated_at: repo.updated_at
        }));

        return { success: true, repos };
    } catch (error: any) {
        console.error("GitHub Fetch Error:", error);
        return { success: false, message: error.message };
    }
}

export async function fetchGithubBranches(token: string, owner: string, repo: string) {
    if (!token) {
        return { success: false, message: "No token provided" };
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json"
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 401) {
                return { success: false, message: "Invalid GitHub Token" };
            }
            if (response.status === 404) {
                return { success: false, message: "Repository not found" };
            }
            return { success: false, message: `GitHub API Error: ${response.statusText}` };
        }

        const data = await response.json();

        // Map to simpler format
        const branches = data.map((branch: any) => ({
            name: branch.name,
            sha: branch.commit.sha
        }));

        return { success: true, branches };
    } catch (error: any) {
        return { success: false, message: error.message || "Failed to fetch branches" };
    }
}

// Add a Deploy Key to a repository
export async function addDeployKey(token: string, owner: string, repo: string, publicKey: string, title: string) {
    if (!token) return { success: false, message: "Token is required" };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/keys`, {
            method: 'POST',
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title,
                key: publicKey,
                read_only: true // Deploy keys only need read access to clone
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            // 422 usually means key already exists. We can proceed if it's the same key, but for now we'll treat it as success or specific error.
            if (response.status === 422) {
                return { success: true, message: "Key already exists (assumed safe)" };
            }
            return { success: false, message: `Failed to add deploy key: ${response.status} ${errorText}` };
        }

        const data = await response.json();
        return { success: true, keyId: data.id };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
