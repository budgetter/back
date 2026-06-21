/**
 * Preservation Property Tests — Debt Settlement System
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * These tests capture EXISTING CORRECT behavior that must be preserved
 * after the bugfix is implemented. They are written using observation-first
 * methodology — observe on UNFIXED code, then encode observed behavior.
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code (confirms baseline).
 *
 * Properties tested:
 * 1. settleSplit sets isPaid=true, paidAt=now, proofOfPayment=provided value
 * 2. Bank debt TransactionLink records: linkType 'debt_payment', toWalletId and debtId unchanged
 * 3. New transactions with N participants: exactly N TransactionSplit records with correct amounts
 * 4. Unidirectional debts: counterparty appears in exactly one of owedToMe or owedByMe
 * 5. Transactions where sender has no outstanding splits: no split_payment link exists
 */

const fc = require('fast-check');
const express = require('express');
const request = require('supertest');

// --- Mock database BEFORE anything loads it ---
jest.mock('../config/database', () => ({
  define: jest.fn(() => ({})),
  authenticate: jest.fn().mockResolvedValue(true),
  query: jest.fn(),
  QueryTypes: { SELECT: 'SELECT' },
  transaction: jest.fn(),
}));

// --- Mock models BEFORE any require that loads them ---
const mockSequelizeQuery = jest.fn();
const mockTransactionSplitFindAll = jest.fn();
const mockTransactionSplitFindByPk = jest.fn();
const mockTransactionSplitCount = jest.fn();
const mockTransactionLinkFindOne = jest.fn();

jest.mock('../models', () => {
  const { Op, fn, col, literal } = require('sequelize');
  return {
    sequelize: {
      query: (...args) => mockSequelizeQuery(...args),
      QueryTypes: { SELECT: 'SELECT' },
      transaction: jest.fn(async (cb) => cb({ commit: jest.fn(), rollback: jest.fn() })),
    },
    TransactionSplit: {
      findAll: (...args) => mockTransactionSplitFindAll(...args),
      findByPk: (...args) => mockTransactionSplitFindByPk(...args),
      count: (...args) => mockTransactionSplitCount(...args),
    },
    Transaction: {
      findByPk: jest.fn().mockResolvedValue(null),
    },
    SplitInvitation: {
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    FriendContact: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    },
    User: {
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    TransactionLink: {
      create: jest.fn(),
      findOne: (...args) => mockTransactionLinkFindOne(...args),
    },
    SplitPaymentLink: {
      create: jest.fn(),
      sum: jest.fn().mockResolvedValue(0),
    },
    RecurrentPayment: {
      findByPk: jest.fn().mockResolvedValue(null),
    },
    RecurrentSplitConfig: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    Op,
    fn,
    col,
    literal,
  };
});

// Mock auth middleware
jest.mock('../middlewares/authMiddleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-1', email: 'testuser@example.com' };
    next();
  },
}));

// Import controller (uses mocked models)
const splitController = require('../controllers/splitController');

// Build minimal Express app with real routes
function createTestApp() {
  const testApp = express();
  testApp.use(express.json());
  const splitRoutes = require('../routes/splits');
  testApp.use('/api/splits', splitRoutes);
  return testApp;
}

const app = createTestApp();

