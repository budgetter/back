const express = require("express");
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require("../middlewares/authMiddleware");
const {
  createSection,
  deleteSection,
} = require("../controllers/budgetSectionController");

router.get("/:budgetId/sections", (req, res) =>
  res.status(501).json({ message: "getSectionsByBudgetId not implemented" })
);

router.get("/:budgetId/sections/:sectionId", (req, res) =>
  res.status(501).json({ message: "getSectionById not implemented" })
);

router.post("/:budgetId/sections", authenticateToken, createSection);

router.put("/:budgetId/sections/:sectionId", (req, res) =>
  res.status(501).json({ message: "updateSection not implemented" })
);

router.delete("/sections/:sectionId", authenticateToken, deleteSection);

module.exports = router;
