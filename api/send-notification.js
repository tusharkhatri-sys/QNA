const { GoogleAuth } = require('google-auth-library');

module.exports = async (req, res) => {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { fcm_tokens, title, message } = req.body;

        if (!fcm_tokens || fcm_tokens.length === 0) {
            return res.status(400).json({ error: 'Missing fcm_tokens array' });
        }

        // Parse credentials from Vercel Environment Variables
        const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!rawCreds) {
            console.error("Missing FIREBASE_SERVICE_ACCOUNT env variable");
            return res.status(500).json({ error: 'Server misconfiguration: Missing Firebase credentials' });
        }

        const credentials = JSON.parse(rawCreds);
        const projectId = credentials.project_id;

        // Generate short-lived OAuth2 Bearer token
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging']
        });
        const client = await auth.getClient();
        const accessTokenObj = await client.getAccessToken();
        const accessToken = accessTokenObj.token;

        // FCM v1 Endpoint
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        let successCount = 0;
        let failureCount = 0;
        const failedTokens = [];

        // Loop through each token and send (FCM v1 requires 1 per request for simple HTTP POST)
        // For production scale, HTTP/2 multiplexing or sendAll batching can be used.
        for (const token of fcm_tokens) {
            const payload = {
                message: {
                    token: token,
                    notification: {
                        title: title,
                        body: message
                    },
                    android: {
                        notification: {
                            sound: "default"
                        }
                    }
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                successCount++;
            } else {
                failureCount++;
                const err = await response.json();
                console.error(`Failed to send to token ${token}:`, err);
                failedTokens.push(token);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Notifications dispatched. Success: ${successCount}, Failures: ${failureCount}`,
            failedTokens
        });

    } catch (error) {
        console.error("Error sending notification:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
