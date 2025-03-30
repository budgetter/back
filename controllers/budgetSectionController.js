const { BudgetSection, BudgetCategoryPlan } = require('../models');

async function createSection(req, res) {
  const { budgetId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Section name is required' });
  try {
    const section = await BudgetSection.create({ budgetId, name });
    return res.status(201).json({ message: 'Section created successfully', section });
  } catch (error) {
    console.error('Error creating section:', error);
    return res.status(500).json({ message: 'Server error while creating section' });
  }
}

async function deleteSection(req, res) {
  const { sectionId } = req.params;
  try {
    const section = await BudgetSection.findByPk(sectionId, { include: [BudgetCategoryPlan] });
    if (!section) return res.status(404).json({ message: 'Section not found' });
    if (section.BudgetCategoryPlans && section.BudgetCategoryPlans.length > 0) {
      return res.status(400).json({ message: 'Cannot delete section with existing categories' });
    }
    await section.destroy();
    return res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Error deleting section:', error);
    return res.status(500).json({ message: 'Server error while deleting section' });
  }
}

module.exports = { createSection, deleteSection };
