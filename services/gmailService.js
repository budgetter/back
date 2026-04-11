const { google } = require("googleapis");
require("dotenv").config();

class GmailService {
    constructor(refreshToken) {
        this.oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.ORIGIN_URL // Redirect URI needs to match, though not used for refresh
        );
        this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
        this.gmail = google.gmail({ version: "v1", auth: this.oAuth2Client });
    }

    async listMessages(query) {
        try {
            // Default to last 30 days if no date specified in query, but standard query syntax applies
            // Example query: 'from:colpatriaInforma@scotiabankcolpatria.com after:2024/01/01'
            const res = await this.gmail.users.messages.list({
                userId: "me",
                q: query,
                maxResults: 20 // Limit batch size
            });
            return res.data.messages || [];
        } catch (error) {
            console.error("Gmail List Error:", error);
            throw error;
        }
    }

    async getMessage(messageId) {
        try {
            const res = await this.gmail.users.messages.get({
                userId: "me",
                id: messageId,
                format: "full", // Need full content for parsing
            });
            return res.data;
        } catch (error) {
            console.error("Gmail Get Error:", error);
            throw error;
        }
    }

    // Extract body content from Gmail API nested payload
    extractBody(payload) {
        let body = "";
        if (payload.parts) {
            for (let part of payload.parts) {
                if (part.mimeType === "text/html") {
                    body = Buffer.from(part.body.data, "base64").toString("utf-8");
                    break; // Prefer HTML
                } else if (part.mimeType === "text/plain") {
                    body = Buffer.from(part.body.data, "base64").toString("utf-8");
                } else if (part.parts) {
                    // Recursive for nested parts
                    body = this.extractBody(part);
                    if (body) break;
                }
            }
        } else if (payload.body && payload.body.data) {
            body = Buffer.from(payload.body.data, "base64").toString("utf-8");
        }
        return body;
    }
}

module.exports = GmailService;
