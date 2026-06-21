/**
 * Unit tests for payment splitting fixes:
 * 1. Custom/Favor split mode preserves amounts (no even recalculation)
 * 2. $0 amounts are preserved (favor scenario)
 * 3. Owner portion can be $0 (full amount owed by participant)
 * 4. Auto-save contacts on split creation
 * 5. Debts summary includes pending invitations
 * 6. Search returns top contacts + exact email match only
 */

// --- Mocks ---

const mockUuidv4 = jest.fn(() => 'mock-uuid');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

const mockTransactionCreate = jest.fn();
const mockTransactionSplitCreate = jest.fn();
const mockTransactionSplitDestroy = jest.fn();
const mockSplitInvitationCreate = jest.fn();
const mockSplitInvitationDestroy = jest.fn();
const mockFriendContactCreate = jest.fn();
const mockFriendContactFindOne = jest.fn();
const mockUserFindOne = jest.fn();
const mockTransactionFindByPk = jest.fn();

jest.mock('../models', () => ({
  Transaction: {
    create: (...args) => mockTransactionCreate(...args),
    findByPk: (...args) => mockTransactionFindByPk(...args),
  },
  TransactionSplit: {
    create: (...args) => mockTransactionSplitCreate(...args),
    destroy: (...args) => mockTransactionSplitDestroy(...args),
  },
  SplitInvitation: {
    create: (...args) => mockSplitInvitationCreate(...args),
    destroy: (...args) => mockSplitInvitationDestroy(...args),
  },
  FriendContact: {
    create: (...args) => mockFriendContactCreate(...args),
    findOne: (...args) => mockFriendContactFindOne(...args),
  },
  User: {
    findOne: (...args) => mockUserFindOne(...args),
  },
  RecurrentPayment: { create: jest.fn() },
  RecurrentSplitConfig: { create: jest.fn() },
  TransactionLink: { create: jest.fn(), findOne: jest.fn(), destroy: jest.fn() },
  SplitPaymentLink: { create: jest.fn() },
  Wallet: { findByPk: jest.fn() },
  Debt: { findByPk: jest.fn() },
  sequelize: { query: jest.fn(), QueryTypes: { SELECT: 'SELECT' } },
}));

jest.mock('../functions/recurrentService', () => ({
  calculateNextDate: jest.fn(),
  syncUserRecurrentPayments: jest.fn(),
}));

const { createTransaction, updateTransaction } = require('../controllers/transactionController');

// Helper to create mock req/res
function mockReqRes(body = {}, params = {}, userId = 'owner-123') {
  return {
    req: { body, params, user: { id: userId, email: 'owner@test.com' } },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    },
  };
}

