const orderService = require('../services/orderService');

class OrderController {
  async getAll(req, res, next) {
    try {
      const result = await orderService.getAll(req.query);
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
      const order = await orderService.getById(req.params.id);
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const {
        items,
        customer_name,
        customer_phone,
        discount_amount,
        discount_percent,
        payment_method,
        payment_status,
        note
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items array is required and must not be empty'
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

      const order = await orderService.create({
        items,
        customer_name,
        customer_phone,
        discount_amount,
        discount_percent,
        payment_method,
        payment_status,
        note
      }, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  async processRefund(req, res, next) {
    try {
      const { items, reason } = req.body;
      const orderId = req.params.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Refund items array is required'
        });
      }

      // Validate refund items
      for (const item of items) {
        if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Each refund item must have order_item_id and positive quantity'
          });
        }
      }

      const result = await orderService.processRefund(orderId, items, req.user.id, reason || '');

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getRefundHistory(req, res, next) {
    try {
      const refunds = await orderService.getRefundHistory(req.params.id);
      res.json({
        success: true,
        data: refunds
      });
    } catch (error) {
      next(error);
    }
  }

  async getReceipt(req, res, next) {
    try {
      const receipt = await orderService.getReceipt(req.params.id);
      res.json({
        success: true,
        data: receipt
      });
    } catch (error) {
      next(error);
    }
  }

  async getTodaySummary(req, res, next) {
    try {
      const summary = await orderService.getTodaySummary();
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
