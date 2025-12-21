const { Wallet } = require("../models");
const { v4: uuidv4 } = require("uuid");

async function getWallets(req, res) {
  const userId = req.user.id;
  try {
    const wallets = await Wallet.findAll({
      where: { userId },
      include: [
        {
          model: require("../models").Transaction,
          limit: 3,
          order: [["date", "DESC"], ["createdAt", "DESC"]],
          include: [{ model: require("../models").Category, attributes: ["name", "icon"] }]
        }
      ]
    });

    // Calculate aggregated stats for each wallet
    const walletsWithStats = await Promise.all(wallets.map(async (wallet) => {
      const transactions = await require("../models").Transaction.findAll({
        where: { walletId: wallet.id }
      });

      let incomes = 0;
      let expenses = 0;

      transactions.forEach(t => {
        const amount = parseFloat(t.amount || 0);
        if (t.type === 'income') incomes += amount;
        else expenses += amount;
      });

      const walletData = wallet.toJSON();
      walletData.stats = {
        incomes,
        expenses,
        netBalance: incomes - expenses
      };

      return walletData;
    }));

    return res.json({ wallets: walletsWithStats });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    return res.status(500).json({ message: "Server error fetching wallets" });
  }
}

async function createWallet(req, res) {
  const userId = req.user.id;
  const { name, icon, balance, color, goalAmount, isDefault } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  try {
    // If setting as default, unset others first
    if (isDefault) {
      await Wallet.update({ isDefault: false }, { where: { userId } });
    }

    const wallet = await Wallet.create({
      id: uuidv4(),
      userId,
      name,
      icon,
      balance: balance || 0,
      color,
      goalAmount,
      isDefault: isDefault || false
    });
    return res.status(201).json({ wallet });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return res.status(500).json({ message: "Server error creating wallet" });
  }
}

async function updateWallet(req, res) {
  const userId = req.user.id;
  const { walletId } = req.params;
  const { name, icon, balance, color, goalAmount, isDefault } = req.body;
  try {
    const wallet = await Wallet.findOne({ where: { id: walletId, userId } });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // If setting as default, unset others first
    if (isDefault && !wallet.isDefault) {
      await Wallet.update({ isDefault: false }, { where: { userId } });
    }

    Object.assign(wallet, { name, icon, balance, color, goalAmount, isDefault });
    await wallet.save();
    return res.json({ wallet });
  } catch (error) {
    console.error("Error updating wallet:", error);
    return res.status(500).json({ message: "Server error updating wallet" });
  }
}

async function deleteWallet(req, res) {
  const userId = req.user.id;
  const { walletId } = req.params;
  try {
    const wallet = await Wallet.findOne({ where: { id: walletId, userId } });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    await wallet.destroy();
    return res.json({ message: "Wallet deleted successfully" });
  } catch (error) {
    console.error("Error deleting wallet:", error);
    return res.status(500).json({ message: "Server error deleting wallet" });
  }
}

module.exports = {
  getWallets,
  createWallet,
  updateWallet,
  deleteWallet,
};
