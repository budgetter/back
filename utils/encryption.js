const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
// Use a secure key from env or generate one (for demo purposes using a fixed key if env is missing, but should be ENV)
// Ensure JWT_SECRET or a specific ENCRYPTION_KEY is used.
// For now I will derive a key from JWT_SECRET or fallback (NOT IDEAL FOR PROD but cleaner for this setup without forcing user to add new ENV right now)
// Better: Add ENCRYPTION_KEY to .env check in future.
const secretKey = crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'default_secret')).digest('base64').substr(0, 32);
const ivLength = 16;

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

module.exports = { encrypt, decrypt };
