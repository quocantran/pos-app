const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// All routes require authentication
router.use(auth);

router.get('/', categoryController.getAll);
router.get('/:id', categoryController.getById);

// Admin only
router.post('/', roleCheck('ADMIN'), categoryController.create);
router.put('/:id', roleCheck('ADMIN'), categoryController.update);
router.delete('/:id', roleCheck('ADMIN'), categoryController.delete);

module.exports = router;
