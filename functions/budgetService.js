const Budget = require("../models/Budget");

class BudgetService {
  static async createDefaultBudget(userId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startDate = new Date(year, month, 1, 0).toISOString().split("T")[0];
    const endDate = new Date(year + 100, month, 30, 0).toISOString().split("T")[0];

    return Budget.create({
      ownerType: "User",
      ownerId: userId,
      name: "Personal Budget",
      totalBudget: 0,
      startDate,
      endDate,
    });
  }
}

module.exports = BudgetService;
