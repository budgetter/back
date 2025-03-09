const RecurrentPayment = require('../models/RecurrentPayment');

/**
 * Create a recurrent payment.
 */
async function createRecurrentPayment(req, res) {
  const { amount, frequency, startDate, endDate, nextPaymentDate, categoryId, UserId, GroupId } = req.body;
  if (!amount || !frequency || !startDate || !nextPaymentDate || !categoryId || !UserId) {
    return res.status(400).json({ message: 'Missing required fields for recurrent payment.' });
  }
  try {
    const recurrentPayment = await RecurrentPayment.create({
      amount,
      frequency,
      startDate,
      endDate: endDate || null,
      nextPaymentDate,
      categoryId,
      UserId,
      GroupId: GroupId || null,
    });
    return res.status(201).json({
      message: 'Recurrent payment created successfully',
      recurrentPayment,
    });
  } catch (error) {
    console.error('Error creating recurrent payment:', error);
    return res.status(500).json({ message: 'Server error while creating recurrent payment' });
  }
}

/**
 * Get all recurrent payments.
 */
async function getRecurrentPayments(req, res) {
  try {
    const recurrentPayments = await RecurrentPayment.findAll();
    return res.json(recurrentPayments);
  } catch (error) {
    console.error('Error fetching recurrent payments:', error);
    return res.status(500).json({ message: 'Server error while fetching recurrent payments' });
  }
}

/**
 * Update a recurrent payment.
 */
async function updateRecurrentPayment(req, res) {
  const { id } = req.params;
  const updateData = req.body;
  try {
    const recurrentPayment = await RecurrentPayment.findByPk(id);
    if (!recurrentPayment) return res.status(404).json({ message: 'Recurrent payment not found' });
    Object.assign(recurrentPayment, updateData);
    await recurrentPayment.save();
    return res.json({ message: 'Recurrent payment updated successfully', recurrentPayment });
  } catch (error) {
    console.error('Error updating recurrent payment:', error);
    return res.status(500).json({ message: 'Server error while updating recurrent payment' });
  }
}

/**
 * Delete a recurrent payment.
 */
async function deleteRecurrentPayment(req, res) {
  const { id } = req.params;
  try {
    const recurrentPayment = await RecurrentPayment.findByPk(id);
    if (!recurrentPayment) return res.status(404).json({ message: 'Recurrent payment not found' });
    await recurrentPayment.destroy();
    return res.json({ message: 'Recurrent payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurrent payment:', error);
    return res.status(500).json({ message: 'Server error while deleting recurrent payment' });
  }
}

module.exports = {
  createRecurrentPayment,
  getRecurrentPayments,
  updateRecurrentPayment,
  deleteRecurrentPayment,
};
