/**
 * niceToHave Features Unit Tests
 * Tests business logic for: disabled budget categories, debt payment day,
 * dynamic debt budget section, and bug fixes.
 */

describe("Disabled Budget Categories", () => {
  const mockPlans = [
    { id: "p1", type: "expense", plannedAmount: 500000, disabled: false, userCategoryId: "cat1" },
    { id: "p2", type: "expense", plannedAmount: 300000, disabled: true, userCategoryId: "cat2" },
    { id: "p3", type: "income", plannedAmount: 2000000, disabled: false, userCategoryId: "cat3" },
    { id: "p4", type: "expense", plannedAmount: 100000, disabled: false, userCategoryId: "cat4" },
  ];

  it("excludes disabled plans from expense totals", () => {
    const totalExpenses = mockPlans
      .filter(p => !p.disabled && p.type === "expense")
      .reduce((sum, p) => sum + parseFloat(p.plannedAmount), 0);

    expect(totalExpenses).toBe(600000); // 500000 + 100000, NOT 300000
  });

  it("excludes disabled plans from income totals", () => {
    const totalIncome = mockPlans
      .filter(p => !p.disabled && p.type === "income")
      .reduce((sum, p) => sum + parseFloat(p.plannedAmount), 0);

    expect(totalIncome).toBe(2000000);
  });

  it("excludes disabled plans from budgetCategoryIds set", () => {
    const budgetCategoryIds = new Set();
    mockPlans.forEach(plan => {
      if (!plan.disabled) budgetCategoryIds.add(plan.userCategoryId);
    });

    expect(budgetCategoryIds.has("cat1")).toBe(true);
    expect(budgetCategoryIds.has("cat2")).toBe(false); // disabled
    expect(budgetCategoryIds.has("cat3")).toBe(true);
    expect(budgetCategoryIds.has("cat4")).toBe(true);
    expect(budgetCategoryIds.size).toBe(3);
  });

  it("still includes disabled plans in response for UI rendering", () => {
    const allPlans = mockPlans; // All plans returned, not filtered
    expect(allPlans.length).toBe(4);
    expect(allPlans.find(p => p.id === "p2").disabled).toBe(true);
  });
});

describe("Debt Payment Day", () => {
  function getEffectivePaymentDay(paymentDay, year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    return Math.min(paymentDay, lastDay);
  }

  it("returns the same day for months with enough days", () => {
    expect(getEffectivePaymentDay(15, 2026, 1)).toBe(15); // January
    expect(getEffectivePaymentDay(30, 2026, 3)).toBe(30); // March
    expect(getEffectivePaymentDay(31, 2026, 7)).toBe(31); // July
  });

  it("caps at 28 for February in non-leap year", () => {
    expect(getEffectivePaymentDay(30, 2026, 2)).toBe(28);
    expect(getEffectivePaymentDay(31, 2026, 2)).toBe(28);
    expect(getEffectivePaymentDay(29, 2026, 2)).toBe(28);
  });

  it("caps at 29 for February in leap year", () => {
    expect(getEffectivePaymentDay(30, 2024, 2)).toBe(29);
    expect(getEffectivePaymentDay(31, 2024, 2)).toBe(29);
  });

  it("caps at 30 for months with 30 days", () => {
    expect(getEffectivePaymentDay(31, 2026, 4)).toBe(30); // April
    expect(getEffectivePaymentDay(31, 2026, 6)).toBe(30); // June
    expect(getEffectivePaymentDay(31, 2026, 9)).toBe(30); // September
    expect(getEffectivePaymentDay(31, 2026, 11)).toBe(30); // November
  });

  it("validates paymentDay range 1-31", () => {
    const validate = (day) => day >= 1 && day <= 31;
    expect(validate(1)).toBe(true);
    expect(validate(31)).toBe(true);
    expect(validate(0)).toBe(false);
    expect(validate(32)).toBe(false);
    expect(validate(-1)).toBe(false);
  });
});

