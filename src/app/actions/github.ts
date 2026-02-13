"use server";

export async function fetchGithubRepos(token: string) {
    if (!token) {
        return { success: false, message: "Token is required" };
    }

    try {
        const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100&type=all", {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json"
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 401) {
                return { success: false, message: "Invalid Token. Please check your credentials." };
            }
            return { success: false, message: `GitHub API Error: ${response.statusText}` };
        }

        const data = await response.json();
        // Map to simpler structure
        const repos = data.map((repo: any) => ({
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