describe('Split Fixes - createTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionCreate.mockResolvedValue({ id: 'txn-1', amount: 100 });
    mockTransactionSplitCreate.mockResolvedValue({});
    mockSplitInvitationCreate.mockResolvedValue({ id: 'inv-1' });
    mockFriendContactFindOne.mockResolvedValue(null); // No existing contact
    mockFriendContactCreate.mockResolvedValue({});
    mockUserFindOne.mockResolvedValue(null); // Email not registered
  });

  test('custom split preserves participant amounts without recalculation', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'friend@test.com', amount: 70 },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // Verify the split was created with the exact custom amount (70), not even (50)
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 70, splitMode: 'custom' })
    );
  });

  test('$0 amount is preserved for favor scenario', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'friend@test.com', amount: 0 },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // $0 should be stored, not converted to null or recalculated
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 })
    );
  });

  test('owner portion can be $0 (participant owes full amount)', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'friend@test.com', amount: 100 },
      ],
    });

    await createTransaction(req, res);

    // Should NOT return 400 — owner portion = 0 is valid
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 })
    );
  });

  test('rejects when participant amount exceeds total', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'friend@test.com', amount: 150 },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Split amounts exceed the transaction total' })
    );
  });

  test('rejects negative amounts', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'friend@test.com', amount: -10 },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Split amounts cannot be negative' })
    );
  });

  test('even split calculates correct per-person amount', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'even',
      splits: [
        { email: 'friend@test.com' },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // 100 / 2 people = 50 each
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, splitMode: 'even' })
    );
  });

  test('even split handles rounding (3 people, $100)', async () => {
    mockUserFindOne.mockResolvedValueOnce({ id: 'user-2' }); // First email resolves
    mockUserFindOne.mockResolvedValue(null); // Second doesn't

    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'even',
      splits: [
        { email: 'friend1@test.com' },
        { email: 'friend2@test.com' },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // 100 / 3 = 33.33 each, last absorbs remainder = 33.34
    // TransactionSplit.create is called for BOTH registered and invitation-linked participants
    const splitCalls = mockTransactionSplitCreate.mock.calls;
    const allAmounts = splitCalls.map(c => c[0].amount);
    expect(allAmounts.reduce((a, b) => a + b, 0)).toBeCloseTo(66.67, 1); // Owner keeps 33.33
  });

  test('auto-saves participant as contact after split creation', async () => {
    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'even',
      splits: [
        { email: 'newfriend@test.com' },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockFriendContactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-123',
        contactEmail: 'newfriend@test.com',
      })
    );
  });

  test('does not duplicate contact if already exists', async () => {
    mockFriendContactFindOne.mockResolvedValue({ id: 'existing-contact' });

    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'even',
      splits: [
        { email: 'existing@test.com' },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockFriendContactCreate).not.toHaveBeenCalled();
  });

  test('prevents self-split', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'owner-123' }); // Resolves to self

    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'even',
      splits: [
        { email: 'owner@test.com' },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cannot split with yourself' })
    );
  });

  test('resolves email to existing user and creates TransactionSplit directly', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'registered-user-1' });

    const { req, res } = mockReqRes({
      amount: 100,
      type: 'expense',
      categoryId: 'cat-1',
      splitMode: 'custom',
      splits: [
        { email: 'registered@test.com', amount: 60 },
      ],
    });

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // Should create TransactionSplit directly (not SplitInvitation)
    expect(mockTransactionSplitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'registered-user-1',
        amount: 60,
        splitMode: 'custom',
      })
    );
    expect(mockSplitInvitationCreate).not.toHaveBeenCalled();
  });
});

describe('Split Fixes - updateTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionFindByPk.mockResolvedValue({
      id: 'txn-1',
      amount: 100,
      type: 'expense',
      walletId: 'w-1',
      save: jest.fn(),
    });
    mockTransactionSplitCreate.mockResolvedValue({});
    mockTransactionSplitDestroy.mockResolvedValue(1);
    mockSplitInvitationCreate.mockResolvedValue({ id: 'inv-1' });
    mockSplitInvitationDestroy.mockResolvedValue(1);
    mockFriendContactFindOne.mockResolvedValue(null);
    mockFriendContactCreate.mockResolvedValue({});
    mockUserFindOne.mockResolvedValue(null);
  });

  test('preserves custom amounts on update without recalculating', async () => {
    const { req, res } = mockReqRes(
      {
        amount: 100,
        type: 'expense',
        splitMode: 'custom',
        splits: [{ email: 'friend@test.com', amount: 80 }],
      },
      { transactionId: 'txn-1' }
    );

    await updateTransaction(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Transaction updated successfully' })
    );
    // Amount should be 80, not recalculated to 50
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 80 })
    );
  });

  test('preserves $0 amounts on update', async () => {
    const { req, res } = mockReqRes(
      {
        amount: 100,
        type: 'expense',
        splitMode: 'custom',
        splits: [{ email: 'friend@test.com', amount: 0 }],
      },
      { transactionId: 'txn-1' }
    );

    await updateTransaction(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Transaction updated successfully' })
    );
    expect(mockSplitInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 })
    );
  });

  test('deletes old splits and creates new ones on update', async () => {
    const { req, res } = mockReqRes(
      {
        amount: 100,
        type: 'expense',
        splitMode: 'even',
        splits: [{ email: 'new@test.com' }],
      },
      { transactionId: 'txn-1' }
    );

    await updateTransaction(req, res);

    // Should destroy old splits
    expect(mockTransactionSplitDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ transactionId: 'txn-1', isPaid: false }) })
    );
    expect(mockSplitInvitationDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ transactionId: 'txn-1', status: 'pending' }) })
    );
    // Should create new split
    expect(mockSplitInvitationCreate).toHaveBeenCalled();
  });

  test('auto-saves new contacts on update', async () => {
    const { req, res } = mockReqRes(
      {
        amount: 100,
        type: 'expense',
        splitMode: 'custom',
        splits: [{ email: 'brand-new@test.com', amount: 50 }],
      },
      { transactionId: 'txn-1' }
    );

    await updateTransaction(req, res);

    expect(mockFriendContactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-123',
        contactEmail: 'brand-new@test.com',
      })
    );
  });
});
