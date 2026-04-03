const { Order, OrderItem, Variant, Product, Category, Inventory, Refund, sequelize } = require('../models');
const { Op } = require('sequelize');

class ReportService {
  async getRevenueReport(query = {}) {
    const { start_date, end_date, group_by = 'day' } = query;

    // Default to last 30 days if no date provided
    let endDate, startDate;
    if (end_date) {
      const [ey, em, ed] = end_date.split('-').map(Number);
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    } else {
      endDate = new Date();
    }
    if (start_date) {
      const [sy, sm, sd] = start_date.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    } else {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    const pad = (value) => String(value).padStart(2, '0');
    const toDateKey = (date) => {
      const d = new Date(date);

      if (group_by === 'month') {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }

      if (group_by === 'week') {
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
        return `${tmp.getUTCFullYear()}-${pad(weekNo)}`;
      }

      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const orders = await Order.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'id',
        'created_at',
        'subtotal',
        'total'
      ],
      include: [
        {
          model: Refund,
          as: 'refunds',
          attributes: ['refund_amount']
        },
        {
          model: OrderItem,
          as: 'items',
          attributes: ['quantity', 'returned_quantity'],
          include: [
            {
              model: Variant,
              as: 'variant',
              attributes: ['cost_price']
            }
          ]
        }
      ],
      order: [['created_at', 'ASC']]
    });

    const bucketMap = new Map();

