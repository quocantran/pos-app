const express = require('express');
const router = express.Router();
const variantController = require('../controllers/variantController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// All routes require authentication
router.use(auth);

router.get('/', variantController.getAll);
router.get('/barcode/:barcode', variantController.getByBarcode);
router.get('/sku/:sku', variantController.getBySku);
router.get('/:id', variantController.getById);

// Admin only
router.post('/', roleCheck('ADMIN'), variantController.create);
router.put('/:id', roleCheck('ADMIN'), variantController.update);
router.delete('/:id', roleCheck('ADMIN'), variantController.delete);

module.exports = router;
