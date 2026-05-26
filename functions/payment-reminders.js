const { schedule } = require("@netlify/functions");
const { Op } = require("sequelize");
const { RecurrentPayment, Category, BudgetCategoryPlan, Budget, Transaction, User } = require("../models");
const pushService = require("../services/pushService");

const handler = async () => {
  try {
    await sendPaymentReminders();
    await sendBudgetWarnings();
  } catch (error) {
    console.error("[Notifications] Fatal error:", error.message);
  }
};

async function sendPaymentReminders() {
  const now = new Date();
  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  const dueSoon = await RecurrentPayment.findAll({
    where: { nextPaymentDate: { [Op.between]: [now, twoDaysFromNow] } },
    include: [{ model: Category, attributes: ['name'] }],
  });

  console.log(`[Notifications] ${dueSoon.length} payments due soon`);

  for (const payment of dueSoon) {
    const daysUntil = Math.ceil((new Date(payment.nextPaymentDate) - now) / (1000 * 60 * 60 * 24));
    const desc = payment.Category?.name || 'Payment';
    await pushService.sendToUser(payment.userId, {
      type: 'payment_reminder',
      title: 'Payment Due Soon',
      body: `${desc} ($${parseFloat(payment.amount).toLocaleString()}) due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      url: '/',
    });
  }
}

async function sendBudgetWarnings() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get all active budget plans
  const plans = await BudgetCategoryPlan.findAll({
    include: [
      { model: Budget, attributes: ['userId'] },
      { model: Category, attributes: ['name'] },
    ],
  });

  for (const plan of plans) {
    if (!plan.Budget?.userId || !plan.plannedAmount) continue;

    // Sum transactions for this category this month
    const spent = await Transaction.sum('amount', {
      where: {
        UserId: plan.Budget.userId,
        categoryId: plan.categoryId,
        type: 'expense',
        date: { [Op.between]: [monthStart, monthEnd] },
      },
    }) || 0;

    const pct = Math.round((spent / plan.plannedAmount) * 100);
    if (pct >= 80 && pct < 100) {
      await pushService.sendToUser(plan.Budget.userId, {
        type: 'budget_warning',
        title: 'Budget Alert',
        body: `You've spent ${pct}% of your ${plan.Category?.name || 'budget'} limit`,
        url: '/budget',
      });
    }
  }
}

// Runs daily at 8am UTC
exports.handler = schedule("0 8 * * *", handler);
