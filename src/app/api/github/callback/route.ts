import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return NextResponse.json({ error: "GitHub credentials not configured" }, { status: 500 });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return NextResponse.json({ error: tokenData.error_description }, { status: 400 });
        }

        const accessToken = tokenData.access_token;

        // Return HTML that posts the token back to the opener (popup) and closes itself
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authenticating...</title>
        </head>
        <body>
            <script>
                // Send the token to the main window
                if (window.opener) {
                    window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${accessToken}' }, '*');
                    window.close();
                } else {
                    document.body.innerText = "Authentication successful. You can close this window.";
                }
            </script>
        </body>
        </html>
        `;

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
