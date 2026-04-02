const inventoryService = require('../services/inventoryService');

class InventoryController {
  async getAll(req, res, next) {
    try {
      const result = await inventoryService.getAll(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req, res, next) {
    try {
      const data = await inventoryService.getLowStock();
      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async importStock(req, res, next) {
    try {
      const { items, note, supplier_id } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items array is required'
        });
      }

      // Validate items
      for (const item of items) {
        if (!item.variant_id || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have variant_id and positive quantity'
          });
        }
      }

      const result = await inventoryService.importStock({ items, note, supplier_id }, req.user.id);

      res.json({
        success: true,
        message: 'Stock imported successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { quantity, note } = req.body;
      const variantId = req.params.variantId;

      if (quantity === undefined || quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid quantity is required'
        });
      }

      const result = await inventoryService.adjustStock(variantId, quantity, note, req.user.id);

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req, res, next) {
    try {
      const result = await inventoryService.getHistory(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMinQuantity(req, res, next) {
    try {
      const variantId = req.params.variantId;
      const { min_quantity } = req.body;

      if (min_quantity === undefined || min_quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị ngưỡng cảnh báo không hợp lệ'
        });
      }

      const result = await inventoryService.updateMinQuantity(variantId, min_quantity);

      res.json({
        success: true,
        message: 'Cập nhật ngưỡng cảnh báo thành công',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