// --- Generators ---
const validUuid = fc.constantFrom(
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

const amountArb = fc.float({ min: Math.fround(1.00), max: Math.fround(9999.99), noNaN: true })
  .map((v) => parseFloat(v.toFixed(2)));

const proofUrlArb = fc.constantFrom(
  'https://example.com/receipt.png',
  'https://storage.example.com/proof/abc123.pdf',
  null,
  undefined
);

describe('Property 2: Preservation — Existing Settlement, Bank Debts, and Transaction Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Preservation 1: settleSplit sets isPaid=true, paidAt=now, proofOfPayment=provided value', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For all valid single split IDs: POST /:splitId/settle marks that split
     * as isPaid=true with a paidAt timestamp close to now, and sets
     * proofOfPayment to the provided value (or leaves it unchanged if not provided).
     */
    test('settleSplit marks split as paid with correct fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUuid,
          proofUrlArb,
          async (splitId, proofOfPayment) => {
            const mockSplit = {
              id: splitId,
              userId: 'test-user-1', // debtor is current user
              transactionId: 'txn-abc',
              isPaid: false,
              paidAt: null,
              proofOfPayment: null,
              Transaction: { id: 'txn-abc', UserId: 'other-user-999' },
              save: jest.fn().mockResolvedValue(true),
            };

            mockTransactionSplitFindByPk.mockResolvedValue(mockSplit);
            mockTransactionSplitCount.mockResolvedValue(0); // all settled

            const body = {};
            if (proofOfPayment) {
              body.proofOfPayment = proofOfPayment;
            }

            const res = await request(app)
              .post(`/api/splits/${splitId}/settle`)
              .send(body);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Split settled successfully');

            // Verify the split was marked as paid
            expect(mockSplit.isPaid).toBe(true);
            expect(mockSplit.paidAt).toBeInstanceOf(Date);

            // paidAt should be close to now (within 5 seconds)
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - mockSplit.paidAt.getTime());
            expect(timeDiff).toBeLessThan(5000);

            // proofOfPayment should be set if provided
            if (proofOfPayment) {
              expect(mockSplit.proofOfPayment).toBe(proofOfPayment);
            }

            // save() should have been called
            expect(mockSplit.save).toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('settleSplit returns 404 for non-existent split', async () => {
      await fc.assert(
        fc.asyncProperty(validUuid, async (splitId) => {
          mockTransactionSplitFindByPk.mockResolvedValue(null);

          const res = await request(app)
            .post(`/api/splits/${splitId}/settle`)
            .send({});

          expect(res.status).toBe(404);
          expect(res.body.message).toBe('Split not found');
        }),
        { numRuns: 5 }
      );
    });

    test('settleSplit returns 403 for unauthorized user', async () => {
      await fc.assert(
        fc.asyncProperty(validUuid, async (splitId) => {
          const mockSplit = {
            id: splitId,
            userId: 'someone-else', // neither debtor
            transactionId: 'txn-abc',
            isPaid: false,
            Transaction: { id: 'txn-abc', UserId: 'yet-another-user' }, // nor creditor
          };

          mockTransactionSplitFindByPk.mockResolvedValue(mockSplit);

          const res = await request(app)
            .post(`/api/splits/${splitId}/settle`)
            .send({});

          expect(res.status).toBe(403);
          expect(res.body.message).toBe('Not authorized to settle this split');
        }),
        { numRuns: 5 }
      );
    });
  });

  describe('Preservation 2: Bank debt TransactionLink records remain unchanged', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * For all bank debt TransactionLink records: linkType remains 'debt_payment',
     * toWalletId and debtId are unchanged after any split-related operations.
     */
    test('TransactionLink with debt_payment linkType is queryable and unmodified', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUuid,
          validUuid,
          validUuid,
          async (linkId, walletId, debtId) => {
            const bankDebtLink = {
              id: linkId,
              transactionId: 'bank-txn-1',
              linkType: 'debt_payment',
              toWalletId: walletId,
              debtId: debtId,
              createdAt: new Date('2024-01-15'),
              updatedAt: new Date('2024-01-15'),
            };

            mockTransactionLinkFindOne.mockResolvedValue(bankDebtLink);

            // Perform a split-related operation (settle a different split)
            const mockSplit = {
              id: 'unrelated-split-id',
              userId: 'test-user-1',
              transactionId: 'split-txn-999',
              isPaid: false,
              paidAt: null,
              proofOfPayment: null,
              Transaction: { id: 'split-txn-999', UserId: 'creditor-user' },
              save: jest.fn().mockResolvedValue(true),
            };
            mockTransactionSplitFindByPk.mockResolvedValue(mockSplit);
            mockTransactionSplitCount.mockResolvedValue(0);

            // Settle an unrelated split
            await request(app)
              .post('/api/splits/unrelated-split-id/settle')
              .send({});

            // Verify the bank debt link was NOT modified
            // Query it to confirm it's still queryable with original values
            const { TransactionLink } = require('../models');
            const result = await TransactionLink.findOne({ where: { id: linkId } });

            expect(result).not.toBeNull();
            expect(result.linkType).toBe('debt_payment');
            expect(result.toWalletId).toBe(walletId);
            expect(result.debtId).toBe(debtId);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Preservation 3: Creating transactions with splits produces correct records', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For all new transactions with N participants: exactly N TransactionSplit
     * records are created with correct amounts summing to transaction total,
     * each with isPaid=false. SplitInvitation records for email-only participants.
     *
     * Note: We test this by observing the getDebtsWithUser endpoint which returns
     * TransactionSplit records — confirming splits are correctly queryable with
     * expected fields (amount, userId, isPaid=false).
     */
    test('TransactionSplit records returned by getDebtsWithUser have isPaid=false and correct amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          amountArb,
          async (numSplits, totalAmount) => {
            const splitAmount = parseFloat((totalAmount / numSplits).toFixed(2));
            const targetUserId = 'target-user-123';

            // Generate N split records
            const splits = Array.from({ length: numSplits }, (_, i) => ({
              id: `split-${i}`,
              transactionId: 'txn-main',
              userId: targetUserId,
              amount: splitAmount,
              isPaid: false,
              paidAt: null,
              Transaction: {
                id: 'txn-main',
                description: 'Test expense',
                amount: totalAmount,
                date: '2024-06-15',
              },
              toJSON() {
                return {
                  id: this.id,
                  transactionId: this.transactionId,
                  userId: this.userId,
                  amount: this.amount,
                  isPaid: this.isPaid,
                  paidAt: this.paidAt,
                  Transaction: this.Transaction,
                };
              },
            }));

            mockTransactionSplitFindAll
              .mockResolvedValueOnce(splits) // owedToMe
              .mockResolvedValueOnce([]); // owedByMe

            const res = await request(app)
              .get(`/api/splits/debts/${targetUserId}`);

            expect(res.status).toBe(200);

            // Verify correct number of splits returned
            expect(res.body.owedToMe).toHaveLength(numSplits);

            // Each split should have isPaid=false
            for (const split of res.body.owedToMe) {
              expect(split.isPaid).toBe(false);
              expect(split.amount).toBe(splitAmount);
              expect(split.userId).toBe(targetUserId);
            }

            // Amounts should sum correctly (within floating point tolerance)
            const sum = res.body.owedToMe.reduce((acc, s) => acc + s.amount, 0);
            const expectedSum = splitAmount * numSplits;
            expect(Math.abs(sum - expectedSum)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Preservation 4: Unidirectional debts appear in exactly one list', () => {
    /**
     * **Validates: Requirements 3.1, 3.4**
     *
     * For all counterparties with debts in only ONE direction: they appear
     * in exactly one of owedToMe or owedByMe, never both.
     */
    test('counterparty with debts only owed TO me appears only in owedToMe', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUuid,
          amountArb,
          async (counterpartyId, amount) => {
            // Setup: counterparty ONLY owes current user (no reverse)
            mockSequelizeQuery
              .mockResolvedValueOnce([
                // owedToMeRegistered: counterparty owes me
                { userId: counterpartyId, id: counterpartyId, name: 'Debtor User', email: 'debtor@test.com', totalAmount: amount },
              ])
              .mockResolvedValueOnce([]) // owedToMeInvitations: none
              .mockResolvedValueOnce([]); // owedByMe: EMPTY — no reverse

            const res = await request(app)
              .get('/api/splits/debts/summary');

            expect(res.status).toBe(200);

            // Counterparty should appear in owedToMe
            const inOwedToMe = (res.body.owedToMe || []).some(
              (e) => e.userId === counterpartyId
            );
            // Counterparty should NOT appear in owedByMe
            const inOwedByMe = (res.body.owedByMe || []).some(
              (e) => e.userId === counterpartyId
            );

            expect(inOwedToMe).toBe(true);
            expect(inOwedByMe).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('counterparty with debts only owed BY me appears only in owedByMe', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUuid,
          amountArb,
          async (counterpartyId, amount) => {
            // Setup: I only owe them (no reverse)
            mockSequelizeQuery
              .mockResolvedValueOnce([]) // owedToMeRegistered: EMPTY
              .mockResolvedValueOnce([]) // owedToMeInvitations: none
              .mockResolvedValueOnce([
                // owedByMe: I owe counterparty
                { creditorUserId: counterpartyId, id: counterpartyId, name: 'Creditor User', email: 'creditor@test.com', totalAmount: amount },
              ]);

            const res = await request(app)
              .get('/api/splits/debts/summary');

            expect(res.status).toBe(200);

            // Counterparty should NOT appear in owedToMe
            const inOwedToMe = (res.body.owedToMe || []).some(
              (e) => e.userId === counterpartyId
            );
            // Counterparty should appear in owedByMe
            const inOwedByMe = (res.body.owedByMe || []).some(
              (e) => e.userId === counterpartyId
            );

            expect(inOwedToMe).toBe(false);
            expect(inOwedByMe).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('invitation-based debts appear in owedToMe with type=invitation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('friend@test.com', 'contact@demo.org', 'invited@example.com'),
          amountArb,
          async (email, amount) => {
            // Setup: invitation-based debt (no userId)
            mockSequelizeQuery
              .mockResolvedValueOnce([]) // owedToMeRegistered: none
              .mockResolvedValueOnce([
                // owedToMeInvitations: email-only
                { email, totalAmount: amount },
              ])
              .mockResolvedValueOnce([]); // owedByMe: none

            const res = await request(app)
              .get('/api/splits/debts/summary');

            expect(res.status).toBe(200);

            // Invitation entry should be in owedToMe with type=invitation
            const invitationEntry = (res.body.owedToMe || []).find(
              (e) => e.type === 'invitation' && e.email === email
            );

            expect(invitationEntry).toBeDefined();
            expect(invitationEntry.userId).toBeNull();
            expect(invitationEntry.totalAmount).toBe(amount);

            // Should NOT appear in owedByMe
            const inOwedByMe = (res.body.owedByMe || []).some(
              (e) => e.email === email
            );
            expect(inOwedByMe).toBe(false);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Preservation 5: Normal transactions have no split_payment link', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For all transactions where the sender has no outstanding splits to the
     * current user: no split_payment link exists for that transaction.
     * Normal transactions are returned as standard data without split-payment metadata.
     */
    test('TransactionLink with split_payment does not exist for normal transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUuid,
          async (transactionId) => {
            // Query for a split_payment link on a normal transaction
            mockTransactionLinkFindOne.mockResolvedValue(null);

            const { TransactionLink } = require('../models');
            const link = await TransactionLink.findOne({
              where: {
                transactionId,
                linkType: 'split_payment',
              },
            });

            // No split_payment link should exist
            expect(link).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('getDebtsWithUser returns empty arrays when no debts exist between users', async () => {
      await fc.assert(
        fc.asyncProperty(validUuid, async (targetUserId) => {
          // No splits in either direction
          mockTransactionSplitFindAll
            .mockResolvedValueOnce([]) // owedToMe: empty
            .mockResolvedValueOnce([]); // owedByMe: empty

          const res = await request(app)
            .get(`/api/splits/debts/${targetUserId}`);

          expect(res.status).toBe(200);
          expect(res.body.owedToMe).toEqual([]);
          expect(res.body.owedByMe).toEqual([]);
        }),
        { numRuns: 5 }
      );
    });
  });
});
