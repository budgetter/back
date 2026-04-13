const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const splitController = require('../controllers/splitController');

// Contacts — search MUST come before :contactId to avoid route conflicts
router.get('/contacts/search', authenticateToken, splitController.searchContacts);
router.get('/contacts', authenticateToken, splitController.getContacts);
router.post('/contacts', authenticateToken, splitController.addContact);
router.put('/contacts/:contactId', authenticateToken, splitController.updateContact);
router.delete('/contacts/:contactId', authenticateToken, splitController.removeContact);

// Debts
router.get('/debts/summary', authenticateToken, splitController.getDebtsSummary);
router.get('/debts/:userId', authenticateToken, splitController.getDebtsWithUser);

// Settlement
router.post('/:splitId/settle', authenticateToken, splitController.settleSplit);

// Invitations
router.delete('/invitations/:invitationId', authenticateToken, splitController.cancelInvitation);

// Recurrent split config
router.put('/recurrent/:recurrentPaymentId/split-config', authenticateToken, splitController.updateRecurrentSplitConfig);

module.exports = router;
