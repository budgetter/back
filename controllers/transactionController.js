const { Transaction, RecurrentPayment } = require('../models');
const recurrentService = require('../functions/recurrentService');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new transaction.
 */
async function createTransaction(req, res) {
  const {
    amount,
    description,
    date,
    type,
    categoryId,
    GroupId,
    recurrentPaymentId,
    walletId,
    frequency
  } = req.body;

  if (!amount || !type || !categoryId) {
    return res.status(400).json({ message: 'Missing required fields: amount, type, or categoryId' });
  }

  try {
    const transactionDate = date || new Date().toISOString().split('T')[0];

    const transaction = await Transaction.create({
      id: uuidv4(),
      amount,
      description,
      date: transactionDate,
      type,
      categoryId,
      UserId: req.user.id,
      GroupId: GroupId || null,
      recurrentPaymentId: recurrentPaymentId || null,
      walletId: walletId || null,
    });

    // If frequency is provided and not "none"/"never", create a RecurrentPayment
    if (frequency && frequency !== 'none' && frequency !== 'never') {
      const nextPaymentDate = recurrentService.calculateNextDate(transactionDate, frequency);

      await RecurrentPayment.create({
        id: uuidv4(),
        amount,
        description,
        frequency,
        startDate: transactionDate,
        nextPaymentDate,
        type,
        categoryId,
        userId: req.user.id,
        groupId: GroupId || null,
        walletId: walletId || null,
      });
    }

    return res.status(201).json({ message: 'Transaction created successfully', transaction });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return res.status(500).json({ message: 'Server error while creating transaction' });
  }
}


/**
 * Retrieve transactions for a specific group with pagination.
 */
async function getTransactions(req, res) {
  const { groupId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  try {
    const transactions = await Transaction.findAll({
      where: { GroupId: groupId },
      limit,
      offset,
      order: [['date', 'DESC']],
    });
    const totalCount = await Transaction.count({ where: { GroupId: groupId } });
    return res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ message: 'Server error while fetching transactions' });
  }
}

/**
 * Update an existing transaction.
 */
async function updateTransaction(req, res) {
  const { transactionId } = req.params;
  const updateData = req.body;
  try {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    Object.assign(transaction, updateData);
    await transaction.save();
    return res.json({ message: 'Transaction updated successfully', transaction });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return res.status(500).json({ message: 'Server error while updating transaction' });
  }
}

/**
 * Delete a transaction.
 */
async function deleteTransaction(req, res) {
  const { transactionId } = req.params;
  try {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    await transaction.destroy();
    return res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return res.status(500).json({ message: 'Server error while deleting transaction' });
  }
}

module.exports = {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};
