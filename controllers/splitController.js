const { FriendContact, User, TransactionSplit, Transaction, SplitInvitation, RecurrentPayment, RecurrentSplitConfig, sequelize } = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

/**
 * List FriendContact records for the authenticated user.
 * Includes contactUser data when contactUserId is set.
 */
async function getContacts(req, res) {
  try {
    const contacts = await FriendContact.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: User,
          as: "contact",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({ message: "Server error while fetching contacts" });
  }
}

/**
 * Add a new FriendContact.
 * Accepts { email, name? }, checks for duplicate, resolves contactUserId
 * if the email belongs to a registered user.
 */
async function addContact(req, res) {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Check for duplicate (userId + contactEmail)
    const existing = await FriendContact.findOne({
      where: { userId: req.user.id, contactEmail: email },
    });
    if (existing) {
      return res.status(409).json({ message: "Contact already exists" });
    }

    // Resolve contactUserId if email belongs to a registered user
    let contactUserId = null;
    const registeredUser = await User.findOne({ where: { email } });
    if (registeredUser) {
      contactUserId = registeredUser.id;
    }

    const contact = await FriendContact.create({
      id: uuidv4(),
      userId: req.user.id,
      contactUserId,
      contactEmail: email,
      contactName: name || (registeredUser ? registeredUser.name : null),
    });

    return res.status(201).json({ contact });
  } catch (error) {
    // Handle unique constraint violation as a fallback
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Contact already exists" });
    }
    console.error("Error adding contact:", error);
    return res.status(500).json({ message: "Server error while adding contact" });
  }
}

/**
 * Remove a FriendContact by id.
 * Verifies ownership before deleting.
 */
async function removeContact(req, res) {
  const { contactId } = req.params;

  try {
    const contact = await FriendContact.findByPk(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    // Verify ownership
    if (contact.userId !== req.user.id) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await contact.destroy();
    return res.json({ message: "Contact removed successfully" });
  } catch (error) {
    console.error("Error removing contact:", error);
    return res.status(500).json({ message: "Server error while removing contact" });
  }
}

/**
 * Update a FriendContact's name or email.
 * Verifies ownership before updating.
 */
async function updateContact(req, res) {
  const { contactId } = req.params;
  const { email, name } = req.body;

  try {
    const contact = await FriendContact.findByPk(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    if (contact.userId !== req.user.id) {
      return res.status(404).json({ message: "Contact not found" });
    }

    if (email && email !== contact.contactEmail) {
      // Check for duplicate
      const existing = await FriendContact.findOne({
        where: { userId: req.user.id, contactEmail: email },
      });
      if (existing && existing.id !== contactId) {
        return res.status(409).json({ message: "Contact with this email already exists" });
      }
      contact.contactEmail = email;
      // Re-resolve contactUserId
      const registeredUser = await User.findOne({ where: { email } });
      contact.contactUserId = registeredUser ? registeredUser.id : null;
    }

    if (name !== undefined) {
      contact.contactName = name || null;
    }

    await contact.save();
    return res.json({ contact });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Contact with this email already exists" });
    }
    console.error("Error updating contact:", error);
    return res.status(500).json({ message: "Server error while updating contact" });
  }
}

/**
 * Search contacts and registered users for participant selection.
 * Accepts query param `q`.
 * Returns contacts first, then non-contact registered users (deduplicated).
 */
async function searchContacts(req, res) {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.json({ contacts: [], users: [] });
  }

  const searchTerm = `%${q.trim().toLowerCase()}%`;

  try {
    // 1. Search FriendContact entries for the current user (case-insensitive)
    const contacts = await FriendContact.findAll({
      where: {
        userId: req.user.id,
        [Op.or]: [
          sequelize.where(fn('LOWER', col('FriendContact.contactEmail')), { [Op.like]: searchTerm }),
          sequelize.where(fn('LOWER', col('FriendContact.contactName')), { [Op.like]: searchTerm }),
        ],
      },
      include: [
        {
          model: User,
          as: "contact",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    // Collect emails already in contacts to deduplicate
    const contactEmails = new Set(contacts.map((c) => c.contactEmail.toLowerCase()));

    // 2. Search User table by name or email, excluding the current user (case-insensitive)
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        [Op.or]: [
          sequelize.where(fn('LOWER', col('User.name')), { [Op.like]: searchTerm }),
          sequelize.where(fn('LOWER', col('User.email')), { [Op.like]: searchTerm }),
        ],
      },
      attributes: ["id", "name", "email"],
    });

    // Deduplicate: exclude users already in contacts
    const filteredUsers = users.filter(
      (u) => !contactEmails.has(u.email.toLowerCase())
    );

    return res.json({ contacts, users: filteredUsers });
  } catch (error) {
    console.error("Error searching contacts:", error);
    return res.status(500).json({ message: "Server error while searching contacts" });
  }
}

/**
 * Get aggregated debts summary for the current user.
 * Returns amounts owed TO the user and amounts owed BY the user,
 * grouped by counterparty.
 */
async function getDebtsSummary(req, res) {
  try {
    const currentUserId = req.user.id;

    // 1. Amounts owed TO current user (current user owns the transaction, others owe)
    const owedToMe = await sequelize.query(`
      SELECT ts.userId, u.id, u.name, u.email, SUM(ts.amount) AS totalAmount
      FROM transaction_splits ts
      INNER JOIN transactions t ON ts.transactionId = t.id
      INNER JOIN users u ON ts.userId = u.id
      WHERE t.UserId = :currentUserId
        AND ts.isPaid = false
        AND ts.userId IS NOT NULL
        AND ts.userId != :currentUserId
      GROUP BY ts.userId, u.id, u.name, u.email
    `, { replacements: { currentUserId }, type: sequelize.QueryTypes.SELECT });

    // 2. Amounts owed BY current user (current user is the debtor)
    const owedByMe = await sequelize.query(`
      SELECT t.UserId AS creditorUserId, u.id, u.name, u.email, SUM(ts.amount) AS totalAmount
      FROM transaction_splits ts
      INNER JOIN transactions t ON ts.transactionId = t.id
      INNER JOIN users u ON t.UserId = u.id
      WHERE ts.userId = :currentUserId
        AND ts.isPaid = false
        AND t.UserId != :currentUserId
      GROUP BY t.UserId, u.id, u.name, u.email
    `, { replacements: { currentUserId }, type: sequelize.QueryTypes.SELECT });

    const owedToMeFormatted = (owedToMe || []).map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      totalAmount: parseFloat(row.totalAmount),
    }));

    const owedByMeFormatted = (owedByMe || []).map((row) => ({
      userId: row.creditorUserId,
      name: row.name,
      email: row.email,
      totalAmount: parseFloat(row.totalAmount),
    }));

    return res.json({ owedToMe: owedToMeFormatted, owedByMe: owedByMeFormatted });
  } catch (error) {
    console.error("Error fetching debts summary:", error);
    return res.status(500).json({ message: "Server error while fetching debts summary" });
  }
}

