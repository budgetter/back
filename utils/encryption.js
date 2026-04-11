const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const ivLength = 16;

/**
 * Derives a 32-byte AES key from the ENCRYPTION_KEY environment variable.
 * Uses SHA-256 hash truncated to 32 bytes.
 */
function getEncryptionKey() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot perform encryption operations.');
    }
    return crypto.createHash('sha256').update(encryptionKey).digest().slice(0, 32);
}

/**
 * Validates that the ENCRYPTION_KEY environment variable is set.
 * Should be called during app startup — process exits if missing.
 */
function validateEncryptionKey() {
    if (!process.env.ENCRYPTION_KEY) {
        console.error('FATAL: ENCRYPTION_KEY environment variable is not set. Application cannot start without a dedicated encryption key.');
        process.exit(1);
    }
}

/**
 * Encrypts plaintext using AES-256-CBC with a random 16-byte IV.
 * @param {string} text - The plaintext to encrypt
 * @returns {string} "iv_hex:ciphertext_hex" format
 */
function encrypt(text) {
    if (!text) return text;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts ciphertext in "iv_hex:ciphertext_hex" format.
 * @param {string} text - The ciphertext to decrypt
 * @returns {string|null} The decrypted plaintext, or null on failure
 */
function decrypt(text) {
    if (!text) return text;
    try {
        const key = getEncryptionKey();
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

module.exports = { encrypt, decrypt, validateEncryptionKey };
