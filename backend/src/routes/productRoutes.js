const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// All routes require authentication
router.use(auth);

router.get('/', productController.getAll);
router.get('/next-barcode', productController.getNextBarcode);
router.get('/:id', productController.getById);

// Admin only
router.post('/', roleCheck('ADMIN'), productController.create);
router.put('/:id', roleCheck('ADMIN'), productController.update);
router.patch('/:id/discontinue', roleCheck('ADMIN'), productController.discontinue);
router.patch('/:id/reactivate', roleCheck('ADMIN'), productController.reactivate);
router.delete('/:id', roleCheck('ADMIN'), productController.delete);

module.exports = router;
