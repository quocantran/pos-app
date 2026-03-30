const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// All routes require authentication
router.use(auth);

router.get('/', orderController.getAll);
router.get('/today-summary', orderController.getTodaySummary);
router.get('/:id', orderController.getById);
router.get('/:id/receipt', orderController.getReceipt);
router.get('/:id/refunds', orderController.getRefundHistory);

// Create order (all authenticated users - staff can create orders)
router.post('/', orderController.create);

// Admin only - refunds
router.post('/:id/refund', roleCheck('ADMIN'), orderController.processRefund);

module.exports = router;
