/**
 * GitHub OAuth — EdgeOne Makers Node Function
 * File path cloud-functions/auth/github.ts maps to POST /auth/github
 *
 * Two actions:
 *   1. { action: "getClientId" } → returns the GitHub OAuth client_id
 *   2. { code: "xxx" }          → exchanges code for token, returns user info
 *
 * Environment variables: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 */
import { createLogger } from '../_logger';

const logger = createLogger('auth-github');

function createResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
}

export async function onRequestPost(context: any) {
    const body: Record<string, any> = context.request?.body ?? {};
    const clientId = context.env?.GITHUB_CLIENT_ID ?? '';
    const clientSecret = context.env?.GITHUB_CLIENT_SECRET ?? '';

    // Action: return the public client_id
    if (body.action === 'getClientId') {
        if (!clientId) {
            return createResponse({ error: 'GitHub OAuth is not configured' }, 500);
        }
        return createResponse({ client_id: clientId });
    }

    // Action: exchange authorization code for user info
    const { code } = body;

    if (!code) {
        return createResponse({ error: 'Missing authorization code' }, 400);
    }

    if (!clientId || !clientSecret) {
        logger.error('GitHub OAuth not configured: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
        return createResponse({ error: 'GitHub OAuth is not configured on the server' }, 500);
    }

    try {
        // Step 1: Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            }),
        });

        if (!tokenRes.ok) {
            logger.error('Token exchange failed:', tokenRes.status);
            return createResponse({ error: 'Failed to exchange authorization code' }, 502);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            logger.error('No access_token in response:', JSON.stringify(tokenData));
            return createResponse({ error: 'No access token received from GitHub' }, 502);
        }

        // Step 2: Fetch user profile
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'content-creator-agent',
            },
        });

        if (!userRes.ok) {
            logger.error('User fetch failed:', userRes.status);
            return createResponse({ error: 'Failed to fetch user profile' }, 502);
        }

        const userData = await userRes.json();

        logger.log('User authenticated:', userData.login);

        return createResponse({
            user: {
                id: String(userData.id),
                login: userData.login,
                avatar_url: userData.avatar_url,
                name: userData.name || userData.login,
            },
        });
    } catch (e: any) {
        const msg = e?.message || String(e);
        logger.error(msg);
        return createResponse({ error: msg }, 500);
    }
}