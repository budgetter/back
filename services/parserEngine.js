const BankParsers = require('../parsers/BankParsers');

const REGEX_TIMEOUT_MS = 2000;

/**
 * Applies a ParserConfig's regex patterns to an email body.
 * Returns extracted fields or null if parsing fails.
 *
 * @param {Object} config - ParserConfig instance with regexPatterns JSON
 * @param {string} body - Sanitized email HTML body
 * @param {number} internalDate - Email timestamp in ms
 * @returns {Object|null} { amount, description, date, type, parserId }
 */
function applyParser(config, body, internalDate) {
  const startTime = Date.now();
  const patterns = config.regexPatterns;

  try {
    // Sanitize body
    body = BankParsers.sanitizeHtml(body);
    if (!body) return null;

    // Extract amount (required)
    const amountStr = extractField(patterns.amount, body, startTime);
    if (!amountStr) return null;

    // COP: strip thousands separators (comma/dot), parse as integer
    const amount = parseFloat(amountStr.replace(/[.,]/g, ''));
    if (!BankParsers.validateAmount(amount)) return null;

    // Extract description (required)
    const description = extractField(patterns.description, body, startTime);
    if (!description) return null;

    // Extract date (optional — fall back to email internalDate)
    let parsedDate;
    if (patterns.date && patterns.date.pattern) {
      const dateStr = extractField(patterns.date, body, startTime);
      if (dateStr) {
        // Parse date components to avoid UTC timezone shift
        const parts = dateStr.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
        if (parts) {
          parsedDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        }
      }
    }
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      parsedDate = new Date(internalDate);
    }
    if (!BankParsers.validateDate(parsedDate)) return null;

    // Type defaults to expense unless specified
    const type = patterns.type || 'expense';

    return {
      amount,
      description: description.trim(),
      date: parsedDate,
      type,
      currency: 'COP',
      parserId: config.bankName,
    };
  } catch (e) {
    console.error(`[ParserEngine] Error applying parser "${config.bankName}":`, e.message);
    return null;
  }
}

/**
 * Extracts a field from body using a regex pattern config.
 * @param {Object} fieldConfig - { pattern: string, group: number }
 * @param {string} body
 * @param {number} startTime - for timeout check
 * @returns {string|null}
 */
function extractField(fieldConfig, body, startTime) {
  if (!fieldConfig || !fieldConfig.pattern) return null;

  if (Date.now() - startTime > REGEX_TIMEOUT_MS) {
    console.warn('[ParserEngine] Regex timeout exceeded');
    return null;
  }

  try {
    const regex = new RegExp(fieldConfig.pattern, 'i');
    const match = body.match(regex);
    if (!match) return null;

    const group = fieldConfig.group || 1;
    const value = match[group];
    return value ? value.replace(/<[^>]*>/g, '').trim() : null;
  } catch (e) {
    console.error('[ParserEngine] Regex error:', e.message);
    return null;
  }
}

module.exports = { applyParser };
