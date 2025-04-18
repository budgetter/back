const Budget = require("../models/Budget");
const BudgetSection = require("../models/BudgetSection");
const BudgetCategoryPlan = require("../models/BudgetCategoryPlan");
const Transaction = require("../models/Transaction");
const sequelize = require("../config/database");
const { Op } = require("sequelize");

async function createBudget(req, res) {
  const { ownerType, ownerId, totalBudget, startDate, endDate, sections } =
    req.body;
  if (
    !ownerType ||
    !ownerId ||
    !totalBudget ||
    !startDate ||
    !endDate ||
    !sections
  ) {
    return res.status(400).json({ message: "Missing required budget fields." });
  }
  const t = await sequelize.transaction();
  try {
    const budget = await Budget.create(
      { ownerType, ownerId, totalBudget, startDate, endDate },
      { transaction: t }
    );
    const createdSections = [];
    for (const section of sections) {
      const { name, items } = section;
      const budgetSection = await BudgetSection.create(
        { budgetId: budget.id, name },
        { transaction: t }
      );
      const createdItems = await Promise.all(
        items.map((item) => {
          return BudgetCategoryPlan.create(
            {
              budgetId: budget.id,
              sectionId: budgetSection.id,
              categoryId: item.categoryId,
              plannedAmount: item.plannedAmount,
              type: item.type,
              endDate: item.endDate || null,
              fixed: item.fixed,
            },
            { transaction: t }
          );
        })
      );
      createdSections.push({ section: budgetSection, items: createdItems });
    }
    await t.commit();
    return res.status(201).json({
      message: "Budget created successfully",
      budget,
      sections: createdSections,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error creating budget:", error);
    return res
      .status(500)
      .json({ message: "Server error while creating budget" });
  }
}

async function getBudget(req, res) {
  const { budgetId } = req.params;
  try {
    const budget = await Budget.findByPk(budgetId, {
      include: [{ model: BudgetSection, include: [BudgetCategoryPlan] }],
    });
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    return res.json(budget);
  } catch (error) {
    console.error("Error fetching budget:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching budget" });
  }
}

async function updateBudget(req, res) {
  const { budgetId } = req.params;
  const updateData = req.body;
  try {
    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    Object.assign(budget, updateData);
    await budget.save();
    return res.json({ message: "Budget updated successfully", budget });
  } catch (error) {
    console.error("Error updating budget:", error);
    return res
      .status(500)
      .json({ message: "Server error while updating budget" });
  }
}

async function deleteBudget(req, res) {
  const { budgetId } = req.params;
  try {
    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    await budget.destroy();
    return res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    console.error("Error deleting budget:", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting budget" });
  }
}

async function getCurrentBudget(req, res) {
  const userId = req.user.id;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  try {
    const budget = await Budget.findOne({
      where: {
        ownerType: "User",
        ownerId: userId,
        startDate: { [Op.lte]: currentMonthStart },
        endDate: { [Op.gte]: currentMonthStart },
      },
      include: [{ model: BudgetSection, include: [BudgetCategoryPlan] }],
    });
    if (!budget) {
      return res.status(404).json({ message: "No current budget found" });
    }
    return res.json(budget);
  } catch (error) {
    console.error("Error retrieving current budget:", error);
    return res
      .status(500)
      .json({ message: "Server error retrieving current budget" });
  }
}

async function getBudgetForMonth(req, res) {
  const userId = req.user.id;
  const { month } = req.query; // Expecting a month parameter

  // Validate the month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "Invalid month format. Use YYYY-MM." });
  }

  const startDate = new Date(month + "-01").toISOString().split("T")[0]; // First day of the month
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).toISOString().split("T")[0]; // Last day of the month
  
  try {
    const budget = await Budget.findOne({
      where: {
        ownerType: "User",
        ownerId: userId,
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: endDate },
      },
      include: [{ model: BudgetSection, include: [BudgetCategoryPlan] }],
    });
    if (!budget) {
      return res.status(404).json({ message: "No budget found for the selected month" });
    }
    return res.json(budget);
  } catch (error) {
    console.error("Error retrieving budget for month:", error);
    return res.status(500).json({ message: "Server error retrieving budget for month" });
  }
}

async function getBudgetList(req, res) {
  const userId = req.user.id;
  try {
    const budgets = await Budget.findAll({
      where: {
        ownerType: "User",
        ownerId: userId,
      },
      order: [["startDate", "DESC"]],
    });
    return res.json(budgets);
  } catch (error) {
    console.error("Error retrieving budget list:", error);
    return res
      .status(500)
      .json({ message: "Server error retrieving budget list" });
  }
}

async function getRemainingBudget(req, res) {
  const userId = req.user.id;
  const { month } = req.query; // Expecting a month parameter in YYYY-MM format

  // Validate the month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "Invalid month format. Use YYYY-MM." });
  }

  const startDate = new Date(month + "-01").toISOString().split("T")[0];
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split("T")[0];

  try {
    // Get the budget for the month
    const budget = await Budget.findOne({
      where: {
        ownerType: "User",
        ownerId: userId,
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: endDate },
      },
      include: [{ 
        model: BudgetSection,
        include: [BudgetCategoryPlan]
      }],
    });

    if (!budget) {
      return res.status(404).json({ message: "No budget found for the selected month" });
    }

    // Get all transactions for the month
    const transactions = await Transaction.findAll({
      where: {
        userId,
        date: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'categoryId',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['categoryId']
    });

    // Create a map of category totals
    const categoryTotals = transactions.reduce((acc, trans) => {
      acc[trans.categoryId] = parseFloat(trans.getDataValue('totalAmount') || 0);
      return acc;
    }, {});

    // Calculate remaining amounts for each section and category
    const sectionsWithRemaining = budget.BudgetSections.map(section => {
      const categories = section.BudgetCategoryPlans.map(plan => {
        const spent = categoryTotals[plan.categoryId] || 0;
        const remaining = parseFloat(plan.plannedAmount) - spent;
        const percentageUsed = (spent / parseFloat(plan.plannedAmount)) * 100;

        return {
          ...plan.toJSON(),
          spent,
          remaining,
          percentageUsed: Math.min(Math.max(percentageUsed, 0), 100) // Ensure between 0-100
        };
      });

      return {
        ...section.toJSON(),
        categories
      };
    });

    return res.json({
      budget: budget.toJSON(),
      sections: sectionsWithRemaining,
      month
    });

  } catch (error) {
    console.error("Error calculating remaining budget:", error);
    return res.status(500).json({ message: "Server error calculating remaining budget" });
  }
}

module.exports = {
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
  getCurrentBudget,
  getBudgetList,
  getBudgetForMonth,
  getRemainingBudget
};
