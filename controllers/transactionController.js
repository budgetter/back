const { Transaction, RecurrentPayment, TransactionSplit, User, SplitInvitation, RecurrentSplitConfig } = require('../models');
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
    frequency,
    splits, // Array of { userId?, email?, amount?, splitMode? }
    splitMode: requestSplitMode
  } = req.body;

  if (!amount || !type || !categoryId) {
    return res.status(400).json({ message: 'Missing required fields: amount, type, or categoryId' });
  }

  const splitMode = requestSplitMode || 'even';

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

    // Handle Splits
    if (splits && Array.isArray(splits) && splits.length > 0) {
      // Validate at least one participant
      if (splits.length === 0) {
        return res.status(400).json({ message: 'At least one split participant required' });
      }

      // Resolve participants and check for self-split
      const resolvedParticipants = [];
      for (const split of splits) {
        let participantUserId = split.userId || null;
        let participantEmail = split.email || null;

        // If email provided, try to resolve to a userId
        if (!participantUserId && participantEmail) {
          const existingUser = await User.findOne({ where: { email: participantEmail } });
          if (existingUser) {
            participantUserId = existingUser.id;
          }
        }

        // Self-split prevention
        if (participantUserId && participantUserId === req.user.id) {
          return res.status(400).json({ message: 'Cannot split with yourself' });
        }

        resolvedParticipants.push({
          userId: participantUserId,
          email: participantEmail,
          amount: split.amount || null,
        });
      }

      // Calculate amounts based on split mode
      if (splitMode === 'even') {
        const N = resolvedParticipants.length + 1; // participants + owner
        const perPerson = Math.floor((amount * 100) / N) / 100;

        for (let i = 0; i < resolvedParticipants.length; i++) {
          if (i === resolvedParticipants.length - 1) {
            // Last participant absorbs rounding remainder
            resolvedParticipants[i].amount = Math.round((amount - perPerson * (N - 1)) * 100) / 100;
          } else {
            resolvedParticipants[i].amount = perPerson;
          }
        }
      } else if (splitMode === 'custom') {
        // Validate all amounts are positive
        for (const p of resolvedParticipants) {
          if (!p.amount || p.amount <= 0) {
            return res.status(400).json({ message: 'All split amounts must be positive' });
          }
        }

        // Validate sum of all split amounts (including owner portion) equals total
        // Owner portion = total - sum of participant amounts
        const participantSum = resolvedParticipants.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const ownerPortion = amount - participantSum;

        if (ownerPortion <= 0 || Math.abs(participantSum + ownerPortion - amount) > 0.01) {
          return res.status(400).json({ message: 'Split amounts must equal transaction total' });
        }
      }

      // Create TransactionSplit or SplitInvitation for each participant
      for (const participant of resolvedParticipants) {
        if (participant.userId) {
          // Registered user — create TransactionSplit directly
          await TransactionSplit.create({
            id: uuidv4(),
            transactionId: transaction.id,
            userId: participant.userId,
            amount: participant.amount,
            isPaid: false,
            splitMode,
          });
        } else if (participant.email) {
          // Unregistered user — create SplitInvitation
          const invitation = await SplitInvitation.create({
            id: uuidv4(),
            transactionId: transaction.id,
            email: participant.email,
            amount: participant.amount,
            splitMode,
            status: 'pending',
            invitedBy: req.user.id,
          });

          // Also create a TransactionSplit linked to the invitation (userId null)
          await TransactionSplit.create({
            id: uuidv4(),
            transactionId: transaction.id,
            userId: null,
            amount: participant.amount,
            isPaid: false,
            splitMode,
            invitationId: invitation.id,
          });
        }
      }
    }

    // If frequency is provided and not "none"/"never", create a RecurrentPayment
    if (frequency && frequency !== 'none' && frequency !== 'never') {
      const nextPaymentDate = recurrentService.calculateNextDate(transactionDate, frequency);

      const recurrentPayment = await RecurrentPayment.create({
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

      // If splits were provided, store the split config for future recurrent occurrences
      if (splits && Array.isArray(splits) && splits.length > 0) {
        await RecurrentSplitConfig.create({
          id: uuidv4(),
          recurrentPaymentId: recurrentPayment.id,
          splitMode,
          participants: splits.map(s => ({
            userId: s.userId || null,
            email: s.email || null,
            amount: s.amount || null,
          })),
        });
      }
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
      include: [{ model: TransactionSplit }],
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
  const { splits, splitMode: requestSplitMode, TransactionSplits, ...updateData } = req.body;
  const splitMode = requestSplitMode || 'even';

  try {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Update transaction fields (exclude split-related keys)
    const safeFields = ['amount', 'description', 'date', 'type', 'categoryId', 'walletId', 'frequency'];
    for (const field of safeFields) {
      if (updateData[field] !== undefined) {
        transaction[field] = updateData[field];
      }
    }
    await transaction.save();

    // Handle splits update if splits array is provided
    if (splits !== undefined) {
      // Remove existing unpaid splits and pending invitations for this transaction
      await TransactionSplit.destroy({ where: { transactionId, isPaid: false } });
      await SplitInvitation.destroy({ where: { transactionId, status: 'pending' } });

      if (Array.isArray(splits) && splits.length > 0) {
        const amount = parseFloat(transaction.amount);

        // Resolve participants
        const resolvedParticipants = [];
        for (const split of splits) {
          let participantUserId = split.userId || null;
          let participantEmail = split.email || null;

          if (!participantUserId && participantEmail) {
            const existingUser = await User.findOne({ where: { email: participantEmail } });
            if (existingUser) {
              participantUserId = existingUser.id;
            }
          }

          if (participantUserId && participantUserId === req.user.id) {
            return res.status(400).json({ message: 'Cannot split with yourself' });
          }

          resolvedParticipants.push({
            userId: participantUserId,
            email: participantEmail,
            amount: split.amount || null,
          });
        }

        // Calculate amounts for even mode
        if (splitMode === 'even') {
          const N = resolvedParticipants.length + 1;
          const perPerson = Math.floor((amount * 100) / N) / 100;
          for (let i = 0; i < resolvedParticipants.length; i++) {
            resolvedParticipants[i].amount = i === resolvedParticipants.length - 1
              ? Math.round((amount - perPerson * (N - 1)) * 100) / 100
              : perPerson;
          }
        } else if (splitMode === 'custom') {
          for (const p of resolvedParticipants) {
            if (!p.amount || p.amount <= 0) {
              return res.status(400).json({ message: 'All split amounts must be positive' });
            }
          }
        }

        // Create new splits
        for (const participant of resolvedParticipants) {
          if (participant.userId) {
            await TransactionSplit.create({
              id: uuidv4(),
              transactionId,
              userId: participant.userId,
              amount: participant.amount,
              isPaid: false,
              splitMode,
            });
          } else if (participant.email) {
            const invitation = await SplitInvitation.create({
              id: uuidv4(),
              transactionId,
              email: participant.email,
              amount: participant.amount,
              splitMode,
              status: 'pending',
              invitedBy: req.user.id,
            });
            await TransactionSplit.create({
              id: uuidv4(),
              transactionId,
              userId: null,
              amount: participant.amount,
              isPaid: false,
              splitMode,
              invitationId: invitation.id,
            });
          }
        }
      }
    }

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
