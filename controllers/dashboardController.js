const { Transaction, Wallet, Category, RecurrentPayment, TransactionSplit, User, SplitInvitation, UserCategory } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Get overall financial overview
 */
async function getDashboardOverview(req, res) {
    const userId = req.user.id;
    const { month } = req.query;
    const now = month ? new Date(month + '-01') : new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    try {
        // 1. Total Balance from all wallets
        const wallets = await Wallet.findAll({ where: { userId } });
        const totalBalance = wallets.reduce((acc, w) => acc + parseFloat(w.balance || 0), 0);

        // 2. Monthly Stats (Incomes vs Expenses)
        const monthlyTransactions = await Transaction.findAll({
            where: {
                UserId: userId,
                date: { [Op.between]: [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]] }
            },
            include: [{ model: Category, attributes: ['type'] }]
        });

        let monthlyIncome = 0;
        let monthlyExpense = 0;

        monthlyTransactions.forEach(t => {
            const amount = parseFloat(t.amount || 0);
            if (t.type === 'income') monthlyIncome += amount;
            else monthlyExpense += amount;
        });

        // Count uncategorized transactions this month
        const uncategorizedCount = monthlyTransactions.filter(t => !t.userCategoryId).length;

        return res.json({
            totalBalance,
            monthlyIncome,
            monthlyExpense,
            netSavings: monthlyIncome - monthlyExpense,
            uncategorizedCount,
            currency: "USD"
        });
    } catch (error) {
        console.error("Dashboard Overview Error:", error);
        return res.status(500).json({ message: "Error fetching dashboard overview" });
    }
}

/**
 * Get expenditures data for charts
 */
async function getExpendituresData(req, res) {
    const userId = req.user.id;
    const { month } = req.query; // YYYY-MM

    let targetDate = month ? new Date(month + "-01") : new Date();
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    try {
        const transactions = await Transaction.findAll({
            where: {
                UserId: userId,
                date: { [Op.between]: [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]] }
            },
            include: [{ model: Category, attributes: ['type'] }]
        });

        let income = 0;
        let expense = 0;

        transactions.forEach(t => {
            const amount = parseFloat(t.amount || 0);
            if (t.type === 'income') income += amount;
            else expense += amount;
        });

        // We can also return daily data if we want a more detailed chart later, 
        // but for now the bar graph is Income vs Expense vs Left
        return res.json({
            month: startOfMonth.toISOString().slice(0, 7),
            income,
            expense,
            left: income - expense
        });
    } catch (error) {
        console.error("Expenditures Data Error:", error);
        return res.status(500).json({ message: "Error fetching expenditures data" });
    }
}

/**
 * Get grouped transactions (Upcoming and Recent)
 */
async function getTransactionsList(req, res) {
    const userId = req.user.id;
    const { month } = req.query;
    const today = new Date().toISOString().split('T')[0];

    // Calculate month boundaries (parse without timezone issues)
    let startOfMonth, endOfMonth;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startOfMonth = `${y}-${String(m).padStart(2,'0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endOfMonth = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    } else {
      const now = new Date();
      startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    try {
        // 1. Upcoming Transactions (Future dated within month + Recurrent next payment)
        const futureTransactions = await Transaction.findAll({
            where: {
                UserId: userId,
                date: { [Op.gt]: today, [Op.lte]: endOfMonth }
            },
            include: [
                { model: Category, attributes: ['name', 'icon', 'type'] },
                { model: Wallet, attributes: ['name', 'icon'] }
            ],
            order: [['date', 'ASC']]
        });

        const recurrentPending = await RecurrentPayment.findAll({
            where: {
                userId,
                nextPaymentDate: { [Op.gte]: today }
            },
            include: [
                { model: Category, attributes: ['name', 'icon', 'type'] },
                { model: Wallet, attributes: ['name', 'icon'] }
            ],
            order: [['nextPaymentDate', 'ASC']]
        });

        // Map recurrent to a standard format for frontend
        const upcoming = [
            ...futureTransactions.map(t => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                type: t.type,
                categoryId: t.categoryId,
                walletId: t.walletId,
                categoryName: t.userCategory?.customName || t.userCategory?.Category?.name || t.Category?.name || null,
                categoryIcon: t.userCategory?.customIcon || t.userCategory?.Category?.icon || t.Category?.icon || null,
                categoryColor: t.userCategory?.color1 || null,
                userCategoryId: t.userCategoryId || null,
                walletName: t.Wallet?.name,
                walletIcon: t.Wallet?.icon,
                status: 'future'
            })),
            ...recurrentPending.map(rp => ({
                id: rp.id,
                date: rp.nextPaymentDate,
                description: rp.description,
                amount: rp.amount,
                type: rp.type,
                categoryId: rp.categoryId,
                walletId: rp.walletId,
                categoryName: rp.Category?.name,
                categoryIcon: rp.Category?.icon,
                walletName: rp.Wallet?.name,
                walletIcon: rp.Wallet?.icon,
                status: 'recurrent',
                isRecurrent: true
            }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Recent Transactions (within selected month, up to today)
        const recentRaw = await Transaction.findAll({
            where: {
                UserId: userId,
                date: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth }
            },
            include: [
                { model: Category, attributes: ['name', 'icon', 'type'] },
                { model: UserCategory, as: 'userCategory', attributes: ['id', 'customName', 'customIcon', 'color1', 'color2', 'categoryId'], required: false, include: [{ model: Category, attributes: ['name', 'icon'], required: false }] },
                { model: Wallet, attributes: ['name', 'icon'] },
                { model: TransactionSplit, include: [
                    { model: User, as: 'debtor', attributes: ['id', 'name', 'email'], required: false },
                    { model: SplitInvitation, attributes: ['id', 'email', 'status'], required: false }
                ] }
            ],
            order: [['date', 'DESC'], ['createdAt', 'DESC']],
            limit: 50
        });

        const recentGrouped = [];
        recentRaw.forEach(t => {
            const date = t.date;
            let group = recentGrouped.find(g => g.date === date);
            if (!group) {
                group = { date, items: [], dayTotal: 0 };
                recentGrouped.push(group);
            }
            group.items.push({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                type: t.type,
                source: t.source,
                isDuplicate: t.isDuplicate,
                categoryId: t.categoryId,
                walletId: t.walletId,
                categoryName: t.userCategory?.customName || t.userCategory?.Category?.name || t.Category?.name || null,
                categoryIcon: t.userCategory?.customIcon || t.userCategory?.Category?.icon || t.Category?.icon || null,
                categoryColor: t.userCategory?.color1 || null,
                userCategoryId: t.userCategoryId || null,
                walletName: t.Wallet?.name,
                walletIcon: t.Wallet?.icon,
                TransactionSplits: (t.TransactionSplits || []).map(s => ({
                    id: s.id,
                    userId: s.userId,
                    amount: s.amount,
                    splitMode: s.splitMode,
                    isPaid: s.isPaid,
                    email: s.SplitInvitation?.email || (s.debtor?.email) || null,
                    debtor: s.debtor ? { id: s.debtor.id, name: s.debtor.name, email: s.debtor.email } : null,
                })),
            });

            const amt = parseFloat(t.amount || 0);
            if (t.type === 'expense') group.dayTotal -= amt;
            else group.dayTotal += amt;
        });

        return res.json({
            upcoming,
            recent: recentGrouped
        });
    } catch (error) {
        console.error("Transactions List Error:", error);
        return res.status(500).json({ message: "Error fetching transactions list" });
    }
}

module.exports = {
    getDashboardOverview,
    getExpendituresData,
    getTransactionsList
};
