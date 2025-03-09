const Debt = require('../models/Debt');

/**
 * Create a new debt record.
 */
async function createDebt(req, res) {
  const { principal, interestRate, term, startDate, monthlyPayment, categoryId, UserId, GroupId } = req.body;
  if (!principal || !interestRate || !term || !startDate || !monthlyPayment || !categoryId || !UserId) {
    return res.status(400).json({ message: 'Missing required fields for debt creation.' });
  }
  try {
    const debt = await Debt.create({
      principal,
      interestRate,
      term,
      startDate,
      monthlyPayment,
      categoryId,
      UserId,
      GroupId: GroupId || null,
    });
    return res.status(201).json({
      message: 'Debt created successfully',
      debt,
    });
  } catch (error) {
    console.error('Error creating debt:', error);
    return res.status(500).json({ message: 'Server error while creating debt' });
  }
}

/**
 * Get all debts.
 */
async function getDebts(req, res) {
  try {
    const debts = await Debt.findAll();
    return res.json(debts);
  } catch (error) {
    console.error('Error fetching debts:', error);
    return res.status(500).json({ message: 'Server error while fetching debts' });
  }
}

/**
 * Update a debt record.
 */
async function updateDebt(req, res) {
  const { id } = req.params;
  const updateData = req.body;
  try {
    const debt = await Debt.findByPk(id);
    if (!debt) return res.status(404).json({ message: 'Debt not found' });
    Object.assign(debt, updateData);
    await debt.save();
    return res.json({ message: 'Debt updated successfully', debt });
  } catch (error) {
    console.error('Error updating debt:', error);
    return res.status(500).json({ message: 'Server error while updating debt' });
  }
}

/**
 * Delete a debt record.
 */
async function deleteDebt(req, res) {
  const { id } = req.params;
  try {
    const debt = await Debt.findByPk(id);
    if (!debt) return res.status(404).json({ message: 'Debt not found' });
    await debt.destroy();
    return res.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    console.error('Error deleting debt:', error);
    return res.status(500).json({ message: 'Server error while deleting debt' });
  }
}

module.exports = {
  createDebt,
  getDebts,
  updateDebt,
  deleteDebt,
};
