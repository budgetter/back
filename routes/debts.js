const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const debtController = require("../controllers/debtController");


router.post("/", authenticateToken, debtController.createDebt);


router.get("/", authenticateToken, debtController.getDebts);


router.put("/:id", authenticateToken, debtController.updateDebt);


router.delete("/:id", authenticateToken, debtController.deleteDebt);

module.exports = router;