/**
 * Get individual unpaid TransactionSplit records between the current user
 * and a specified user (both directions).
 */
async function getDebtsWithUser(req, res) {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    // Direction 1: Current user owns transaction, other user is debtor
    const owedToMe = await TransactionSplit.findAll({
      include: [
        {
          model: Transaction,
          attributes: ["id", "description", "amount", "date"],
          where: { UserId: currentUserId },
        },
      ],
      where: {
        userId: userId,
        isPaid: false,
      },
    });

    // Direction 2: Other user owns transaction, current user is debtor
    const owedByMe = await TransactionSplit.findAll({
      include: [
        {
          model: Transaction,
          attributes: ["id", "description", "amount", "date"],
          where: { UserId: userId },
        },
      ],
      where: {
        userId: currentUserId,
        isPaid: false,
      },
    });

    return res.json({ owedToMe, owedByMe });
  } catch (error) {
    console.error("Error fetching debts with user:", error);
    return res.status(500).json({ message: "Server error while fetching debts with user" });
  }
}

/**
 * Settle a split — mark as paid.
 * Authorization: only the split's debtor (userId) or the transaction owner (creditor) can settle.
 * Accepts optional proofOfPayment in body.
 * After settling, checks if all splits for the transaction are now paid.
 */
async function settleSplit(req, res) {
  const { splitId } = req.params;
  const { proofOfPayment } = req.body;

  try {
    const split = await TransactionSplit.findByPk(splitId, {
      include: [{ model: Transaction, attributes: ["id", "UserId"] }],
    });

    if (!split) {
      return res.status(404).json({ message: "Split not found" });
    }

    // Authorization: only debtor or creditor can settle
    const isDebtor = req.user.id === split.userId;
    const isCreditor = req.user.id === split.Transaction.UserId;

    if (!isDebtor && !isCreditor) {
      return res.status(403).json({ message: "Not authorized to settle this split" });
    }

    split.isPaid = true;
    split.paidAt = new Date();
    if (proofOfPayment) {
      split.proofOfPayment = proofOfPayment;
    }

    await split.save();

    // Check if all splits for this transaction are now settled
    const unsettledCount = await TransactionSplit.count({
      where: {
        transactionId: split.transactionId,
        isPaid: false,
      },
    });

    const allSettled = unsettledCount === 0;

    return res.json({
      message: "Split settled successfully",
      split,
      allSettled,
    });
  } catch (error) {
    console.error("Error settling split:", error);
    return res.status(500).json({ message: "Server error settling split" });
  }
}


