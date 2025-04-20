const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const userController = require("../controllers/userController");

router.get("/me", authenticateToken, userController.getProfile);


router.put("/me", authenticateToken, userController.updateProfile);

router.put(
  "/me/change-password",
  authenticateToken,
  userController.changePassword
);

module.exports = router;
