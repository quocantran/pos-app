const { Inventory, InventoryHistory, Variant, Product, User, sequelize } = require('../models');
const { Op } = require('sequelize');

class InventoryService {
  async getAll(query = {}) {
    const { search, status, page = 1, limit = 50 } = query;

    const where = {};
    const variantWhere = { is_active: true };

    if (search) {
      variantWhere[Op.or] = [
        { sku: { [Op.like]: `%${search}%` } },
        { barcode: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    let { count, rows } = await Inventory.findAndCountAll({
      where,
      include: [{
        model: Variant,
        as: 'variant',
        where: variantWhere,
        include: [{
          model: Product,
          as: 'product',
          where: { is_active: true },
          attributes: ['id', 'name']
        }]
      }],
      order: [['updated_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Filter by status if specified
    if (status) {
      rows = rows.filter(inv => {
        if (status === 'low') return inv.quantity <= inv.min_quantity && inv.quantity > 0;
        if (status === 'out') return inv.quantity === 0;
        if (status === 'ok') return inv.quantity > inv.min_quantity;
        return true;
      });
    }

    // Add status field
    rows = rows.map(inv => {
      const invData = inv.toJSON();
      if (invData.quantity === 0) {
        invData.status = 'out_of_stock';
      } else if (invData.quantity <= invData.min_quantity) {
        invData.status = 'low_stock';
      } else {
        invData.status = 'in_stock';
      }
      return invData;
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

  async getLowStock() {
    const inventories = await Inventory.findAll({
      include: [{
        model: Variant,
        as: 'variant',
        where: { is_active: true },
        include: [{
          model: Product,
          as: 'product',
          where: { is_active: true },
          attributes: ['id', 'name']
        }]
      }],
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col('quantity'), '<=', sequelize.col('min_quantity')),
          { quantity: 0 }
        ]
      },
      order: [['quantity', 'ASC']]
    });

    return inventories.map(inv => {
      const invData = inv.toJSON();
      invData.status = inv.quantity === 0 ? 'out_of_stock' : 'low_stock';
      return invData;
    });
  }

  async importStock(data, userId) {
    const transaction = await sequelize.transaction();

    try {
      const results = [];

      for (const item of data.items) {
        const inventory = await Inventory.findOne({
          where: { variant_id: item.variant_id },
          transaction
        });

        if (!inventory) {
          throw { status: 404, message: `Inventory not found for variant ID: ${item.variant_id}` };
        }

        const oldQuantity = inventory.quantity;
        const newQuantity = oldQuantity + item.quantity;

        // Update inventory
        await inventory.update({ quantity: newQuantity }, { transaction });

        // Create history record
        await InventoryHistory.create({
          variant_id: item.variant_id,
          quantity_change: item.quantity,
          type: 'IMPORT',
          reference_id: null,
          note: item.note || data.note || 'Stock import',
          created_by: userId
        }, { transaction });

        results.push({
          variant_id: item.variant_id,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          imported: item.quantity
        });
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async adjustStock(variantId, quantity, note, userId) {
    const transaction = await sequelize.transaction();

    try {
      const inventory = await Inventory.findOne({
        where: { variant_id: variantId },
        transaction
      });

      if (!inventory) {
        throw { status: 404, message: 'Inventory not found' };
      }

      const oldQuantity = inventory.quantity;
      const quantityChange = quantity - oldQuantity;

      await inventory.update({ quantity }, { transaction });

      await InventoryHistory.create({
        variant_id: variantId,
        quantity_change: quantityChange,
        type: 'ADJUSTMENT',
        reference_id: null,
        note: note || 'Stock adjustment',
        created_by: userId
      }, { transaction });

      await transaction.commit();

      return {
        variant_id: variantId,
        old_quantity: oldQuantity,
        new_quantity: quantity,
        change: quantityChange
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getHistory(query = {}) {
    const { variant_id, type, start_date, end_date, page = 1, limit = 50 } = query;

    const where = {};

    if (variant_id) {
      where.variant_id = variant_id;
    }

    if (type) {
      where.type = type;
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

    const { count, rows } = await InventoryHistory.findAndCountAll({
      where,
      include: [
        {
          model: Variant,
          as: 'variant',
          attributes: ['id', 'sku', 'barcode', 'size', 'color'],
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }]
        },
        { model: User, as: 'createdByUser', attributes: ['id', 'username', 'full_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
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
}

module.exports = new InventoryService();
