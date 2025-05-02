const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const budgetController = require("../controllers/budgetController");

router.get("/current", authenticateToken, budgetController.getCurrentBudget);

router.get("/month", authenticateToken, budgetController.getBudgetForMonth);

router.get("/list", authenticateToken, budgetController.getBudgetList);

router.get(
  "/current/remaining",
  authenticateToken,
  budgetController.getRemainingBudget
);

router.get("/:budgetId", authenticateToken, budgetController.getBudget);

router.post("/", authenticateToken, budgetController.createBudget);

router.put("/:budgetId", authenticateToken, budgetController.updateBudget);

router.delete("/:budgetId", authenticateToken, budgetController.deleteBudget);

router.post("/default", authenticateToken, budgetController.createDefaultBudget);

module.exports = router;
