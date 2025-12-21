const { Debt } = require("../models");
const { v4: uuidv4 } = require("uuid");

async function getDebts(req, res) {
  const userId = req.user.id;
  try {
    const debts = await Debt.findAll({ where: { userId } });
    return res.json({ debts });
  } catch (error) {
    console.error("Error fetching debts:", error);
    return res.status(500).json({ message: "Server error fetching debts" });
  }
}

async function createDebt(req, res) {
  const userId = req.user.id;
  const {
    bankName,
    totalDebt,
    monthlyPayment,
    monthlyRate,
    annualRate,
    creditNumber,
    linkedWalletId,
  } = req.body;

  if (
    !bankName ||
    !totalDebt ||
    !monthlyPayment ||
    !monthlyRate ||
    !annualRate ||
    !creditNumber
  ) {
    return res.status(400).json({ message: "Missing required debt fields" });
  }

  try {
    const debt = await Debt.create({
      id: uuidv4(),
      userId,
      bankName,
      totalDebt,
      monthlyPayment,
      monthlyRate,
      annualRate,
      creditNumber,
      linkedWalletId: linkedWalletId || null,
    });
    return res.status(201).json({ debt });
  } catch (error) {
    console.error("Error creating debt:", error);
    return res.status(500).json({ message: "Server error creating debt" });
  }
}

async function updateDebt(req, res) {
  const userId = req.user.id;
  const { debtId } = req.params;
  const updateData = req.body;
  try {
    const debt = await Debt.findOne({ where: { id: debtId, userId } });
    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }
    Object.assign(debt, updateData);
    await debt.save();
    return res.json({ debt });
  } catch (error) {
    console.error("Error updating debt:", error);
    return res.status(500).json({ message: "Server error updating debt" });
  }
}

async function deleteDebt(req, res) {
  const userId = req.user.id;
  const { debtId } = req.params;
  try {
    const debt = await Debt.findOne({ where: { id: debtId, userId } });
    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }
    await debt.destroy();
    return res.json({ message: "Debt deleted successfully" });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return res.status(500).json({ message: "Server error deleting debt" });
  }
}

module.exports = {
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
};
