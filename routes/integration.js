const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const userCategoryMappingController = require('../controllers/userCategoryMappingController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Assuming this exists
const { syncRateLimiter } = require('../middlewares/syncRateLimiter');
const { errorSanitizer } = require('../middlewares/errorSanitizer');

// Connect Flow
// This initiates the redirect to Google
router.get('/google/connect', authenticateToken, integrationController.connectGmail);

// Callback from Google
// Note: This matches the callbackURL constructed in the controller
router.get('/google/callback', integrationController.gmailCallback);

// Settings & Sync
router.get('/settings', authenticateToken, integrationController.getSettings);
router.put('/settings', authenticateToken, integrationController.updateSettings);
router.post('/sync', authenticateToken, syncRateLimiter, integrationController.syncNow);

// Preferences
router.put('/preferences', authenticateToken, integrationController.updatePreferences);

// Disconnect
router.delete('/disconnect/:id', authenticateToken, integrationController.disconnectIntegration);

// Sync history
router.get('/sync-history', authenticateToken, integrationController.getSyncHistory);

// Reset processed emails
router.post('/reset-processed', authenticateToken, integrationController.resetProcessedEmails);

// Debug (DEV only — controller enforces production guard)
router.get('/debug/processed-emails', authenticateToken, integrationController.debugProcessedEmails);

// User category mappings
router.get('/category-mappings', authenticateToken, userCategoryMappingController.list);
router.post('/category-mappings', authenticateToken, userCategoryMappingController.create);
router.put('/category-mappings/:id', authenticateToken, userCategoryMappingController.update);
router.delete('/category-mappings/:id', authenticateToken, userCategoryMappingController.remove);

// Error sanitizer — must be last middleware on the router
router.use(errorSanitizer);

module.exports = router;
