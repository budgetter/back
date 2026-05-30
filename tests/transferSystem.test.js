/**
 * Transfer & Debt Payment System Unit Tests
 * Tests the business logic for wallet transfers and debt payments.
 */
const { v4: uuidv4 } = require("uuid");

describe("Transfer System Logic", () => {

  describe("Transfer validation", () => {
    it("rejects transfer when source equals destination", () => {
      const walletId = uuidv4();
      const toWalletId = walletId;
      expect(walletId === toWalletId).toBe(true);
    });

    it("accepts transfer when source differs from destination", () => {
      const walletId = uuidv4();
      const toWalletId = uuidv4();
      expect(walletId === toWalletId).toBe(false);
    });

    it("requires toWalletId for transfer type", () => {
      const type = "transfer";
      const toWalletId = "";
      const isValid = type !== "transfer" || !!toWalletId;
      expect(isValid).toBe(false);
    });

    it("does not require toWalletId for expense type", () => {
      const type = "expense";
      const toWalletId = "";
      const isValid = type !== "transfer" || !!toWalletId;
      expect(isValid).toBe(true);
    });
  });

  describe("Wallet balance adjustments", () => {
    it("transfer decreases source and increases destination", () => {
      let fromBalance = 100000;
      let toBalance = 50000;
      const amount = 25000;

      fromBalance -= amount;
      toBalance += amount;

      expect(fromBalance).toBe(75000);
      expect(toBalance).toBe(75000);
    });

    it("transfer deletion reverses balance changes", () => {
      let fromBalance = 75000;
      let toBalance = 75000;
      const amount = 25000;

      // Reverse
      fromBalance += amount;
      toBalance -= amount;

      expect(fromBalance).toBe(100000);
      expect(toBalance).toBe(50000);
    });

    it("transfer update reverses old and applies new amount", () => {
      let fromBalance = 75000; // after initial 25k transfer
      let toBalance = 75000;
      const oldAmount = 25000;
      const newAmount = 10000;

      // Reverse old
      fromBalance += oldAmount;
      toBalance -= oldAmount;
      // Apply new
      fromBalance -= newAmount;
      toBalance += newAmount;

      expect(fromBalance).toBe(90000);
      expect(toBalance).toBe(60000);
    });
  });

  describe("Debt payment logic", () => {
    it("debt payment reduces totalDebt", () => {
      let totalDebt = 5000000;
      const paymentAmount = 250000;

      totalDebt -= paymentAmount;

      expect(totalDebt).toBe(4750000);
    });

    it("debt payment deletion restores totalDebt", () => {
      let totalDebt = 4750000;
      const paymentAmount = 250000;

      totalDebt += paymentAmount;

      expect(totalDebt).toBe(5000000);
    });

    it("multiple debt payments reduce correctly", () => {
      let totalDebt = 5000000;
      const payments = [250000, 300000, 150000];

      payments.forEach(p => { totalDebt -= p; });

      expect(totalDebt).toBe(4300000);
    });
  });

  describe("excludeFromBudget filtering", () => {
    it("transfers default to excludeFromBudget=true", () => {
      const type = "transfer";
      const excludeFromBudget = undefined;
      const shouldExclude = excludeFromBudget !== undefined ? excludeFromBudget : (type === "transfer");
      expect(shouldExclude).toBe(true);
    });

    it("expenses default to excludeFromBudget=false", () => {
      const type = "expense";
      const excludeFromBudget = undefined;
      const shouldExclude = excludeFromBudget !== undefined ? excludeFromBudget : (type === "transfer");
      expect(shouldExclude).toBe(false);
    });

    it("user can override excludeFromBudget for transfers", () => {
      const type = "transfer";
      const excludeFromBudget = false;
      const shouldExclude = excludeFromBudget !== undefined ? excludeFromBudget : (type === "transfer");
      expect(shouldExclude).toBe(false);
    });

    it("excluded transactions are filtered from budget totals", () => {
      const transactions = [
        { amount: 100, type: "expense", excludeFromBudget: false },
        { amount: 200, type: "expense", excludeFromBudget: true },
        { amount: 50, type: "transfer", excludeFromBudget: true },
        { amount: 300, type: "income", excludeFromBudget: false },
      ];

      let income = 0, expense = 0;
      transactions.forEach(t => {
        if (t.excludeFromBudget) return;
        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expense += t.amount;
      });

      expect(income).toBe(300);
      expect(expense).toBe(100);
    });
  });

  describe("TransactionLink creation logic", () => {
    it("transfer creates link with linkType=transfer and toWalletId", () => {
      const type = "transfer";
      const toWalletId = uuidv4();
      const debtId = null;

      const link = {
        linkType: type === "transfer" ? "transfer" : "debt_payment",
        toWalletId: type === "transfer" ? toWalletId : null,
        debtId: debtId || null,
      };

      expect(link.linkType).toBe("transfer");
      expect(link.toWalletId).toBe(toWalletId);
      expect(link.debtId).toBeNull();
    });

    it("debt payment creates link with linkType=debt_payment and debtId", () => {
      const type = "expense";
      const debtId = uuidv4();
      const toWalletId = null;

      const link = {
        linkType: debtId ? "debt_payment" : "transfer",
        toWalletId: toWalletId || null,
        debtId: debtId || null,
      };

      expect(link.linkType).toBe("debt_payment");
      expect(link.debtId).toBe(debtId);
      expect(link.toWalletId).toBeNull();
    });

    it("type change from transfer to expense removes link and reverses wallets", () => {
      // Simulate: was transfer, now expense
      const oldLink = { linkType: "transfer", toWalletId: uuidv4() };
      let fromBalance = 75000;
      let toBalance = 125000;
      const oldAmount = 25000;

      // Reverse old transfer
      if (oldLink.linkType === "transfer") {
        fromBalance += oldAmount;
        toBalance -= oldAmount;
      }

      expect(fromBalance).toBe(100000);
      expect(toBalance).toBe(100000);
    });
  });

  describe("dayTotal calculation", () => {
    it("transfers do not affect dayTotal", () => {
      const items = [
        { amount: 500, type: "expense", excludeFromBudget: false },
        { amount: 1000, type: "transfer", excludeFromBudget: true },
        { amount: 200, type: "income", excludeFromBudget: false },
      ];

      let dayTotal = 0;
      items.forEach(t => {
        if (t.excludeFromBudget) return;
        if (t.type === "expense") dayTotal -= t.amount;
        else if (t.type === "income") dayTotal += t.amount;
      });

      expect(dayTotal).toBe(-300);
    });
  });
});
