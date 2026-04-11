// Feature: transaction-source-indicator, Property 2: Default source is manual
// Validates: Requirements 1.2, 2.2

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

/**
 * Property 2: Default source is manual
 *
 * For any valid transaction creation payload that does not include a `source`
 * field, the resulting Transaction record shall have `source` equal to 'manual'.
 *
 * Strategy: Parse the Transaction model source file to extract the `source`
 * field's defaultValue, then use fast-check to generate random valid transaction
 * payloads (varying amount, description, date, type) without a `source` field
 * and verify the model declares 'manual' as the default — meaning any such
 * payload would get `source === 'manual'`.
 *
 * This avoids importing Sequelize (which requires a live DB connection).
 */

const modelPath = path.resolve(__dirname, '..', 'models', 'Transaction.js');
const modelSource = fs.readFileSync(modelPath, 'utf-8');

/**
 * Extract the defaultValue for the `source` field from the model file.
 * Looks for pattern: source: { ... defaultValue: 'value' ... }
 */
function extractSourceDefaultValue(fileContent) {
  const sourceBlockMatch = fileContent.match(/source\s*:\s*\{([^}]+)\}/s);
  if (!sourceBlockMatch) return null;
  const block = sourceBlockMatch[1];
  const defaultMatch = block.match(/defaultValue\s*:\s*['"]([^'"]+)['"]/);
  return defaultMatch ? defaultMatch[1] : null;
}

/**
 * Extract allowNull for the `source` field from the model file.
 */
function extractSourceAllowNull(fileContent) {
  const sourceBlockMatch = fileContent.match(/source\s*:\s*\{([^}]+)\}/s);
  if (!sourceBlockMatch) return null;
  const block = sourceBlockMatch[1];
  const allowNullMatch = block.match(/allowNull\s*:\s*(true|false)/);
  return allowNullMatch ? allowNullMatch[1] === 'true' : null;
}

const defaultValue = extractSourceDefaultValue(modelSource);
const allowNull = extractSourceAllowNull(modelSource);

// Arbitrary generators for valid transaction payload fields (without source)
const amountArb = fc.float({ min: 0.01, max: 999999.99, noNaN: true })
  .map((v) => parseFloat(v.toFixed(2)));
const descriptionArb = fc.oneof(fc.string({ minLength: 0, maxLength: 200 }), fc.constant(null));
const dateArb = fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
  .map((d) => d.toISOString().split('T')[0]);
const typeArb = fc.constantFrom('expense', 'income');

/**
 * Generator for a valid transaction payload that deliberately omits `source`.
 */
const transactionPayloadWithoutSource = fc.record({
  amount: amountArb,
  description: descriptionArb,
  date: dateArb,
  type: typeArb,
});

describe('Property 2: Default source is manual', () => {
  test('Transaction model file exists and contains a source field with a defaultValue', () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    expect(defaultValue).not.toBeNull();
  });

  test('source field defaultValue is manual', () => {
    expect(defaultValue).toBe('manual');
  });

  test('source field does not allow null, ensuring the default always applies', () => {
    expect(allowNull).toBe(false);
  });

  test('for any valid transaction payload without source, the model default is manual', async () => {
    await fc.assert(
      fc.asyncProperty(
        transactionPayloadWithoutSource,
        async (payload) => {
          // The payload has no `source` key
          expect(payload).not.toHaveProperty('source');
          // The model declares 'manual' as the default for missing source
          expect(defaultValue).toBe('manual');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('for any valid transaction payload without source, the effective source would be manual', async () => {
    await fc.assert(
      fc.asyncProperty(
        transactionPayloadWithoutSource,
        async (payload) => {
          // Simulate what Sequelize does: if source is missing, apply defaultValue
          const effectiveSource = payload.source !== undefined ? payload.source : defaultValue;
          expect(effectiveSource).toBe('manual');
        }
      ),
      { numRuns: 100 }
    );
  });
});
