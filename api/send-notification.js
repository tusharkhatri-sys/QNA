const { GoogleAuth } = require('google-auth-library');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fcm_tokens, title, message } = req.body;
        if (!fcm_tokens || !Array.isArray(fcm_tokens) || fcm_tokens.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid fcm_tokens array' });
        }

        const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!rawCreds) {
            console.error("CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT");
            return res.status(500).json({ error: 'Server config error' });
        }

        let credentials;
        try {
            credentials = JSON.parse(rawCreds);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid FIREBASE_SERVICE_ACCOUNT format' });
        }

        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging']
        });
        const client = await auth.getClient();
        const { token: accessToken } = await client.getAccessToken();

        let successCount = 0;
        let failureCount = 0;
        const failedTokens = [];

        for (const token of fcm_tokens) {
            try {
                const response = await fetch(`https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        message: {
                            token: token,
                            notification: { title, body: message },
                            android: { notification: { sound: "default", priority: "high" } },
                            apns: { payload: { aps: { sound: "default" } } }
                        }
                    })
                });
                
                if (response.ok) successCount++;
                else {
                    failureCount++;
                    failedTokens.push(token);
                }
            } catch (networkErr) {
                failureCount++;
                failedTokens.push(token);
            }
        }
        return res.status(200).json({ success: true, successCount, failureCount, failedTokens });
    } catch (error) {
        console.error("Fatal Notification Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
