const variantService = require('../services/variantService');

class VariantController {
  async getAll(req, res, next) {
    try {
      const result = await variantService.getAll(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const variant = await variantService.getById(req.params.id);
      res.json({
        success: true,
        data: variant
      });
    } catch (error) {
      next(error);
    }
  }

  async getByBarcode(req, res, next) {
    try {
      const variant = await variantService.getByBarcode(req.params.barcode);
      res.json({
        success: true,
        data: variant
      });
    } catch (error) {
      next(error);
    }
  }

  async getBySku(req, res, next) {
    try {
      const variant = await variantService.getBySku(req.params.sku);
      res.json({
        success: true,
        data: variant
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { product_id, sku, barcode, size, color, price, cost_price, quantity, min_quantity, is_active } = req.body;

      if (!product_id) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const variant = await variantService.create({
        product_id,
        sku,
        barcode,
        size,
        color,
        price,
        cost_price,
        quantity,
        min_quantity,
        is_active
      });

      res.status(201).json({
        success: true,
        message: 'Variant created successfully',
        data: variant
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { sku, barcode, size, color, price, cost_price, is_active } = req.body;
      const variant = await variantService.update(req.params.id, {
        sku,
        barcode,
        size,
        color,
        price,
        cost_price,
        is_active
      });

      res.json({
        success: true,
        message: 'Variant updated successfully',
        data: variant
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await variantService.delete(req.params.id);
      res.json({
        success: true,
        message: 'Variant deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VariantController();
