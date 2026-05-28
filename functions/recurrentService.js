const { Transaction, RecurrentPayment, RecurrentSplitConfig, TransactionSplit, SplitInvitation, User } = require("../models");
const { v4: uuidv4 } = require("uuid");

function calculateNextDate(currentDateStr, frequency) {
    const date = new Date(currentDateStr + "T00:00:00");
    switch (frequency) {
        case "daily":
            date.setDate(date.getDate() + 1);
            break;
        case "weekly":
            date.setDate(date.getDate() + 7);
            break;
        case "weekdays":
            // Mon-Thu -> +1, Fri -> +3, Sat -> +2, Sun -> +1
            const day = date.getDay();
            if (day >= 1 && day <= 4) date.setDate(date.getDate() + 1);
            else if (day === 5) date.setDate(date.getDate() + 3);
            else if (day === 6) date.setDate(date.getDate() + 2);
            else if (day === 0) date.setDate(date.getDate() + 1);
            break;
        case "biweekly":
            date.setDate(date.getDate() + 14);
            break;
        case "monthly":
            date.setMonth(date.getMonth() + 1);
            break;
        case "bimonthly":
            date.setMonth(date.getMonth() + 2);
            break;
        case "semiannually":
            date.setMonth(date.getMonth() + 6);
            break;
        case "yearly":
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            break;
    }
    return date.toISOString().split("T")[0];
}

async function syncUserRecurrentPayments(userId) {
    const today = new Date().toISOString().split("T")[0];
    try {
        const recurrentPayments = await RecurrentPayment.findAll({
            where: {
                userId: userId,
            },
        });

        for (const rp of recurrentPayments) {
            let nextDate = rp.nextPaymentDate;
            let updated = false;

            // Fetch split config once per recurrent payment (cache outside the while loop)
            const splitConfig = await RecurrentSplitConfig.findOne({
                where: { recurrentPaymentId: rp.id },
            });

            while (nextDate <= today) {
                // Create the transaction
                const transactionId = uuidv4();
                await Transaction.create({
                    id: transactionId,
                    amount: rp.amount,
                    description: rp.description || "Recurrent Payment",
                    date: nextDate,
                    type: rp.type,
                    categoryId: rp.categoryId || null,
                    userCategoryId: rp.userCategoryId || null,
                    UserId: rp.userId,
                    GroupId: rp.groupId,
                    walletId: rp.walletId,
                    recurrentPaymentId: rp.id,
                });

                // Generate splits if a RecurrentSplitConfig exists
                if (splitConfig) {
                    const participants = splitConfig.participants || [];
                    const splitMode = splitConfig.splitMode || "even";

                    // Calculate amounts per participant
                    let resolvedParticipants = [];

                    if (splitMode === "even") {
                        const N = participants.length + 1; // participants + owner
                        const perPerson = Math.floor((rp.amount * 100) / N) / 100;

                        for (let i = 0; i < participants.length; i++) {
                            const amount =
                                i === participants.length - 1
                                    ? Math.round((rp.amount - perPerson * (N - 1)) * 100) / 100
                                    : perPerson;

                            resolvedParticipants.push({
                                userId: participants[i].userId || null,
                                email: participants[i].email || null,
                                amount,
                            });
                        }
                    } else {
                        // Custom mode: use stored amounts directly
                        for (const p of participants) {
                            resolvedParticipants.push({
                                userId: p.userId || null,
                                email: p.email || null,
                                amount: p.amount,
                            });
                        }
                    }

                    // Create TransactionSplit or SplitInvitation for each participant
                    for (const participant of resolvedParticipants) {
                        let participantUserId = participant.userId;

                        // If email provided but no userId, try to resolve
                        if (!participantUserId && participant.email) {
                            const existingUser = await User.findOne({
                                where: { email: participant.email },
                            });
                            if (existingUser) {
                                participantUserId = existingUser.id;
                            }
                        }

                        if (participantUserId) {
                            // Registered user — create TransactionSplit directly
                            await TransactionSplit.create({
                                id: uuidv4(),
                                transactionId,
                                userId: participantUserId,
                                amount: participant.amount,
                                isPaid: false,
                                splitMode,
                            });
                        } else if (participant.email) {
                            // Unregistered user — create SplitInvitation + linked TransactionSplit
                            const invitation = await SplitInvitation.create({
                                id: uuidv4(),
                                transactionId,
                                email: participant.email,
                                amount: participant.amount,
                                splitMode,
                                status: "pending",
                                invitedBy: rp.userId,
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

                // Calculate next occurrence
                nextDate = calculateNextDate(nextDate, rp.frequency);
                updated = true;

                // Check if we passed the end date
                if (rp.endDate && nextDate > rp.endDate) {
                    break;
                }
            }

            if (updated) {
                rp.nextPaymentDate = nextDate;
                await rp.save();
            }
        }
    } catch (error) {
        console.error("Error syncing recurrent payments for user:", userId, error);
    }
}

module.exports = {
    calculateNextDate,
    syncUserRecurrentPayments,
};
