const { BudgetCategoryPlan, BudgetSection } = require("../models");

async function addCategoryToSection(req, res) {
  const { sectionId } = req.params;
  const { categoryId, plannedAmount, type, endDate, fixed } = req.body;
  if (!categoryId || !plannedAmount || !type) {
    return res.status(400).json({
      message: "Missing required fields: categoryId, plannedAmount, or type",
    });
  }
  try {
    // 1. Fetch the section to get the budgetId
    const section = await BudgetSection.findByPk(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const plan = await BudgetCategoryPlan.create({
      budgetId: section.budgetId,
      sectionId,
      categoryId,
      plannedAmount,
      type,
      endDate: endDate || null,
      fixed: fixed || false,
    });
    return res
      .status(201)
      .json({ message: "Category added to section successfully", plan });
  } catch (error) {
    console.error("Error adding category to section:", error);
    return res
      .status(500)
      .json({ message: "Server error while adding category to section" });
  }
}

async function updateCategoryInSection(req, res) {
  const { sectionId, planId } = req.params;
  const { categoryId, plannedAmount, type, endDate, fixed } = req.body;
  try {
    const plan = await BudgetCategoryPlan.findOne({ where: { id: planId, sectionId } });
    if (!plan) return res.status(404).json({ message: 'Category plan not found' });

    if (categoryId !== undefined) plan.categoryId = categoryId;
    if (plannedAmount !== undefined) plan.plannedAmount = plannedAmount;
    if (type !== undefined) plan.type = type;
    plan.endDate = endDate || null;
    plan.fixed = fixed !== undefined ? fixed : plan.fixed;

    await plan.save();
    return res.json({ message: 'Category plan updated successfully', plan });
  } catch (error) {
    console.error('Error updating category plan:', error);
    return res.status(500).json({ message: 'Server error while updating category plan' });
  }
}

async function deleteCategoryFromSection(req, res) {
  const { sectionId, planId } = req.params;
  try {
    const plan = await BudgetCategoryPlan.findOne({
      where: { id: planId, sectionId },
    });
    if (!plan)
      return res
        .status(404)
        .json({ message: "Category plan not found in section" });
    await plan.destroy();
    return res.json({ message: "Category removed from section successfully" });
  } catch (error) {
    console.error("Error deleting category from section:", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting category from section" });
  }
}

module.exports = { addCategoryToSection,updateCategoryInSection, deleteCategoryFromSection };
