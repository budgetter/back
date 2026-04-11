const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Assuming this exists

// Connect Flow
// This initiates the redirect to Google
router.get('/google/connect', authenticateToken, integrationController.connectGmail);

// Callback from Google
// Note: This matches the callbackURL constructed in the controller
router.get('/google/callback', integrationController.gmailCallback);

// Settings & Sync
router.get('/settings', authenticateToken, integrationController.getSettings);
router.put('/settings', authenticateToken, integrationController.updateSettings);
router.post('/sync', authenticateToken, integrationController.syncNow);

module.exports = router;
