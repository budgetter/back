const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware"); // e.g., require ['Leader']
const groupController = require("../controllers/groupController");


router.post("/", authenticateToken, groupController.createGroup);


router.get("/:groupId", authenticateToken, groupController.getGroup);


router.put(
  "/:groupId",
  authenticateToken,
  roleMiddleware(["Leader"]),
  groupController.updateGroup
);


router.delete(
  "/:groupId",
  authenticateToken,
  roleMiddleware(["Leader"]),
  groupController.deleteGroup
);


router.post("/:groupId/join", authenticateToken, groupController.joinGroup);

module.exports = router;
