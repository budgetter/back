const express = require("express");
const router = express.Router();
const debtController = require("../controllers/debtController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.get("/", authenticateToken, debtController.getDebts);
router.post("/", authenticateToken, debtController.createDebt);
router.put("/:debtId", authenticateToken, debtController.updateDebt);
router.delete("/:debtId", authenticateToken, debtController.deleteDebt);

module.exports = router;
