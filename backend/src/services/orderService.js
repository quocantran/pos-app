const { Order, OrderItem, Variant, Product, Inventory, InventoryHistory, User, Refund, RefundItem, sequelize } = require('../models');
const { Op } = require('sequelize');
const { generateOrderCode, generateRefundCode } = require('../utils/generateCode');

class OrderService {
  async getAll(query = {}) {
    const { search, status, payment_status, start_date, end_date, page = 1, limit = 20 } = query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { order_code: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
        { customer_phone: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (payment_status) {
      where.payment_status = payment_status;
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        where.created_at[Op.lte] = new Date(end_date + 'T23:59:59');
      }
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'username', 'full_name'] },
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Variant,
            as: 'variant',
            attributes: ['id', 'sku', 'barcode', 'size', 'color', 'cost_price'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async getById(id) {
    const order = await Order.findByPk(id, {
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'username', 'full_name'] },
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Variant,
            as: 'variant',
            attributes: ['id', 'sku', 'barcode', 'size', 'color', 'price', 'cost_price'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ]
    });

    if (!order) {
      throw { status: 404, message: 'Order not found' };
    }

    return order;
  }

  async create(data, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Validate items
      if (!data.items || data.items.length === 0) {
        throw { status: 400, message: 'Order must have at least one item' };
      }

      let subtotal = 0;
      const orderItems = [];

      // Process each item
      for (const item of data.items) {
        const variant = await Variant.findByPk(item.variant_id, {
          include: [{ model: Inventory, as: 'inventory' }],
          transaction
        });

        if (!variant) {
          throw { status: 404, message: `Variant not found: ${item.variant_id}` };
        }

        if (!variant.is_active) {
          throw { status: 400, message: `Variant is not active: ${variant.sku}` };
        }

        // Check stock
        const currentStock = variant.inventory?.quantity || 0;
        if (currentStock < item.quantity) {
          throw { status: 400, message: `Insufficient stock for ${variant.sku}. Available: ${currentStock}` };
        }

        const unitPrice = item.unit_price || parseFloat(variant.price);
        const itemDiscount = item.discount_amount || 0;
        const itemTotal = (unitPrice * item.quantity) - itemDiscount;

        subtotal += itemTotal;

        orderItems.push({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount_amount: itemDiscount,
          total: itemTotal
        });
      }

      // Calculate totals
      const discountAmount = data.discount_amount || 0;
      const discountPercent = data.discount_percent || 0;
      let total = subtotal - discountAmount;

      if (discountPercent > 0) {
        total = total * (1 - discountPercent / 100);
      }

      // Create order
      const orderCode = generateOrderCode();
      const order = await Order.create({
        order_code: orderCode,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        subtotal,
        discount_amount: discountAmount,
        discount_percent: discountPercent,
        total: Math.round(total),
        payment_method: data.payment_method || 'CASH',
        payment_status: data.payment_status || 'PAID',
        status: 'COMPLETED',
        note: data.note,
        created_by: userId
      }, { transaction });

      // Create order items and update inventory
      for (const item of orderItems) {
        await OrderItem.create({
          order_id: order.id,
          ...item
        }, { transaction });

        // Update inventory
        await Inventory.decrement('quantity', {
          by: item.quantity,
          where: { variant_id: item.variant_id },
          transaction
        });

        // Create inventory history
        await InventoryHistory.create({
          variant_id: item.variant_id,
          quantity_change: -item.quantity,
          type: 'SALE',
          reference_id: order.id,
          note: `Sold in order ${orderCode}`,
          created_by: userId
        }, { transaction });
      }

      await transaction.commit();
      return await this.getById(order.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async processRefund(orderId, refundItems, userId, reason = '') {
    const transaction = await sequelize.transaction();

    try {
      const order = await Order.findByPk(orderId, {
        include: [{ model: OrderItem, as: 'items' }],
        transaction
      });

      if (!order) {
        throw { status: 404, message: 'Order not found' };
      }

      if (order.status === 'REFUNDED') {
        throw { status: 400, message: 'Order is already fully refunded' };
      }

      let refundTotal = 0;
      const refundItemsData = [];

      for (const refundItem of refundItems) {
        const orderItem = order.items.find(i => i.id === refundItem.order_item_id);

        if (!orderItem) {
          throw { status: 404, message: `Order item not found: ${refundItem.order_item_id}` };
        }

        const maxRefundable = orderItem.quantity - orderItem.returned_quantity;
        if (refundItem.quantity > maxRefundable) {
          throw { status: 400, message: `Cannot refund more than ${maxRefundable} units for item ${refundItem.order_item_id}` };
        }

        // Update order item
        await orderItem.update({
          returned_quantity: orderItem.returned_quantity + refundItem.quantity
        }, { transaction });

        // Update inventory (return stock)
        await Inventory.increment('quantity', {
          by: refundItem.quantity,
          where: { variant_id: orderItem.variant_id },
          transaction
        });

        // Create inventory history
        await InventoryHistory.create({
          variant_id: orderItem.variant_id,
          quantity_change: refundItem.quantity,
          type: 'RETURN',
          reference_id: order.id,
          note: reason || `Refund from order ${order.order_code}`,
          created_by: userId
        }, { transaction });

        // Calculate refund amount
        const unitRefund = parseFloat(orderItem.total) / orderItem.quantity;
        const itemRefundAmount = unitRefund * refundItem.quantity;
        refundTotal += itemRefundAmount;

        refundItemsData.push({
          order_item_id: orderItem.id,
          variant_id: orderItem.variant_id,
          quantity: refundItem.quantity,
          unit_price: parseFloat(orderItem.unit_price),
          refund_amount: itemRefundAmount
        });
      }

      // Check if all items are fully refunded
      const updatedOrder = await Order.findByPk(orderId, {
        include: [{ model: OrderItem, as: 'items' }],
        transaction
      });

      const allItemsRefunded = updatedOrder.items.every(
        item => item.returned_quantity >= item.quantity
      );

      const refundType = allItemsRefunded ? 'FULL' : 'PARTIAL';

      // Create refund record
      const refundCode = generateRefundCode();
      const refund = await Refund.create({
        refund_code: refundCode,
        order_id: orderId,
        refund_amount: Math.round(refundTotal),
        refund_type: refundType,
        reason: reason,
        created_by: userId
      }, { transaction });

      // Create refund items
      for (const item of refundItemsData) {
        await RefundItem.create({
          refund_id: refund.id,
          ...item
        }, { transaction });
      }

      // Update order status
      await order.update({
        status: allItemsRefunded ? 'REFUNDED' : 'PARTIAL_REFUND'
      }, { transaction });

      await transaction.commit();

      return {
        refund_code: refundCode,
        order_id: orderId,
        refund_total: Math.round(refundTotal),
        refund_type: refundType,
        status: allItemsRefunded ? 'REFUNDED' : 'PARTIAL_REFUND',
        refunded_items: refundItemsData
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getRefundHistory(orderId) {
    const refunds = await Refund.findAll({
      where: { order_id: orderId },
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'username', 'full_name'] },
        {
          model: RefundItem,
          as: 'items',
          include: [{
            model: Variant,
            as: 'variant',
            attributes: ['id', 'sku', 'size', 'color'],
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
          }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return refunds;
  }

  async getReceipt(orderId) {
    const order = await this.getById(orderId);

    // Get refund history for this order
    const refunds = await Refund.findAll({
      where: { order_id: orderId },
      include: [{
        model: RefundItem,
        as: 'items',
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['id', 'sku', 'size', 'color'],
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
        }]
      },
      { model: User, as: 'createdByUser', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const totalRefunded = refunds.reduce((sum, r) => sum + parseFloat(r.refund_amount), 0);

    return {
      order_code: order.order_code,
      created_at: order.created_at,
      cashier: order.createdByUser?.full_name || 'N/A',
      customer_name: order.customer_name || 'Khách lẻ',
      customer_phone: order.customer_phone || '',
      status: order.status,
      items: order.items.map(item => ({
        name: item.variant?.product?.name || 'N/A',
        sku: item.variant?.sku || 'N/A',
        size: item.variant?.size || '',
        color: item.variant?.color || '',
        quantity: item.quantity,
        returned_quantity: item.returned_quantity || 0,
        actual_quantity: item.quantity - (item.returned_quantity || 0),
        unit_price: parseFloat(item.unit_price),
        discount: parseFloat(item.discount_amount),
        total: parseFloat(item.total),
        actual_total: parseFloat(item.unit_price) * (item.quantity - (item.returned_quantity || 0))
      })),
      subtotal: parseFloat(order.subtotal),
      discount_amount: parseFloat(order.discount_amount),
      discount_percent: parseFloat(order.discount_percent),
      total: parseFloat(order.total),
      total_refunded: totalRefunded,
      final_total: parseFloat(order.total) - totalRefunded,
      payment_method: order.payment_method,
      note: order.note,
      refunds: refunds.map(r => ({
        refund_code: r.refund_code,
        refund_amount: parseFloat(r.refund_amount),
        refund_type: r.refund_type,
        reason: r.reason,
        created_at: r.created_at,
        created_by: r.createdByUser?.full_name || 'N/A',
        items: r.items.map(ri => ({
          name: ri.variant?.product?.name || 'N/A',
          sku: ri.variant?.sku || 'N/A',
          size: ri.variant?.size || '',
          color: ri.variant?.color || '',
          quantity: ri.quantity,
          unit_price: parseFloat(ri.unit_price),
          refund_amount: parseFloat(ri.refund_amount)
        }))
      }))
    };
  }

  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.findAll({
      where: {
        created_at: { [Op.gte]: today },
        status: { [Op.ne]: 'REFUNDED' }
      }
    });

    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalOrders = orders.length;

    return {
      date: today.toISOString().split('T')[0],
      total_orders: totalOrders,
      total_revenue: totalRevenue
    };
  }
}

module.exports = new OrderService();
