const { Budget, BudgetCategoryPlan, Category } = require('../models');
const sequelize = require('../config/database');

/**
 * Create a new budget along with its category plans.
 */
async function createBudget(req, res) {
  const { ownerType, ownerId, totalBudget, startDate, endDate, categoryPlans } = req.body;
  if (!ownerType || !ownerId || !totalBudget || !startDate || !endDate || !categoryPlans) {
    return res.status(400).json({ message: 'Missing required budget fields.' });
  }

  // Use a transaction for atomicity.
  const t = await sequelize.transaction();
  try {
    const budget = await Budget.create(
      { ownerType, ownerId, totalBudget, startDate, endDate },
      { transaction: t }
    );
    
    // Create associated category plans.
    const plans = await Promise.all(categoryPlans.map(plan => {
      return BudgetCategoryPlan.create({
        budgetId: budget.id,
        categoryId: plan.categoryId,
        plannedAmount: plan.plannedAmount
      }, { transaction: t });
    }));

    await t.commit();
    return res.status(201).json({
      message: 'Budget created successfully',
      budget: {
        id: budget.id,
        ownerType: budget.ownerType,
        ownerId: budget.ownerId,
        totalBudget: budget.totalBudget,
        startDate: budget.startDate,
        endDate: budget.endDate,
        categoryPlans: plans
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating budget:', error);
    return res.status(500).json({ message: 'Server error while creating budget' });
  }
}

/**
 * Get details for a specific budget.
 */
async function getBudget(req, res) {
  const { budgetId } = req.params;
  try {
    const budget = await Budget.findByPk(budgetId, {
      include: [{ model: BudgetCategoryPlan, include: [Category] }]
    });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    return res.json(budget);
  } catch (error) {
    console.error('Error fetching budget:', error);
    return res.status(500).json({ message: 'Server error while fetching budget' });
  }
}

/**
 * Update budget details.
 */
async function updateBudget(req, res) {
  const { budgetId } = req.params;
  const updateData = req.body;
  try {
    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    
    // Update budget fields (only those provided)
    Object.assign(budget, updateData);
    await budget.save();
    return res.json({ message: 'Budget updated successfully', budget });
  } catch (error) {
    console.error('Error updating budget:', error);
    return res.status(500).json({ message: 'Server error while updating budget' });
  }
}

/**
 * Delete a budget.
 */
async function deleteBudget(req, res) {
  const { budgetId } = req.params;
  try {
    const budget = await Budget.findByPk(budgetId);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    await budget.destroy();
    return res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return res.status(500).json({ message: 'Server error while deleting budget' });
  }
}

module.exports = {
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
};
