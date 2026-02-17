import { NextResponse } from 'next/server';

export async function GET() {
    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const REDIRECT_URI = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/github/callback`;

    if (!GITHUB_CLIENT_ID) {
        return NextResponse.json({ error: "GitHub Client ID not configured" }, { status: 500 });
    }

    // Scopes:
    // repo: Full control of private repositories (needed to list private repos and add deploy keys)
    const scope = "repo";

    // Redirect to GitHub Authorization Page
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}`;

    return NextResponse.redirect(githubAuthUrl);
}