    for (const order of orders) {
      const date = toDateKey(order.created_at);
      const grossRevenue = parseFloat(order.subtotal || 0);
      const paidRevenue = parseFloat(order.total || 0);
      const discountTotal = Math.max(0, grossRevenue - paidRevenue);
      const refundTotal = (order.refunds || []).reduce(
        (sum, refund) => sum + parseFloat(refund.refund_amount || 0),
        0
      );
      const netRevenue = paidRevenue - refundTotal;
      const cogs = (order.items || []).reduce((sum, item) => {
        const soldQty = Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0));
        const costPrice = parseFloat(item.variant?.cost_price || 0);
        return sum + (soldQty * costPrice);
      }, 0);
      const grossProfit = netRevenue - cogs;

      if (!bucketMap.has(date)) {
        bucketMap.set(date, {
          date,
          total_orders: 0,
          gross_revenue: 0,
          total_discount: 0,
          total_refund: 0,
          net_revenue: 0,
          total_cost: 0,
          gross_profit: 0
        });
      }

      const bucket = bucketMap.get(date);
      bucket.total_orders += 1;
      bucket.gross_revenue += grossRevenue;
      bucket.total_discount += discountTotal;
      bucket.total_refund += refundTotal;
      bucket.net_revenue += netRevenue;
      bucket.total_cost += cogs;
      bucket.gross_profit += grossProfit;
    }

    const data = Array.from(bucketMap.values()).map((item) => ({
      ...item,
      // Keep compatibility with existing frontend key.
      revenue: item.net_revenue
    }));

    const totals = data.reduce((acc, item) => ({
      total_orders: acc.total_orders + item.total_orders,
      gross_revenue: acc.gross_revenue + item.gross_revenue,
      total_discount: acc.total_discount + item.total_discount,
      total_refund: acc.total_refund + item.total_refund,
      net_revenue: acc.net_revenue + item.net_revenue,
      total_cost: acc.total_cost + item.total_cost,
      gross_profit: acc.gross_profit + item.gross_profit
    }), {
      total_orders: 0,
      gross_revenue: 0,
      total_discount: 0,
      total_refund: 0,
      net_revenue: 0,
      total_cost: 0,
      gross_profit: 0
    });

    // Keep compatibility with old keys.
    totals.subtotal = totals.gross_revenue;
    totals.revenue = totals.net_revenue;

    return {
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        group_by
      },
      data,
      totals
    };
  }

  async getTopProducts(query = {}) {
    const { start_date, end_date, limit = 10 } = query;

    let endDate, startDate;
    if (end_date) {
      const [ey, em, ed] = end_date.split('-').map(Number);
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    } else {
      endDate = new Date();
    }
    if (start_date) {
      const [sy, sm, sd] = start_date.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    } else {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    const topProducts = await OrderItem.findAll({
      attributes: [
        'variant_id',
        [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'total_revenue'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('order_id'))), 'order_count']
      ],
      include: [
        {
          model: Variant,
          as: 'variant',
          attributes: ['id', 'sku', 'size', 'color', 'price'],
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name'],
            include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
          }]
        },
        {
          model: Order,
          as: 'order',
          attributes: [],
          where: {
            created_at: { [Op.between]: [startDate, endDate] },
            status: { [Op.ne]: 'REFUNDED' }
          }
        }
      ],
      group: ['variant_id', 'variant.id', 'variant->product.id', 'variant->product->category.id'],
      order: [[sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'DESC']],
      limit: parseInt(limit),
      subQuery: false
    });

    return {
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      },
      data: topProducts.map(item => ({
        variant_id: item.variant_id,
        product_name: item.variant?.product?.name || 'N/A',
        category: item.variant?.product?.category?.name || 'N/A',
        sku: item.variant?.sku || 'N/A',
        size: item.variant?.size || '',
        color: item.variant?.color || '',
        price: parseFloat(item.variant?.price || 0),
        total_quantity: parseInt(item.dataValues.total_quantity),
        total_revenue: parseFloat(item.dataValues.total_revenue),
        order_count: parseInt(item.dataValues.order_count)
      }))
    };
  }

  async getInventorySummary() {
    const inventories = await Inventory.findAll({
      include: [{
        model: Variant,
        as: 'variant',
        where: { is_active: true },
        attributes: ['id', 'sku', 'size', 'color', 'price', 'cost_price'],
        include: [{
          model: Product,
          as: 'product',
          where: { is_active: true },
          attributes: ['id', 'name'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        }]
      }]
    });

    let totalItems = 0;
    let totalValue = 0;
    let totalCost = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const byCategory = {};

    inventories.forEach(inv => {
      const quantity = inv.quantity;
      const price = parseFloat(inv.variant.price);
      const costPrice = parseFloat(inv.variant.cost_price);
      const categoryName = inv.variant.product.category?.name || 'Uncategorized';

      totalItems += quantity;
      totalValue += quantity * price;
      totalCost += quantity * costPrice;

      if (quantity === 0) {
        outOfStockCount++;
      } else if (quantity <= inv.min_quantity) {
        lowStockCount++;
      }

      if (!byCategory[categoryName]) {
        byCategory[categoryName] = {
          category: categoryName,
          total_items: 0,
          total_value: 0,
          variant_count: 0
        };
      }

      byCategory[categoryName].total_items += quantity;
      byCategory[categoryName].total_value += quantity * price;
      byCategory[categoryName].variant_count++;
    });

    return {
      summary: {
        total_variants: inventories.length,
        total_items: totalItems,
        total_value: Math.round(totalValue),
        total_cost: Math.round(totalCost),
        potential_profit: Math.round(totalValue - totalCost),
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount
      },
      by_category: Object.values(byCategory).map(cat => ({
        ...cat,
        total_value: Math.round(cat.total_value)
      }))
    };
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const getPeriodStats = async (periodStart) => {
      const orders = await Order.findAll({
        where: {
          created_at: { [Op.gte]: periodStart }
        },
        attributes: ['id', 'subtotal', 'total'],
        include: [
          {
            model: Refund,
            as: 'refunds',
            attributes: ['refund_amount']
          },
          {
            model: OrderItem,
            as: 'items',
            attributes: ['quantity', 'returned_quantity'],
            include: [
              {
                model: Variant,
                as: 'variant',
                attributes: ['cost_price']
              }
            ]
          }
        ]
      });

      const result = orders.reduce((acc, order) => {
        const grossRevenue = parseFloat(order.subtotal || 0);
        const paidRevenue = parseFloat(order.total || 0);
        const discountTotal = Math.max(0, grossRevenue - paidRevenue);
        const refundTotal = (order.refunds || []).reduce(
          (sum, refund) => sum + parseFloat(refund.refund_amount || 0),
          0
        );
        const netRevenue = paidRevenue - refundTotal;
        const totalCost = (order.items || []).reduce((sum, item) => {
          const soldQty = Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0));
          const costPrice = parseFloat(item.variant?.cost_price || 0);
          return sum + (soldQty * costPrice);
        }, 0);
        const profit = netRevenue - totalCost;

        acc.orders += 1;
        acc.gross_revenue += grossRevenue;
        acc.total_discount += discountTotal;
        acc.total_refund += refundTotal;
        acc.net_revenue += netRevenue;
        acc.total_cost += totalCost;
        acc.profit += profit;

        return acc;
      }, {
        orders: 0,
        gross_revenue: 0,
        total_discount: 0,
        total_refund: 0,
        net_revenue: 0,
        total_cost: 0,
        profit: 0
      });

      return {
        ...result,
        // Backward compatibility with old frontend key.
        revenue: Math.round(result.net_revenue)
      };
    };

    const [todayStats, monthStats] = await Promise.all([
      getPeriodStats(today),
      getPeriodStats(startOfMonth)
    ]);

    // Low stock count
    const lowStockCount = await Inventory.count({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col('quantity'), '<=', sequelize.col('min_quantity')),
          { quantity: 0 }
        ]
      },
      include: [{
        model: Variant,
        as: 'variant',
        where: { is_active: true }
      }]
    });

    // Total products
    const totalProducts = await Product.count({ where: { is_active: true } });

    return {
      today: {
        ...todayStats,
        orders: todayStats.orders,
        gross_revenue: Math.round(todayStats.gross_revenue),
        total_discount: Math.round(todayStats.total_discount),
        total_refund: Math.round(todayStats.total_refund),
        net_revenue: Math.round(todayStats.net_revenue),
        total_cost: Math.round(todayStats.total_cost),
        profit: Math.round(todayStats.profit),
        revenue: Math.round(todayStats.net_revenue)
      },
      this_month: {
        ...monthStats,
        orders: monthStats.orders,
        gross_revenue: Math.round(monthStats.gross_revenue),
        total_discount: Math.round(monthStats.total_discount),
        total_refund: Math.round(monthStats.total_refund),
        net_revenue: Math.round(monthStats.net_revenue),
        total_cost: Math.round(monthStats.total_cost),
        profit: Math.round(monthStats.profit),
        revenue: Math.round(monthStats.net_revenue)
      },
      low_stock_alerts: lowStockCount,
      total_products: totalProducts
    };
  }
}

module.exports = new ReportService();
