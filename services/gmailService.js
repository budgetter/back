const { google } = require("googleapis");
require("dotenv").config();

class GmailService {
    constructor(refreshToken) {
        this.oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
        this.gmail = google.gmail({ version: "v1", auth: this.oAuth2Client });
        this._labelCache = {};
    }

    /**
     * Checks if an error is a token-related error (401 or invalid_grant).
     * @param {Error} error - The error to check
     * @returns {boolean} True if the error indicates a token issue
     */
    isTokenError(error) {
        if (!error) return false;
        if (error.code === 401) return true;
        if (error.message && error.message.includes('invalid_grant')) return true;
        return false;
    }

    async listMessages(query, maxResults = 100) {
        let allMessages = [];
        let pageToken = null;

        try {
            do {
                const params = { userId: "me", q: query, maxResults: Math.min(maxResults, 100) };
                if (pageToken) params.pageToken = pageToken;

                const res = await this.gmail.users.messages.list(params);
                const messages = res.data.messages || [];
                allMessages = allMessages.concat(messages);
                pageToken = res.data.nextPageToken || null;

                // Rate control: 200ms delay between pages
                if (pageToken) await new Promise(r => setTimeout(r, 200));
            } while (pageToken);

            return allMessages;
        } catch (error) {
            // If it's a token error, attempt one automatic refresh and retry
            if (this.isTokenError(error)) {
                try {
                    await this.oAuth2Client.getAccessToken();
                    const res = await this.gmail.users.messages.list({
                        userId: "me",
                        q: query,
                        maxResults
                    });
                    return res.data.messages || [];
                } catch (retryError) {
                    console.error("Gmail List Error after token refresh retry:", retryError);
                    throw retryError;
                }
            }
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
    /**
     * Marks a Gmail message as read by removing the UNREAD label.
     * Non-fatal: logs error and continues on failure.
     * @param {string} messageId - The Gmail message ID to mark as read
     */
    async markAsRead(messageId) {
        try {
            await this.gmail.users.messages.modify({
                userId: "me",
                id: messageId,
                requestBody: {
                    removeLabelIds: ["UNREAD"],
                },
            });
        } catch (error) {
            console.error(`Gmail markAsRead Error for message ${messageId}:`, error);
        }
    }

    /**
     * Returns the Gmail label ID for the given label name, creating it if it doesn't exist.
     * Caches the label ID in memory so repeated calls within the same sync session
     * return the cached value without additional API calls.
     * Throws on error — the label ID is required before the processing loop.
     * @param {string} labelName - The label name to find or create
     * @returns {Promise<string>} The label ID
     */
    async getOrCreateLabel(labelName) {
        if (this._labelCache[labelName]) {
            return this._labelCache[labelName];
        }

        const res = await this.gmail.users.labels.list({ userId: "me" });
        const labels = res.data.labels || [];
        const existing = labels.find((l) => l.name === labelName);

        if (existing) {
            this._labelCache[labelName] = existing.id;
            return existing.id;
        }

        const createRes = await this.gmail.users.labels.create({
            userId: "me",
            requestBody: {
                name: labelName,
                labelListVisibility: "labelShow",
                messageListVisibility: "show",
            },
        });

        this._labelCache[labelName] = createRes.data.id;
        return createRes.data.id;
    }

    /**
     * Adds a label to a Gmail message.
     * Non-fatal: logs error and continues on failure.
     * @param {string} messageId - The Gmail message ID
     * @param {string} labelId - The label ID to add
     */
    async addLabel(messageId, labelId) {
        try {
            await this.gmail.users.messages.modify({
                userId: "me",
                id: messageId,
                requestBody: {
                    addLabelIds: [labelId],
                },
            });
        } catch (error) {
            console.error(`Gmail addLabel Error for message ${messageId}:`, error);
        }
    }



}


module.exports = GmailService;
