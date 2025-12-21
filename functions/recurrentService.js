const { Transaction, RecurrentPayment } = require("../models");
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

            while (nextDate <= today) {
                // Create the transaction
                await Transaction.create({
                    id: uuidv4(),
                    amount: rp.amount,
                    description: rp.description || "Recurrent Payment",
                    date: nextDate,
                    type: rp.type,
                    categoryId: rp.categoryId,
                    UserId: rp.userId,
                    GroupId: rp.groupId,
                    walletId: rp.walletId,
                    recurrentPaymentId: rp.id,
                });

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
