// Feature: transaction-source-indicator, Property 1: Source ENUM invariant
// Validates: Requirements 1.1, 3.3

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

/**
 * Property 1: Source ENUM invariant
 *
 * For any transaction in the database, the `source` field must be a string
 * equal to either 'manual' or 'email_sync' — no other value is permitted,
 * and the field is never null.
 *
 * Strategy: Parse the Transaction model source file to extract the ENUM
 * definition, then use fast-check to verify the invariant holds against
 * the declared schema. This avoids importing Sequelize (which requires
 * a live DB connection in this project's setup).
 */

const VALID_SOURCES = ['manual', 'email_sync'];

// Read and parse the model file to extract the source field definition
const modelPath = path.resolve(__dirname, '..', 'models', 'Transaction.js');
const modelSource = fs.readFileSync(modelPath, 'utf-8');

/**
 * Extract ENUM values for the `source` field from the model file.
 * Looks for pattern: source: { ... type: DataTypes.ENUM('val1', 'val2') ... }
 */
function extractSourceEnumValues(fileContent) {
  // Match the source field block
  const sourceBlockMatch = fileContent.match(
    /source\s*:\s*\{([^}]+)\}/s
  );
  if (!sourceBlockMatch) return null;

  const sourceBlock = sourceBlockMatch[1];

  // Extract ENUM values from DataTypes.ENUM(...)
  const enumMatch = sourceBlock.match(
    /DataTypes\.ENUM\(([^)]+)\)/
  );
  if (!enumMatch) return null;

  // Parse the comma-separated quoted strings
  const valuesStr = enumMatch[1];
  const values = [];
  const regex = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(valuesStr)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function extractSourceAllowNull(fileContent) {
  const sourceBlockMatch = fileContent.match(
    /source\s*:\s*\{([^}]+)\}/s
  );
  if (!sourceBlockMatch) return null;
  const block = sourceBlockMatch[1];
  const allowNullMatch = block.match(/allowNull\s*:\s*(true|false)/);
  return allowNullMatch ? allowNullMatch[1] === 'true' : null;
}

function extractSourceDefault(fileContent) {
  const sourceBlockMatch = fileContent.match(
    /source\s*:\s*\{([^}]+)\}/s
  );
  if (!sourceBlockMatch) return null;
  const block = sourceBlockMatch[1];
  const defaultMatch = block.match(/defaultValue\s*:\s*['"]([^'"]+)['"]/);
  return defaultMatch ? defaultMatch[1] : null;
}

const enumValues = extractSourceEnumValues(modelSource);
const allowNull = extractSourceAllowNull(modelSource);
const defaultValue = extractSourceDefault(modelSource);

describe('Property 1: Source ENUM invariant', () => {
  test('Transaction model file exists and contains a source field', () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    expect(enumValues).not.toBeNull();
    expect(enumValues.length).toBeGreaterThan(0);
  });

  test('source ENUM contains exactly manual and email_sync', () => {
    expect(enumValues).toHaveLength(VALID_SOURCES.length);
    expect(enumValues).toEqual(expect.arrayContaining(VALID_SOURCES));
  });

  test('for any valid source value, it is in the declared ENUM set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...VALID_SOURCES),
        async (source) => {
          expect(enumValues).toContain(source);
          expect(typeof source).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('for any random string not in VALID_SOURCES, it is not in the ENUM set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(
          (s) => !VALID_SOURCES.includes(s)
        ),
        async (invalidSource) => {
          expect(enumValues).not.toContain(invalidSource);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('source field does not allow null', () => {
    expect(allowNull).toBe(false);
  });

  test('source field defaults to manual', () => {
    expect(defaultValue).toBe('manual');
  });
});
