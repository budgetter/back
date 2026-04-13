/**
 * Unit tests for splitResolutionService.resolveInvitations
 *
 * Mocks the models module to validate service logic without a live MySQL connection.
 */

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockFindAll = jest.fn();
const mockCreate = jest.fn();

// Mock the entire models module to prevent any DB connection
jest.mock("../models", () => ({
  sequelize: {
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
  SplitInvitation: {
    findAll: mockFindAll,
  },
  TransactionSplit: {
    create: mockCreate,
  },
}));

const { resolveInvitations } = require("../services/splitResolutionService");

describe("splitResolutionService - resolveInvitations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("resolves pending invitations and creates TransactionSplit records", async () => {
    const mockInvitations = [
      {
        id: "inv-1",
        transactionId: "txn-1",
        email: "invitee@test.com",
        amount: 50.0,
        splitMode: "even",
        invitedBy: "owner-1",
        update: jest.fn(),
      },
      {
        id: "inv-2",
        transactionId: "txn-2",
        email: "invitee@test.com",
        amount: 30.0,
        splitMode: "custom",
        invitedBy: "owner-1",
        update: jest.fn(),
      },
    ];

    mockFindAll.mockResolvedValue(mockInvitations);
    mockCreate.mockResolvedValue({});

    const resolved = await resolveInvitations("invitee@test.com", "user-123");

    expect(resolved).toBe(2);

    // Verify findAll was called with correct filters
    expect(mockFindAll).toHaveBeenCalledWith({
      where: { email: "invitee@test.com", status: "pending" },
      transaction: mockTransaction,
    });

    // Verify TransactionSplit.create was called for each invitation
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith(
      {
        transactionId: "txn-1",
        userId: "user-123",
        amount: 50.0,
        splitMode: "even",
        invitationId: "inv-1",
      },
      { transaction: mockTransaction }
    );
    expect(mockCreate).toHaveBeenCalledWith(
      {
        transactionId: "txn-2",
        userId: "user-123",
        amount: 30.0,
        splitMode: "custom",
        invitationId: "inv-2",
      },
      { transaction: mockTransaction }
    );

    // Verify each invitation was updated to resolved
    mockInvitations.forEach((inv) => {
      expect(inv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "resolved",
          resolvedUserId: "user-123",
          resolvedAt: expect.any(Date),
        }),
        { transaction: mockTransaction }
      );
    });

    // Verify transaction was committed
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  test("returns 0 and commits when no pending invitations exist", async () => {
    mockFindAll.mockResolvedValue([]);

    const resolved = await resolveInvitations("nobody@test.com", "user-123");

    expect(resolved).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  test("rolls back transaction on error", async () => {
    mockFindAll.mockRejectedValue(new Error("DB error"));

    await expect(
      resolveInvitations("invitee@test.com", "user-123")
    ).rejects.toThrow("DB error");

    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  test("rolls back if TransactionSplit.create fails mid-way", async () => {
    const mockInvitation = {
      id: "inv-1",
      transactionId: "txn-1",
      email: "invitee@test.com",
      amount: 50.0,
      splitMode: "even",
      invitedBy: "owner-1",
      update: jest.fn(),
    };

    mockFindAll.mockResolvedValue([mockInvitation]);
    mockCreate.mockRejectedValue(new Error("Create failed"));

    await expect(
      resolveInvitations("invitee@test.com", "user-123")
    ).rejects.toThrow("Create failed");

    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  test("preserves invitation amount and splitMode in created TransactionSplit", async () => {
    const mockInvitation = {
      id: "inv-99",
      transactionId: "txn-99",
      email: "test@example.com",
      amount: 123.45,
      splitMode: "custom",
      invitedBy: "owner-1",
      update: jest.fn(),
    };

    mockFindAll.mockResolvedValue([mockInvitation]);
    mockCreate.mockResolvedValue({});

    await resolveInvitations("test@example.com", "user-456");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "txn-99",
        userId: "user-456",
        amount: 123.45,
        splitMode: "custom",
        invitationId: "inv-99",
      }),
      expect.any(Object)
    );
  });
});
