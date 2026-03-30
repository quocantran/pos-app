const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middlewares/auth');

// All routes require authentication
router.use(auth);

router.get('/dashboard', reportController.getDashboard);
router.get('/revenue', reportController.getRevenue);
router.get('/top-products', reportController.getTopProducts);
router.get('/inventory-summary', reportController.getInventorySummary);

module.exports = router;