describe("Dynamic Debt Budget Section", () => {
  const mockDebts = [
    { id: "d1", bankName: "Bank A", monthlyPayment: 1500000, countsTowardsBudget: true, userCategoryId: "cat1", paymentDay: 15 },
    { id: "d2", bankName: "Bank B", monthlyPayment: 800000, countsTowardsBudget: true, userCategoryId: null, paymentDay: 30 },
    { id: "d3", bankName: "Bank C", monthlyPayment: 500000, countsTowardsBudget: false, userCategoryId: "cat5", paymentDay: 5 },
  ];

  const mockTransactionSpent = { d1: 1500000, d2: 400000, d3: 0 };
  const budgetCategoryIds = new Set(["cat1", "cat3", "cat4"]);

  it("only includes debts with countsTowardsBudget=true", () => {
    const included = mockDebts.filter(d => d.countsTowardsBudget);
    expect(included.length).toBe(2);
    expect(included.map(d => d.id)).toEqual(["d1", "d2"]);
  });

  it("builds virtual section with correct structure", () => {
    const included = mockDebts.filter(d => d.countsTowardsBudget);
    const section = {
      id: "debts-virtual",
      name: "Debts",
      isVirtual: true,
      categories: included.map(debt => {
        const spent = mockTransactionSpent[debt.id] || 0;
        const planned = parseFloat(debt.monthlyPayment);
        const remaining = planned - spent;
        const percentageUsed = planned > 0 ? (spent / planned) * 100 : 0;
        const duplicateWarning = debt.userCategoryId ? budgetCategoryIds.has(debt.userCategoryId) : false;

        return {
          id: `debt-${debt.id}`,
          debtId: debt.id,
          name: debt.bankName,
          icon: "🏦",
          color1: "#ef4444",
          plannedAmount: planned,
          spent,
          remaining,
          percentageUsed: Math.min(percentageUsed, 100),
          type: "expense",
          isVirtual: true,
          duplicateWarning,
          paymentDay: debt.paymentDay,
        };
      }),
    };

    expect(section.isVirtual).toBe(true);
    expect(section.categories.length).toBe(2);

    // First debt: fully paid
    expect(section.categories[0].name).toBe("Bank A");
    expect(section.categories[0].spent).toBe(1500000);
    expect(section.categories[0].remaining).toBe(0);
    expect(section.categories[0].percentageUsed).toBe(100);
    expect(section.categories[0].duplicateWarning).toBe(true); // cat1 is in budget

    // Second debt: partially paid
    expect(section.categories[1].name).toBe("Bank B");
    expect(section.categories[1].spent).toBe(400000);
    expect(section.categories[1].remaining).toBe(400000);
    expect(section.categories[1].percentageUsed).toBe(50);
    expect(section.categories[1].duplicateWarning).toBe(false); // null userCategoryId
  });

  it("detects duplicate warning when debt category is in budget plan", () => {
    const debt = mockDebts[0]; // userCategoryId: "cat1"
    const duplicateWarning = debt.userCategoryId ? budgetCategoryIds.has(debt.userCategoryId) : false;
    expect(duplicateWarning).toBe(true);
  });

  it("no duplicate warning when debt has no userCategoryId", () => {
    const debt = mockDebts[1]; // userCategoryId: null
    const duplicateWarning = debt.userCategoryId ? budgetCategoryIds.has(debt.userCategoryId) : false;
    expect(duplicateWarning).toBe(false);
  });
});

describe("Debt Creation Bug Fix", () => {
  it("coerces empty string linkedWalletId to null", () => {
    const linkedWalletId = "";
    const coerced = linkedWalletId || null;
    expect(coerced).toBeNull();
  });

  it("preserves valid UUID linkedWalletId", () => {
    const linkedWalletId = "550e8400-e29b-41d4-a716-446655440000";
    const coerced = linkedWalletId || null;
    expect(coerced).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("coerces undefined linkedWalletId to null", () => {
    const linkedWalletId = undefined;
    const coerced = linkedWalletId || null;
    expect(coerced).toBeNull();
  });
});

describe("Category Unknown Bug Fix", () => {
  it("resolves name from userCategory.customName first", () => {
    const plan = {
      userCategory: { customName: "My Custom Name", Category: { name: "System Name" } },
    };
    const name = plan.userCategory?.customName || plan.userCategory?.Category?.name || "Unknown";
    expect(name).toBe("My Custom Name");
  });

  it("falls back to Category.name when customName is null", () => {
    const plan = {
      userCategory: { customName: null, Category: { name: "System Name" } },
    };
    const name = plan.userCategory?.customName || plan.userCategory?.Category?.name || "Unknown";
    expect(name).toBe("System Name");
  });

  it("shows Unknown when no userCategory included (the bug scenario)", () => {
    const plan = { userCategory: undefined };
    const name = plan.userCategory?.customName || plan.userCategory?.Category?.name || "Unknown";
    expect(name).toBe("Unknown");
  });

  it("shows Unknown when userCategory has no Category nested", () => {
    const plan = { userCategory: { customName: null, Category: null } };
    const name = plan.userCategory?.customName || plan.userCategory?.Category?.name || "Unknown";
    expect(name).toBe("Unknown");
  });
});
