const {
  Product,
  Category,
  Variant,
  Inventory,
  InventoryHistory,
  OrderItem,
  RefundItem,
  sequelize
} = require('../models');
const { Op } = require('sequelize');

/**
 * Remove Vietnamese diacritics and convert to uppercase slug.
 */
const normalizeVietnamese = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'D')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
};

/**
 * Generate random alphanumeric string (uppercase, 6 chars).
 */
const randomCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Auto-generate SKU: [PRODUCT_CODE]-[SIZE]-[COLOR]-[RANDOM6]
 */
const generateSku = (productName, size, color) => {
  const code = normalizeVietnamese(productName) || 'SP';
  const sizeCode = normalizeVietnamese(size) || 'DF';
  const colorCode = normalizeVietnamese(color) || 'DF';
  const random = randomCode(6);
  return `${code}-${sizeCode}-${colorCode}-${random}`;
};

/**
 * Generate a sequential numeric barcode: 000001, 000002, ...
 * Queries the database for the maximum numeric barcode and increments.
 */
const generateSequentialBarcode = async (transaction = null) => {
  const options = {};
  if (transaction) options.transaction = transaction;

  // Find the max barcode that is purely numeric (4+ digits)
  const lastVariant = await Variant.findOne({
    where: {
      barcode: {
        [Op.regexp]: '^[0-9]{4,}$'
      }
    },
    order: [
      [sequelize.cast(sequelize.col('barcode'), 'UNSIGNED'), 'DESC']
    ],
    attributes: ['barcode'],
    ...options
  });

  let nextNumber = 1;
  if (lastVariant && lastVariant.barcode) {
    nextNumber = parseInt(lastVariant.barcode, 10) + 1;
  }

  return String(nextNumber).padStart(4, '0');
};

/**
 * Check for duplicate barcode in the database.
 * @param {string} barcode - The barcode to check
 * @param {number|null} excludeVariantId - Variant ID to exclude (for updates)
 * @param {object} transaction - Sequelize transaction
 */
const checkDuplicateBarcode = async (barcode, excludeVariantId = null, transaction = null) => {
  if (!barcode || !String(barcode).trim()) return;

  const where = { barcode: String(barcode).trim() };
  if (excludeVariantId) {
    where.id = { [Op.ne]: excludeVariantId };
  }

  const options = { where };
  if (transaction) options.transaction = transaction;

  const existing = await Variant.findOne(options);
  if (existing) {
    if (!existing.is_active) {
      const [orderRef, refundRef] = await Promise.all([
        OrderItem.findOne({ where: { variant_id: existing.id }, attributes: ['id'], transaction }),
        RefundItem.findOne({ where: { variant_id: existing.id }, attributes: ['id'], transaction })
      ]);

      if (orderRef || refundRef) {
        throw {
          status: 400,
          message: `Mã vạch "${barcode}" đã thuộc về biến thể cũ có liên quan hóa đơn. Không thể tái sử dụng mã vạch này.`
        };
      }

      await existing.update({ barcode: null }, { transaction });
      return;
    }

    throw {
      status: 400,
      message: `Mã vạch "${barcode}" đã tồn tại trong hệ thống (thuộc biến thể ID: ${existing.id}). Vui lòng sử dụng mã vạch khác hoặc để hệ thống tự tạo.`
    };
  }
};

/**
 * Check for duplicate SKU in the database.
 * @param {string} sku - The SKU to check
 * @param {number|null} excludeVariantId - Variant ID to exclude (for updates)
 * @param {object} transaction - Sequelize transaction
 */
const checkDuplicateSku = async (sku, excludeVariantId = null, transaction = null) => {
  if (!sku || !String(sku).trim()) return;

  const where = { sku: String(sku).trim() };
  if (excludeVariantId) {
    where.id = { [Op.ne]: excludeVariantId };
  }

  const options = { where };
  if (transaction) options.transaction = transaction;

  const existing = await Variant.findOne(options);
  if (existing) {
    throw {
      status: 400,
      message: `Mã sản phẩm (SKU) "${sku}" đã tồn tại trong hệ thống (thuộc biến thể ID: ${existing.id}). Vui lòng sử dụng SKU khác.`
    };
  }
};

