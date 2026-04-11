#!/usr/bin/env node

/**
 * Migration script: Re-encrypt BankIntegration refresh tokens
 *
 * Migrates encrypted refresh tokens from the old JWT_SECRET-derived key
 * to the new dedicated ENCRYPTION_KEY-derived key.
 *
 * Usage:
 *   OLD_JWT_SECRET=<old_secret> ENCRYPTION_KEY=<new_key> node scripts/migrateEncryption.js
 *
 * Environment variables:
 *   OLD_JWT_SECRET  - The previous JWT_SECRET used to encrypt tokens (required)
 *   ENCRYPTION_KEY  - The new dedicated encryption key (required)
 *
 * Validates: Requirements 1.4
 */

const crypto = require('crypto');
require('dotenv').config();

const sequelize = require('../config/database');
const BankIntegration = require('../models/BankIntegration');

const ALGORITHM = 'aes-256-cbc';

/**
 * Derives a 32-byte AES key from a secret string using SHA-256.
 */
function deriveKey(secret) {
    return crypto.createHash('sha256').update(secret).digest().slice(0, 32);
}

/**
 * Decrypts a token encrypted in "iv_hex:ciphertext_hex" format using the given key.
 */
function decryptWithKey(ciphertext, key) {
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Encrypts plaintext using AES-256-CBC, returning "iv_hex:ciphertext_hex".
 */
function encryptWithKey(plaintext, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function migrate() {
    const oldSecret = process.env.OLD_JWT_SECRET || process.env.JWT_SECRET;
    const newKey = process.env.ENCRYPTION_KEY;

    if (!oldSecret) {
        console.error('ERROR: OLD_JWT_SECRET (or JWT_SECRET) environment variable is required.');
        console.error('Set it to the JWT_SECRET that was previously used to encrypt refresh tokens.');
        process.exit(1);
    }

    if (!newKey) {
        console.error('ERROR: ENCRYPTION_KEY environment variable is required.');
        console.error('Set it to the new dedicated encryption key for token storage.');
        process.exit(1);
    }

    const oldDerivedKey = deriveKey(oldSecret);
    const newDerivedKey = deriveKey(newKey);

    console.log('Starting encryption migration...');
    console.log('Reading BankIntegration records...');

    let records;
    try {
        records = await BankIntegration.findAll({
            where: {
                refreshToken: { [require('sequelize').Op.ne]: null }
            }
        });
    } catch (err) {
        console.error('ERROR: Failed to read BankIntegration records:', err.message);
        process.exit(1);
    }

    console.log(`Found ${records.length} record(s) with encrypted refresh tokens.`);

    if (records.length === 0) {
        console.log('Nothing to migrate. Exiting.');
        process.exit(0);
    }

    let success = 0;
    let failed = 0;

    for (const record of records) {
        try {
            const decrypted = decryptWithKey(record.refreshToken, oldDerivedKey);
            const reEncrypted = encryptWithKey(decrypted, newDerivedKey);

            await record.update({ refreshToken: reEncrypted });

            success++;
            console.log(`  [OK] Record ${record.id} (${record.email}) migrated.`);
        } catch (err) {
            failed++;
            console.error(`  [FAIL] Record ${record.id} (${record.email}): ${err.message}`);
        }
    }

    console.log('\nMigration complete.');
    console.log(`  Success: ${success}`);
    console.log(`  Failed:  ${failed}`);
    console.log(`  Total:   ${records.length}`);

    if (failed > 0) {
        console.warn('\nWARNING: Some records failed to migrate. Review the errors above.');
        console.warn('Failed records still have the old encryption — re-run after fixing issues.');
    }
}

migrate()
    .catch((err) => {
        console.error('Unexpected error during migration:', err.message);
        process.exit(1);
    })
    .finally(async () => {
        try {
            await sequelize.close();
        } catch (_) {
            // Ignore close errors
        }
    });
