const { Wallet } = require("../models");
const { v4: uuidv4 } = require("uuid");

async function getWallets(req, res) {
  const userId = req.user.id;
  try {
    const wallets = await Wallet.findAll({ where: { userId } });
    return res.json({ wallets });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    return res.status(500).json({ message: "Server error fetching wallets" });
  }
}

async function createWallet(req, res) {
  const userId = req.user.id;
  const { name, icon } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  try {
    const wallet = await Wallet.create({
      id: uuidv4(),
      userId,
      name,
      icon,
      balance: 0
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
  const updateData = req.body;
  try {
    const wallet = await Wallet.findOne({ where: { id: walletId, userId } });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    Object.assign(wallet, updateData);
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