class ProductService {
  validateProductPayload(data, isUpdate = false) {
    const isBlank = (value) => !String(value ?? '').trim();
    const variants = Array.isArray(data.variants) ? data.variants : [];

    if (isBlank(data.name)) {
      throw { status: 400, message: 'Tên sản phẩm là bắt buộc' };
    }

    if (!data.category_id) {
      throw { status: 400, message: 'Danh mục sản phẩm là bắt buộc' };
    }

    if (variants.length === 0) {
      throw { status: 400, message: 'Sản phẩm phải có ít nhất 1 biến thể' };
    }

    const seenSku = new Set();
    const seenBarcode = new Set();

    variants.forEach((variant, index) => {
      const row = `Biến thể ${index + 1}`;

      if (isBlank(variant.size)) {
        throw { status: 400, message: `${row}: size là bắt buộc` };
      }

      if (isBlank(variant.color)) {
        throw { status: 400, message: `${row}: màu sắc là bắt buộc` };
      }

      // Check for duplicate SKUs within the payload
      if (variant.sku) {
        const sku = String(variant.sku).trim().toLowerCase();
        if (seenSku.has(sku)) {
          throw { status: 400, message: `${row}: SKU "${variant.sku}" đã bị trùng trong danh sách biến thể` };
        }
        seenSku.add(sku);
      }

      // Check for duplicate barcodes within the payload
      if (variant.barcode && String(variant.barcode).trim()) {
        const barcode = String(variant.barcode).trim().toLowerCase();
        if (seenBarcode.has(barcode)) {
          throw { status: 400, message: `${row}: Mã vạch "${variant.barcode}" đã bị trùng trong danh sách biến thể` };
        }
        seenBarcode.add(barcode);
      }

      const price = Number(variant.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw { status: 400, message: `${row}: giá bán phải lớn hơn 0` };
      }

      const costPrice = Number(variant.cost_price);
      if (!Number.isFinite(costPrice) || costPrice <= 0) {
        throw { status: 400, message: `${row}: giá nhập phải lớn hơn 0` };
      }

      if (costPrice >= price) {
        throw { status: 400, message: `${row}: giá nhập phải nhỏ hơn giá bán` };
      }
    });
  }

