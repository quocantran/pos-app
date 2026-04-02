const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// All routes require authentication
router.use(auth);

router.get('/', inventoryController.getAll);
router.get('/low-stock', inventoryController.getLowStock);
router.get('/history', inventoryController.getHistory);

// Admin only
router.post('/import', roleCheck('ADMIN'), inventoryController.importStock);
router.put('/adjust/:variantId', roleCheck('ADMIN'), inventoryController.adjustStock);
router.put('/min-quantity/:variantId', roleCheck('ADMIN'), inventoryController.updateMinQuantity);

module.exports = router;
