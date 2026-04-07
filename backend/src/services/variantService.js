const { Variant, Product, Category, Inventory, sequelize } = require('../models');
const { Op } = require('sequelize');
const { generateSKU, generateBarcode } = require('../utils/generateCode');

class VariantService {
  async getAll(query = {}) {
    const { search, product_id, is_active, page = 1, limit = 50 } = query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { sku: { [Op.like]: `%${search}%` } },
        { barcode: { [Op.like]: `%${search}%` } },
        { '$product.name$': { [Op.like]: `%${search}%` } }
      ];
    }

    if (product_id) {
      where.product_id = product_id;
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Variant.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          where: { is_active: true },
          attributes: ['id', 'name'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        },
        { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
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
    const variant = await Variant.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        },
        { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
      ]
    });

    if (!variant) {
      throw { status: 404, message: 'Variant not found' };
    }

    return variant;
  }

  async getByBarcode(barcode) {
    const variant = await Variant.findOne({
      where: { barcode, is_active: true },
      include: [
        {
          model: Product,
          as: 'product',
          where: { is_active: true },
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        },
        { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
      ]
    });

    if (!variant) {
      throw { status: 404, message: 'Product not found with this barcode' };
    }

    return variant;
  }

  async getBySku(sku) {
    const variant = await Variant.findOne({
      where: { sku, is_active: true },
      include: [
        {
          model: Product,
          as: 'product',
          where: { is_active: true },
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        },
        { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
      ]
    });

    if (!variant) {
      throw { status: 404, message: 'Product not found with this SKU' };
    }

    return variant;
  }

  async create(data) {
    const transaction = await sequelize.transaction();

    try {
      // Check if product exists
      const product = await Product.findByPk(data.product_id);
      if (!product) {
        throw { status: 404, message: 'Product not found' };
      }

      // Generate SKU and barcode if not provided
      const sku = data.sku || generateSKU();
      const barcode = data.barcode || generateBarcode();

      const variant = await Variant.create({
        product_id: data.product_id,
        sku,
        barcode,
        size: data.size,
        color: data.color,
        price: data.price || 0,
        cost_price: data.cost_price || 0,
        is_active: data.is_active !== false
      }, { transaction });

      // Create inventory record
      await Inventory.create({
        variant_id: variant.id,
        quantity: data.quantity || 0,
        min_quantity: data.min_quantity || 10
      }, { transaction });

      await transaction.commit();
      return await this.getById(variant.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(id, data) {
    const variant = await Variant.findByPk(id);

    if (!variant) {
      throw { status: 404, message: 'Variant not found' };
    }

    await variant.update({
      sku: data.sku,
      barcode: data.barcode,
      size: data.size,
      color: data.color,
      price: data.price,
      cost_price: data.cost_price,
      is_active: data.is_active
    });

    return await this.getById(id);
  }

  async delete(id) {
    const variant = await Variant.findByPk(id);

    if (!variant) {
      throw { status: 404, message: 'Variant not found' };
    }

    // Soft delete
    await variant.update({ is_active: false });

    return { message: 'Variant deleted successfully' };
  }
}

module.exports = new VariantService();
