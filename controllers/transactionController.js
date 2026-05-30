const { Transaction, RecurrentPayment, TransactionSplit, User, SplitInvitation, RecurrentSplitConfig, FriendContact, TransactionLink, Wallet, Debt } = require('../models');
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
    userCategoryId,
    GroupId,
    recurrentPaymentId,
    walletId,
    frequency,
    toWalletId,
    debtId,
    excludeFromBudget,
    splits,
    splitMode: requestSplitMode
  } = req.body;

  if (!amount || !type) {
    return res.status(400).json({ message: 'Missing required fields: amount or type' });
  }

  // Transfer validation
  if (type === 'transfer') {
    if (!walletId || !toWalletId) {
      return res.status(400).json({ message: 'Transfer requires both source and destination wallets' });
    }
    if (walletId === toWalletId) {
      return res.status(400).json({ message: 'Source and destination wallets must be different' });
    }
  }

  const splitMode = requestSplitMode || 'even';

  try {
    const transactionDate = date || new Date().toISOString().split('T')[0];

    // For transfers, default excludeFromBudget to true unless explicitly set
    const shouldExclude = excludeFromBudget !== undefined ? excludeFromBudget : (type === 'transfer');

    const transaction = await Transaction.create({
      id: uuidv4(),
      amount,
      description,
      date: transactionDate,
      type,
      categoryId: categoryId || null,
      userCategoryId: userCategoryId || null,
      UserId: req.user.id,
      GroupId: GroupId || null,
      recurrentPaymentId: recurrentPaymentId || null,
      walletId: walletId || null,
      excludeFromBudget: shouldExclude,
    });

    // Handle transfer: create link + adjust wallet balances
    if (type === 'transfer' && toWalletId) {
      await TransactionLink.create({
        id: uuidv4(),
        transactionId: transaction.id,
        linkType: 'transfer',
        toWalletId,
      });

      // Adjust wallet balances
      const fromWallet = await Wallet.findByPk(walletId);
      const toWallet = await Wallet.findByPk(toWalletId);
      if (fromWallet) {
        fromWallet.balance = parseFloat(fromWallet.balance) - parseFloat(amount);
        await fromWallet.save();
      }
      if (toWallet) {
        toWallet.balance = parseFloat(toWallet.balance) + parseFloat(amount);
        await toWallet.save();
      }
    }

    // Handle debt payment: create link + reduce debt
    if (debtId && type === 'expense') {
      await TransactionLink.create({
        id: uuidv4(),
        transactionId: transaction.id,
        linkType: 'debt_payment',
        debtId,
      });

      const debt = await Debt.findByPk(debtId);
      if (debt) {
        debt.totalDebt = parseFloat(debt.totalDebt) - parseFloat(amount);
        await debt.save();
      }
    }

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
        // Validate amounts are not negative (0 is allowed for favors)
        for (const p of resolvedParticipants) {
          if (p.amount !== null && p.amount !== undefined && p.amount < 0) {
            return res.status(400).json({ message: 'Split amounts cannot be negative' });
          }
        }

        // Validate participant amounts don't exceed the total
        const participantSum = resolvedParticipants.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const ownerPortion = amount - participantSum;

        if (ownerPortion < 0) {
          return res.status(400).json({ message: 'Split amounts exceed the transaction total' });
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
      // Auto-save participants as contacts for future quick access
      for (const participant of resolvedParticipants) {
        const contactEmail = participant.email;
        if (contactEmail) {
          const existing = await FriendContact.findOne({
            where: { userId: req.user.id, contactEmail },
          });
          if (!existing) {
            await FriendContact.create({
              id: uuidv4(),
              userId: req.user.id,
              contactUserId: participant.userId || null,
              contactEmail,
              contactName: null,
            });
          }
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
  const { splits, splitMode: requestSplitMode, TransactionSplits, toWalletId, debtId, ...updateData } = req.body;
  const splitMode = requestSplitMode || 'even';

  try {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Transfer validation
    if (updateData.type === 'transfer') {
      const fromWallet = updateData.walletId || transaction.walletId;
      if (!fromWallet || !toWalletId) {
        return res.status(400).json({ message: 'Transfer requires both source and destination wallets' });
      }
      if (fromWallet === toWalletId) {
        return res.status(400).json({ message: 'Source and destination wallets must be different' });
      }
    }

    // Reverse existing link effects before updating
    const existingLink = await TransactionLink.findOne({ where: { transactionId } });
    if (existingLink) {
      const oldAmount = parseFloat(transaction.amount);
      if (existingLink.linkType === 'transfer') {
        // Reverse wallet adjustments
        const fromWallet = await Wallet.findByPk(transaction.walletId);
        const oldToWallet = await Wallet.findByPk(existingLink.toWalletId);
        if (fromWallet) { fromWallet.balance = parseFloat(fromWallet.balance) + oldAmount; await fromWallet.save(); }
        if (oldToWallet) { oldToWallet.balance = parseFloat(oldToWallet.balance) - oldAmount; await oldToWallet.save(); }
      } else if (existingLink.linkType === 'debt_payment') {
        // Reverse debt reduction
        const debt = await Debt.findByPk(existingLink.debtId);
        if (debt) { debt.totalDebt = parseFloat(debt.totalDebt) + oldAmount; await debt.save(); }
      }
      await existingLink.destroy();
    }

    // Update transaction fields
    const fkFields = ['categoryId', 'userCategoryId', 'walletId'];
    const safeFields = ['amount', 'description', 'date', 'type', 'categoryId', 'userCategoryId', 'walletId', 'frequency', 'excludeFromBudget'];
    for (const field of safeFields) {
      if (updateData[field] !== undefined) {
        transaction[field] = fkFields.includes(field) ? (updateData[field] || null) : updateData[field];
      }
    }
    await transaction.save();

    // Apply new link effects
    const newType = transaction.type;
    const newAmount = parseFloat(transaction.amount);

    if (newType === 'transfer' && toWalletId) {
      await TransactionLink.create({
        id: uuidv4(),
        transactionId,
        linkType: 'transfer',
        toWalletId,
      });
      const fromWallet = await Wallet.findByPk(transaction.walletId);
      const toWallet = await Wallet.findByPk(toWalletId);
      if (fromWallet) { fromWallet.balance = parseFloat(fromWallet.balance) - newAmount; await fromWallet.save(); }
      if (toWallet) { toWallet.balance = parseFloat(toWallet.balance) + newAmount; await toWallet.save(); }
    } else if (debtId && newType === 'expense') {
      await TransactionLink.create({
        id: uuidv4(),
        transactionId,
        linkType: 'debt_payment',
        debtId,
      });
      const debt = await Debt.findByPk(debtId);
      if (debt) { debt.totalDebt = parseFloat(debt.totalDebt) - newAmount; await debt.save(); }
    }

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
            if (p.amount !== null && p.amount !== undefined && p.amount < 0) {
              return res.status(400).json({ message: 'Split amounts cannot be negative' });
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

        // Auto-save participants as contacts
        for (const participant of resolvedParticipants) {
          if (participant.email) {
            const existing = await FriendContact.findOne({
              where: { userId: req.user.id, contactEmail: participant.email },
            });
            if (!existing) {
              await FriendContact.create({
                id: uuidv4(),
                userId: req.user.id,
                contactUserId: participant.userId || null,
                contactEmail: participant.email,
                contactName: null,
              });
            }
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

    // Reverse link effects before deleting
    const link = await TransactionLink.findOne({ where: { transactionId } });
    if (link) {
      const amount = parseFloat(transaction.amount);
      if (link.linkType === 'transfer') {
        const fromWallet = await Wallet.findByPk(transaction.walletId);
        const toWallet = await Wallet.findByPk(link.toWalletId);
        if (fromWallet) { fromWallet.balance = parseFloat(fromWallet.balance) + amount; await fromWallet.save(); }
        if (toWallet) { toWallet.balance = parseFloat(toWallet.balance) - amount; await toWallet.save(); }
      } else if (link.linkType === 'debt_payment') {
        const debt = await Debt.findByPk(link.debtId);
        if (debt) { debt.totalDebt = parseFloat(debt.totalDebt) + amount; await debt.save(); }
      }
    }

    await transaction.destroy();
    return res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return res.status(500).json({ message: 'Server error while deleting transaction' });
  }
}


// Approve a duplicate (mark as not duplicate — keep the transaction)
const approveDuplicate = async (req, res) => {
  try {
    const { Transaction } = require('../models');
    const tx = await Transaction.findOne({
      where: { id: req.params.id, UserId: req.user.id }
    });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    tx.isDuplicate = false;
    await tx.save();
    return res.json({ message: 'Transaction confirmed' });
  } catch (error) {
    console.error('Approve duplicate error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Dismiss a duplicate (delete the transaction)
const dismissDuplicate = async (req, res) => {
  try {
    const { Transaction } = require('../models');
    const tx = await Transaction.findOne({
      where: { id: req.params.id, UserId: req.user.id, isDuplicate: true }
    });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    await tx.destroy();
    return res.json({ message: 'Duplicate removed' });
  } catch (error) {
    console.error('Dismiss duplicate error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  approveDuplicate,
  dismissDuplicate,
};