/**
 * Cancel a pending split invitation.
 * Verifies the invitation belongs to the current user (invitedBy).
 * Sets status to 'cancelled'. If the split was even mode, recalculates
 * remaining participants' amounts. Destroys the linked TransactionSplit if any.
 *
 * Requirements: 2.5
 */
async function cancelInvitation(req, res) {
  const { invitationId } = req.params;

  try {
    const invitation = await SplitInvitation.findByPk(invitationId, {
      include: [{ model: Transaction }],
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.invitedBy !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this invitation" });
    }

    // Set status to cancelled
    invitation.status = "cancelled";
    await invitation.save();

    // Destroy the linked TransactionSplit record if any
    await TransactionSplit.destroy({
      where: { invitationId: invitation.id },
    });

    // If even mode, recalculate remaining participants' amounts
    if (invitation.splitMode === "even") {
      const transactionId = invitation.transactionId;
      const transaction = invitation.Transaction;

      // Find all remaining active (non-cancelled) SplitInvitation records
      const remainingInvitations = await SplitInvitation.findAll({
        where: {
          transactionId,
          status: { [Op.ne]: "cancelled" },
        },
      });

      // Find all remaining TransactionSplit records for this transaction
      const remainingSplits = await TransactionSplit.findAll({
        where: { transactionId },
      });

      // Total remaining participants = remaining splits + remaining invitations + owner
      const totalParticipants = remainingSplits.length + remainingInvitations.length + 1;

      if (totalParticipants > 1) {
        // Recalculate even split amount
        const totalAmount = parseFloat(transaction.amount);
        const baseAmount = Math.floor((totalAmount / totalParticipants) * 100) / 100;
        const totalDistributed = baseAmount * (totalParticipants - 1);
        const remainder = Math.round((totalAmount - totalDistributed - baseAmount) * 100) / 100;

        // Update remaining TransactionSplit amounts
        for (let i = 0; i < remainingSplits.length; i++) {
          if (i === remainingSplits.length - 1 && remainingInvitations.length === 0) {
            // Last participant absorbs rounding remainder
            remainingSplits[i].amount = parseFloat((baseAmount + remainder).toFixed(2));
          } else {
            remainingSplits[i].amount = baseAmount;
          }
          await remainingSplits[i].save();
        }

        // Update remaining SplitInvitation amounts
        for (let i = 0; i < remainingInvitations.length; i++) {
          if (i === remainingInvitations.length - 1) {
            // Last invitation absorbs rounding remainder
            remainingInvitations[i].amount = parseFloat((baseAmount + remainder).toFixed(2));
          } else {
            remainingInvitations[i].amount = baseAmount;
          }
          await remainingInvitations[i].save();
        }
      }
    }

    return res.json({ message: "Invitation cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return res.status(500).json({ message: "Server error while cancelling invitation" });
  }
}

/**
 * Update or create the RecurrentSplitConfig for a recurrent payment.
 * Only affects future occurrences — past transactions are untouched.
 */
async function updateRecurrentSplitConfig(req, res) {
  const { recurrentPaymentId } = req.params;
  const { splitMode, participants } = req.body;

  try {
    // Verify the recurrent payment exists and belongs to the current user
    const recurrentPayment = await RecurrentPayment.findByPk(recurrentPaymentId);
    if (!recurrentPayment) {
      return res.status(404).json({ message: "Recurrent payment not found" });
    }
    if (recurrentPayment.userId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to modify this recurrent payment's split config" });
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "At least one participant is required" });
    }

    const configData = {
      splitMode: splitMode || 'even',
      participants: participants.map(p => ({
        userId: p.userId || null,
        email: p.email || null,
        amount: p.amount || null,
      })),
    };

    // Update existing config or create a new one
    const existingConfig = await RecurrentSplitConfig.findOne({
      where: { recurrentPaymentId },
    });

    if (existingConfig) {
      existingConfig.splitMode = configData.splitMode;
      existingConfig.participants = configData.participants;
      await existingConfig.save();
      return res.json({ message: "Recurrent split config updated successfully", config: existingConfig });
    } else {
      const newConfig = await RecurrentSplitConfig.create({
        id: uuidv4(),
        recurrentPaymentId,
        ...configData,
      });
      return res.status(201).json({ message: "Recurrent split config created successfully", config: newConfig });
    }
  } catch (error) {
    console.error("Error updating recurrent split config:", error);
    return res.status(500).json({ message: "Server error while updating recurrent split config" });
  }
}

module.exports = {
  getContacts,
  addContact,
  updateContact,
  removeContact,
  searchContacts,
  getDebtsSummary,
  getDebtsWithUser,
  settleSplit,
  cancelInvitation,
  updateRecurrentSplitConfig,
};
