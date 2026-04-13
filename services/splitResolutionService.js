const { sequelize, SplitInvitation, TransactionSplit } = require("../models");

/**
 * Resolves all pending split invitations for a given email address.
 * Called during user registration and login to convert pending invitations
 * into actual TransactionSplit records linked to the authenticated user.
 *
 * @param {string} email - The email address to resolve invitations for
 * @param {string} userId - The authenticated user's ID to link splits to
 * @returns {Promise<number>} The number of invitations resolved
 */
async function resolveInvitations(email, userId) {
  const transaction = await sequelize.transaction();

  try {
    // Find all pending invitations for this email
    const pendingInvitations = await SplitInvitation.findAll({
      where: {
        email,
        status: "pending",
      },
      transaction,
    });

    if (pendingInvitations.length === 0) {
      await transaction.commit();
      return 0;
    }

    // For each pending invitation, create a TransactionSplit and resolve the invitation
    for (const invitation of pendingInvitations) {
      await TransactionSplit.create(
        {
          transactionId: invitation.transactionId,
          userId,
          amount: invitation.amount,
          splitMode: invitation.splitMode,
          invitationId: invitation.id,
        },
        { transaction }
      );

      await invitation.update(
        {
          status: "resolved",
          resolvedUserId: userId,
          resolvedAt: new Date(),
        },
        { transaction }
      );
    }

    await transaction.commit();
    return pendingInvitations.length;
  } catch (error) {
    await transaction.rollback();
    console.error("Error resolving split invitations:", error);
    throw error;
  }
}

module.exports = { resolveInvitations };
