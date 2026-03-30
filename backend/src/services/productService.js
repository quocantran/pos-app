const { Product, Category, Variant, Inventory, sequelize } = require('../models');
const { Op } = require('sequelize');

class ProductService {
  validateProductPayload(data) {
    const isBlank = (value) => !String(value ?? '').trim();
    const variants = Array.isArray(data.variants) ? data.variants : [];

    if (isBlank(data.name)) {
      throw { status: 400, message: 'Product name is required' };
    }

    if (!data.category_id) {
      throw { status: 400, message: 'Category is required' };
    }

    if (isBlank(data.description)) {
      throw { status: 400, message: 'Description is required' };
    }

    if (variants.length === 0) {
      throw { status: 400, message: 'At least one variant is required' };
    }

    const seenSku = new Set();
    const seenBarcode = new Set();

    variants.forEach((variant, index) => {
      const row = `Variant ${index + 1}`;

      if (isBlank(variant.sku)) {
        throw { status: 400, message: `${row}: sku is required` };
      }

      if (isBlank(variant.barcode)) {
        throw { status: 400, message: `${row}: barcode is required` };
      }

      if (isBlank(variant.size)) {
        throw { status: 400, message: `${row}: size is required` };
      }

      if (isBlank(variant.color)) {
        throw { status: 400, message: `${row}: color is required` };
      }

      const sku = String(variant.sku).trim().toLowerCase();
      const barcode = String(variant.barcode).trim().toLowerCase();

      if (seenSku.has(sku)) {
        throw { status: 400, message: `${row}: duplicate sku in variants list` };
      }

      if (seenBarcode.has(barcode)) {
        throw { status: 400, message: `${row}: duplicate barcode in variants list` };
      }

      seenSku.add(sku);
      seenBarcode.add(barcode);

      const price = Number(variant.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw { status: 400, message: `${row}: price must be greater than 0` };
      }

      const costPrice = Number(variant.cost_price);
      if (!Number.isFinite(costPrice) || costPrice <= 0) {
        throw { status: 400, message: `${row}: cost price must be greater than 0` };
      }

      const quantity = Number(variant.quantity);
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw { status: 400, message: `${row}: quantity must be a non-negative integer` };
      }
    });
  }

  async validateCategory(categoryId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw { status: 400, message: 'Category not found' };
    }
  }

  async getAll(query = {}) {
    const { search, category_id, is_active, page = 1, limit = 20 } = query;

    const where = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (category_id) {
      where.category_id = category_id;
    }

    where.is_active = is_active !== undefined ? is_active === 'true' : true;

    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        {
          model: Variant,
          as: 'variants',
          where: { is_active: true },
          required: false,
          include: [
            { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
          ]
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
    const product = await Product.findByPk(id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        {
          model: Variant,
          as: 'variants',
          where: { is_active: true },
          required: false,
          include: [
            { model: Inventory, as: 'inventory', attributes: ['quantity', 'min_quantity'] }
          ]
        }
      ]
    });

    if (!product) {
      throw { status: 404, message: 'Product not found' };
    }

    return product;
  }

  async create(data) {
    this.validateProductPayload(data);
    await this.validateCategory(data.category_id);

    const transaction = await sequelize.transaction();

    try {
      const product = await Product.create({
        name: data.name.trim(),
        category_id: data.category_id,
        description: data.description.trim(),
        is_active: data.is_active !== false
      }, { transaction });

      // Create variants if provided
      if (data.variants && data.variants.length > 0) {
        for (const variantData of data.variants) {
          const variant = await Variant.create({
            product_id: product.id,
            sku: String(variantData.sku).trim(),
            barcode: String(variantData.barcode).trim(),
            size: String(variantData.size).trim(),
            color: String(variantData.color).trim(),
            price: Number(variantData.price),
            cost_price: Number(variantData.cost_price),
            is_active: variantData.is_active !== false
          }, { transaction });

          // Create inventory record
          await Inventory.create({
            variant_id: variant.id,
            quantity: Number(variantData.quantity),
            min_quantity: variantData.min_quantity || 10
          }, { transaction });
        }
      }

      await transaction.commit();
      return await this.getById(product.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(id, data) {
    this.validateProductPayload(data);
    await this.validateCategory(data.category_id);

    const transaction = await sequelize.transaction();

    const product = await Product.findByPk(id, { transaction });

    if (!product) {
      await transaction.rollback();
      throw { status: 404, message: 'Product not found' };
    }

    try {
      await product.update({
        name: data.name.trim(),
        category_id: data.category_id,
        description: data.description.trim(),
        is_active: data.is_active
      }, { transaction });

      if (Array.isArray(data.variants)) {
        const existingVariants = await Variant.findAll({
          where: { product_id: id },
          transaction
        });

        const existingVariantMap = new Map(existingVariants.map((variant) => [variant.id, variant]));
        const incomingVariantIds = new Set();

        for (const variantData of data.variants) {
          if (variantData.id && existingVariantMap.has(variantData.id)) {
            const existingVariant = existingVariantMap.get(variantData.id);
            incomingVariantIds.add(existingVariant.id);

            await existingVariant.update({
              sku: String(variantData.sku).trim(),
              barcode: String(variantData.barcode).trim(),
              size: String(variantData.size).trim(),
              color: String(variantData.color).trim(),
              price: Number(variantData.price),
              cost_price: Number(variantData.cost_price),
              is_active: true
            }, { transaction });

            await Inventory.update({
              quantity: Number(variantData.quantity)
            }, {
              where: { variant_id: existingVariant.id },
              transaction
            });
          } else {
            const newVariant = await Variant.create({
              product_id: product.id,
              sku: String(variantData.sku).trim(),
              barcode: String(variantData.barcode).trim(),
              size: String(variantData.size).trim(),
              color: String(variantData.color).trim(),
              price: Number(variantData.price),
              cost_price: Number(variantData.cost_price),
              is_active: variantData.is_active !== false
            }, { transaction });

            await Inventory.create({
              variant_id: newVariant.id,
              quantity: Number(variantData.quantity),
              min_quantity: variantData.min_quantity || 10
            }, { transaction });

            incomingVariantIds.add(newVariant.id);
          }
        }

        const variantIdsToDeactivate = existingVariants
          .filter((variant) => !incomingVariantIds.has(variant.id))
          .map((variant) => variant.id);

        if (variantIdsToDeactivate.length > 0) {
          await Variant.update(
            { is_active: false },
            {
              where: { id: { [Op.in]: variantIdsToDeactivate } },
              transaction
            }
          );
        }
      }

      await transaction.commit();
      return await this.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async delete(id) {
    const product = await Product.findByPk(id);

    if (!product) {
      throw { status: 404, message: 'Product not found' };
    }

    // Soft delete - just set is_active to false
    await product.update({ is_active: false });

    // Also deactivate all variants
    await Variant.update(
      { is_active: false },
      { where: { product_id: id } }
    );

    return { message: 'Product deleted successfully' };
  }
}

module.exports = new ProductService();
