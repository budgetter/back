const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.get("/", authenticateToken, walletController.getWallets);
router.post("/", authenticateToken, walletController.createWallet);
router.put("/:walletId", authenticateToken, walletController.updateWallet);
router.delete("/:walletId", authenticateToken, walletController.deleteWallet);

module.exports = router;