  async validateCategory(categoryId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw { status: 400, message: 'Không tìm thấy danh mục sản phẩm' };
    }
  }

  async getAll(query = {}) {
    const { search, category_id, is_active, page = 1, limit = 20 } = query;
    const isAllStatuses = String(is_active || '').toLowerCase() === 'all';

    const where = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (category_id) {
      where.category_id = category_id;
    }

    if (!isAllStatuses) {
      where.is_active = is_active !== undefined ? is_active === 'true' : true;
    }

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

    const enrichedRows = [];
    for (const row of rows) {
      const productData = row.toJSON();
      const linkedOrder = await OrderItem.findOne({
        attributes: ['id'],
        include: [
          {
            model: Variant,
            as: 'variant',
            attributes: ['id'],
            where: { product_id: productData.id },
            required: true
          }
        ]
      });

      const hasInvoiceReference = !!linkedOrder;

      enrichedRows.push({
        ...productData,
        has_invoice_reference: hasInvoiceReference
      });
    }

    return {
      data: enrichedRows,
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
      throw { status: 404, message: 'Không tìm thấy sản phẩm' };
    }

    return product;
  }

  async create(data) {
    this.validateProductPayload(data, false);
    await this.validateCategory(data.category_id);

    const transaction = await sequelize.transaction();

    try {
      const product = await Product.create({
        name: data.name.trim(),
        category_id: data.category_id,
        description: (data.description || '').trim(),
        is_active: data.is_active !== false
      }, { transaction });

      // Create variants if provided
      if (data.variants && data.variants.length > 0) {
        for (const variantData of data.variants) {
          // Auto-generate SKU if not provided
          const sku = variantData.sku && String(variantData.sku).trim()
            ? String(variantData.sku).trim()
            : generateSku(data.name, variantData.size, variantData.color);

          // Check duplicate SKU in DB
          await checkDuplicateSku(sku, null, transaction);

          // Auto-generate sequential barcode if not provided
          let barcode;
          if (variantData.barcode && String(variantData.barcode).trim()) {
            barcode = String(variantData.barcode).trim();
            // Check duplicate barcode in DB
            await checkDuplicateBarcode(barcode, null, transaction);
          } else {
            barcode = await generateSequentialBarcode(transaction);
            // Make sure generated barcode is unique (edge case with concurrent requests)
            let attempts = 0;
            while (attempts < 10) {
              const exists = await Variant.findOne({
                where: { barcode },
                transaction
              });
              if (!exists) break;
              const nextNum = parseInt(barcode, 10) + 1;
              barcode = String(nextNum).padStart(4, '0');
              attempts++;
            }
          }

          const variant = await Variant.create({
            product_id: product.id,
            sku,
            barcode,
            size: String(variantData.size).trim(),
            color: String(variantData.color).trim(),
            price: Number(variantData.price),
            cost_price: Number(variantData.cost_price),
            is_active: variantData.is_active !== false
          }, { transaction });

          // Create inventory record - default quantity is 0
          await Inventory.create({
            variant_id: variant.id,
            quantity: Number(variantData.quantity || 0),
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
    this.validateProductPayload(data, true);
    await this.validateCategory(data.category_id);

    const transaction = await sequelize.transaction();

    const product = await Product.findByPk(id, { transaction });

    if (!product) {
      await transaction.rollback();
      throw { status: 404, message: 'Không tìm thấy sản phẩm' };
    }

    try {
      await product.update({
        name: data.name.trim(),
        category_id: data.category_id,
        description: (data.description || '').trim(),
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

            const nextSku = variantData.sku && String(variantData.sku).trim()
              ? String(variantData.sku).trim()
              : generateSku(data.name, variantData.size, variantData.color);

            // Check duplicate SKU (exclude current variant)
            await checkDuplicateSku(nextSku, existingVariant.id, transaction);

            let nextBarcode;
            if (variantData.barcode !== undefined && variantData.barcode !== null && String(variantData.barcode).trim()) {
              nextBarcode = String(variantData.barcode).trim();
              // Check duplicate barcode (exclude current variant)
              await checkDuplicateBarcode(nextBarcode, existingVariant.id, transaction);
            } else {
              nextBarcode = existingVariant.barcode;
            }

            await existingVariant.update({
              sku: nextSku,
              barcode: nextBarcode || null,
              size: String(variantData.size).trim(),
              color: String(variantData.color).trim(),
              price: Number(variantData.price),
              cost_price: Number(variantData.cost_price),
              is_active: true
            }, { transaction });
          } else {
            // New variant - auto-generate SKU
            const sku = variantData.sku && String(variantData.sku).trim()
              ? String(variantData.sku).trim()
              : generateSku(data.name, variantData.size, variantData.color);

            await checkDuplicateSku(sku, null, transaction);

            let barcode;
            if (variantData.barcode && String(variantData.barcode).trim()) {
              barcode = String(variantData.barcode).trim();
              await checkDuplicateBarcode(barcode, null, transaction);
            } else {
              barcode = await generateSequentialBarcode(transaction);
              let attempts = 0;
              while (attempts < 10) {
                const exists = await Variant.findOne({
                  where: { barcode },
                  transaction
                });
                if (!exists) break;
                const nextNum = parseInt(barcode, 10) + 1;
                barcode = String(nextNum).padStart(4, '0');
                attempts++;
              }
            }

            const newVariant = await Variant.create({
              product_id: product.id,
              sku,
              barcode,
              size: String(variantData.size).trim(),
              color: String(variantData.color).trim(),
              price: Number(variantData.price),
              cost_price: Number(variantData.cost_price),
              is_active: variantData.is_active !== false
            }, { transaction });

            await Inventory.create({
              variant_id: newVariant.id,
              quantity: Number(variantData.quantity || 0),
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
    const transaction = await sequelize.transaction();

    try {
      const product = await Product.findByPk(id, { transaction });

      if (!product) {
        await transaction.rollback();
        throw { status: 404, message: 'Không tìm thấy sản phẩm' };
      }

      const variants = await Variant.findAll({
        where: { product_id: id },
        attributes: ['id'],
        transaction
      });

      const variantIds = variants.map((variant) => variant.id);

      if (variantIds.length > 0) {
        const existingOrderItem = await OrderItem.findOne({
          where: { variant_id: { [Op.in]: variantIds } },
          attributes: ['id'],
          transaction
        });

        const existingRefundItem = await RefundItem.findOne({
          where: { variant_id: { [Op.in]: variantIds } },
          attributes: ['id'],
          transaction
        });

        if (existingOrderItem || existingRefundItem) {
          throw {
            status: 409,
            message: 'Không thể xóa vì đã có hóa đơn chứa sản phẩm này. Vui lòng ngừng kinh doanh sản phẩm thay vì xóa.'
          };
        }

        await InventoryHistory.destroy({
          where: { variant_id: { [Op.in]: variantIds } },
          transaction
        });

        await Inventory.destroy({
          where: { variant_id: { [Op.in]: variantIds } },
          transaction
        });

        await Variant.destroy({
          where: { id: { [Op.in]: variantIds } },
          transaction
        });
      }

      await Product.destroy({
        where: { id },
        transaction
      });

      await transaction.commit();
      return { message: 'Xóa sản phẩm và toàn bộ biến thể thành công' };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async discontinue(id) {
    const transaction = await sequelize.transaction();

    try {
      const product = await Product.findByPk(id, { transaction });

      if (!product) {
        throw { status: 404, message: 'Không tìm thấy sản phẩm' };
      }

      await product.update({ is_active: false }, { transaction });

      await transaction.commit();
      return { message: 'Đã ngừng kinh doanh sản phẩm' };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async reactivate(id) {
    const transaction = await sequelize.transaction();

    try {
      const product = await Product.findByPk(id, { transaction });

      if (!product) {
        throw { status: 404, message: 'Không tìm thấy sản phẩm' };
      }

      await product.update({ is_active: true }, { transaction });

      await transaction.commit();
      return { message: 'Đã mở bán lại sản phẩm' };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * Generate the next sequential barcode (for frontend preview)
   */
  async getNextBarcode() {
    return await generateSequentialBarcode();
  }
}

module.exports = new ProductService();
