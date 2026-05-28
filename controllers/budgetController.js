const {
  Budget,
  BudgetSection,
  BudgetCategoryPlan,
  Transaction,
  Category,
  UserGroup,
  User,
  TransactionSplit,
  UserCategory,
} = require("../models");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const recurrentService = require("../functions/recurrentService");

async function createBudget(req, res) {
  const { name, ownerType = "User", ownerId, totalBudget, startDate, endDate, sections = [] } =
    req.body;

  const finalOwnerId = ownerId || (ownerType === "User" ? req.user.id : null);

  if (
    !finalOwnerId ||
    totalBudget === undefined ||
    !startDate ||
    !endDate
  ) {
    return res.status(400).json({ message: "Missing required budget fields (ownerId, totalBudget, startDate, endDate)." });
  }
  const t = await sequelize.transaction();
  try {
    const budget = await Budget.create(
      { name: name || "New Budget", ownerType, ownerId: finalOwnerId, totalBudget, startDate, endDate },
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
      include: [
        {
          model: BudgetSection,
          as: "sections",
          include: [{ model: BudgetCategoryPlan, as: "BudgetCategoryPlans" }],
        },
      ],
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
    // 1. Get Group IDs the user belongs to
    const userGroups = await UserGroup.findAll({
      where: { UserId: userId },
      attributes: ["GroupId"]
    });
    const groupIds = userGroups.map(ug => ug.GroupId);

    // 2. Find current budget (Personal or Shared)
    const budget = await Budget.findOne({
      where: {
        [Op.or]: [
          { ownerType: "User", ownerId: userId },
          { ownerType: "Group", ownerId: { [Op.in]: groupIds } }
        ],
        startDate: { [Op.lte]: currentMonthStart },
        endDate: { [Op.gte]: currentMonthStart },
      },
      include: [
        {
          model: BudgetSection,
          as: "sections",
          include: [{ model: BudgetCategoryPlan, as: "BudgetCategoryPlans" }],
        },
      ],
      order: [['ownerType', 'DESC']] // Prefer Group/Shared budgets for current view if available
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
  const { month } = req.query;

  // Validate the month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res
      .status(400)
      .json({ message: "Invalid month format. Use YYYY-MM." });
  }

  const startDate = new Date(month + "-01").toISOString().split("T")[0];
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 2, 0)
    .toISOString()
    .split("T")[0];

  try {
    const budget = await Budget.findOne({
      where: {
        ownerType: "User",
        ownerId: userId,
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: endDate },
      },
      include: [
        {
          model: BudgetSection,
          as: "sections",
          include: [{ model: BudgetCategoryPlan, as: "BudgetCategoryPlans" }],
        },
      ],
    });
    if (!budget) {
      return res
        .status(404)
        .json({ message: "No budget found for the selected month" });
    }
    return res.json(budget);
  } catch (error) {
    console.error("Error retrieving budget for month:", error);
    return res
      .status(500)
      .json({ message: "Server error retrieving budget for month" });
  }
}

async function getBudgetList(req, res) {
  const userId = req.user.id;
  try {
    // 1. Get Group IDs the user belongs to
    const userGroups = await UserGroup.findAll({
      where: { UserId: userId },
      attributes: ["GroupId"]
    });
    const groupIds = userGroups.map(ug => ug.GroupId);

    const budgets = await Budget.findAll({
      where: {
        [Op.or]: [
          { ownerType: "User", ownerId: userId },
          { ownerType: "Group", ownerId: { [Op.in]: groupIds } }
        ]
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
  const { month } = req.query;
  const { budgetId } = req.params;

  // Validate the month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res
      .status(400)
      .json({ message: "Invalid month format. Use YYYY-MM." });
  }

  try {
    // Trigger sync of recurrent payments before calculating budget
    await recurrentService.syncUserRecurrentPayments(userId);

    const startDate = new Date(month + "-01").toISOString().split("T")[0];
    const endDate = new Date(
      new Date(startDate).getFullYear(),
      new Date(startDate).getMonth() + 2,
      0
    )
      .toISOString()
      .split("T")[0];

    // Get the budget for the month or by ID
    let budget;
    if (budgetId && budgetId !== 'current') {
      budget = await Budget.findByPk(budgetId, {
        include: [
          {
            model: BudgetSection,
            as: "sections",
            include: [
              {
                model: BudgetCategoryPlan,
                as: "BudgetCategoryPlans",
                include: [
                  { model: Category, attributes: ["id", "name", "icon", "type"] },
                  { model: UserCategory, as: "userCategory", attributes: ["id", "customName", "customIcon", "color1", "color2", "categoryId"], required: false, include: [{ model: Category, attributes: ["name", "icon", "translationKey"] }] }
                ]
              }
            ],
          },
        ],
      });
    } else {
      // Get Group IDs the user belongs to for "current" fallback
      const userGroups = await UserGroup.findAll({
        where: { UserId: userId },
        attributes: ["GroupId"]
      });
      const groupIds = userGroups.map(ug => ug.GroupId);

      budget = await Budget.findOne({
        where: {
          [Op.or]: [
            { ownerType: "User", ownerId: userId },
            { ownerType: "Group", ownerId: { [Op.in]: groupIds } }
          ],
          startDate: { [Op.lte]: startDate },
          endDate: { [Op.gte]: startDate }, // Use month start for period check
        },
        include: [
          {
            model: BudgetSection,
            as: "sections",
            include: [
              {
                model: BudgetCategoryPlan,
                as: "BudgetCategoryPlans",
                include: [
                  { model: Category, attributes: ["id", "name", "icon", "type"] },
                  { model: UserCategory, as: "userCategory", attributes: ["id", "customName", "customIcon", "color1", "color2", "categoryId"], required: false, include: [{ model: Category, attributes: ["name", "icon", "translationKey"] }] }
                ]
              }
            ],
          },
        ],
        order: [['ownerType', 'DESC']]
      });
    }

    // If no budget found, we still want to show transactions as "Not Planned"
    if (!budget) {
      budget = {
        id: 0,
        totalBudget: 0,
        sections: [],
        toJSON: () => ({ id: 0, totalBudget: 0 })
      };
    }

    // Define transaction filter based on budget owner
    const transactionWhere = {
      date: {
        [Op.between]: [startDate, endDate],
      },
    };

    if (budget.ownerType === 'Group') {
      transactionWhere.GroupId = budget.ownerId;
    } else {
      transactionWhere.UserId = userId;
      transactionWhere.GroupId = null; // Only personal transactions? 
      // Actually usually personal ones don't have GroupId. 
    }

    // Get all transactions for the month with category details and splits
    const transactions = await Transaction.findAll({
      where: transactionWhere,
      include: [
        { model: Category, attributes: ["id", "name", "icon", "type"] },
        { model: TransactionSplit, attributes: ["amount"] },
      ],
    });

    // Check user's budget split mode preference
    const userRecord = await User.findByPk(userId, { attributes: ["budgetSplitMode"] });
    const splitMode = userRecord?.budgetSplitMode || 'total';

    // Create a map of category totals by type (expense vs income)
    const categoryTotals = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((trans) => {
      const catId = trans.userCategoryId;
      let amount = parseFloat(trans.amount || 0);
      const category = trans.Category;
      const type = category ? category.type : trans.type;

      // If split_only mode, subtract split portions to get owner's share
      if (splitMode === 'split_only' && trans.TransactionSplits && trans.TransactionSplits.length > 0) {
        const splitTotal = trans.TransactionSplits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
        amount = Math.max(0, amount - splitTotal);
      }

      if (!categoryTotals[catId]) {
        categoryTotals[catId] = {
          amount: 0,
          name: category ? category.name : "Unknown",
          icon: category ? category.icon : "FiHelpCircle",
          type: type
        };
      }
      categoryTotals[catId].amount += amount;

      if (type === "income") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });

    // Collect all categoryIds from budget plans
    const budgetCategoryIds = new Set();
    const budgetSections = budget.sections || [];
    budgetSections.forEach((section) => {
      const plans = section.BudgetCategoryPlans || [];
      plans.forEach((plan) => {
        budgetCategoryIds.add(plan.categoryId);
      });
    });

    // Prepare extra categories data (for those not in the budget plan)
    const extraCategoryPlans = [];
    const budgetSectionsPlain = budgetSections.map((section) =>
      section.get ? section.get({ plain: true }) : section
    );

    // Find "Not Planned" section if it exists
    let generalSection = budgetSectionsPlain.find(
      (s) => s.name === "Not Planned"
    );

    Object.keys(categoryTotals).forEach((catId) => {
      if (!budgetCategoryIds.has(catId)) {
        const cat = categoryTotals[catId];
        extraCategoryPlans.push({
          id: `extra-${catId}`,
          categoryId: catId,
          name: cat.name,
          icon: cat.icon,
          plannedAmount: 0,
          type: cat.type,
          spent: cat.amount,
          remaining: cat.type === "income" ? cat.amount : 0 - cat.amount,
          percentageUsed: 100,
        });
      }
    });

    if (extraCategoryPlans.length > 0) {
      if (!generalSection) {
        generalSection = {
          id: "noPlanned",
          name: "Not Planned",
          BudgetCategoryPlans: [],
        };
        budgetSectionsPlain.push(generalSection);
      }
      generalSection.BudgetCategoryPlans = generalSection.BudgetCategoryPlans.concat(extraCategoryPlans);
      budget.sections = budgetSectionsPlain;
    }

    const sectionsWithRemaining = budget.sections.map((section) => {
      const plans = (section.BudgetCategoryPlans || []).filter(plan => {
        // Exclude plans that expired before this month
        if (!plan.endDate) return true;
        return plan.endDate >= startDate;
      });
      const updatedCategories = plans.map((plan) => {
        // Skip if already processed as 'extra'
        if (typeof plan.id === 'string' && plan.id.startsWith('extra-')) return plan;

        const catData = categoryTotals[plan.userCategoryId];
        const spent = catData ? catData.amount : 0;

        // Use type from Category if available, else from plan
        const type = plan.Category ? plan.Category.type : (plan.type || 'expense');

        let remaining;
        if (type === "income") {
          remaining = spent - parseFloat(plan.plannedAmount);
        } else {
          remaining = parseFloat(plan.plannedAmount) - spent;
        }

        const percentageUsed =
          parseFloat(plan.plannedAmount) > 0
            ? (spent / parseFloat(plan.plannedAmount)) * 100
            : (spent > 0 ? 100 : 0);

        const planData =
          plan && typeof plan.toJSON === "function" ? plan.toJSON() : plan;

        const uc = plan.userCategory || planData.userCategory;
        const ucCat = uc?.Category || null;
        return {
          ...planData,
          spent,
          remaining,
          type,
          userCategoryId: plan.userCategoryId,
          percentageUsed: Math.min(Math.max(percentageUsed, 0), 100),
          name: uc?.customName || ucCat?.name || (plan.Category ? plan.Category.name : (planData.name || 'Unknown')),
          icon: uc?.customIcon || ucCat?.icon || (plan.Category ? plan.Category.icon : (planData.icon || null)),
          color1: uc?.color1 || null,
        };
      });

      const sectionData =
        section && typeof section.toJSON === "function"
          ? section.toJSON()
          : section;

      return {
        ...sectionData,
        categories: updatedCategories,
      };
    });

    const budgetPlain = budget && typeof budget.toJSON === "function" ? budget.toJSON() : budget;

    return res.json({
      budget: budgetPlain,
      sections: sectionsWithRemaining,
      stats: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense
      },
      month,
    });
  } catch (error) {
    console.error("Error calculating remaining budget:", error);
    return res
      .status(500)
      .json({ message: "Server error calculating remaining budget" });
  }
}

const BudgetService = require("../functions/budgetService");

async function createDefaultBudget(req, res) {
  const userId = req.user.id;
  try {
    const budget = await BudgetService.createDefaultBudget(userId);
    return res.status(201).json({
      message: "Default budget created successfully",
      budget,
    });
  } catch (error) {
    console.error("Error creating default budget:", error);
    return res
      .status(500)
      .json({ message: "Server error while creating default budget" });
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
  getRemainingBudget,
  createDefaultBudget,
};
