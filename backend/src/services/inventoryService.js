const { Inventory, InventoryHistory, Variant, Product, Category, User, Supplier, OrderItem, RefundItem, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

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

const randomCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateSku = (productName, size, color) => {
  const code = normalizeVietnamese(productName) || 'SP';
  const sizeCode = normalizeVietnamese(size) || 'DF';
  const colorCode = normalizeVietnamese(color) || 'DF';
  const random = randomCode(6);
  return `${code}-${sizeCode}-${colorCode}-${random}`;
};

const normalizeForCompare = (str) => String(str || '').trim().toLowerCase();
const isSameText = (left, right) => normalizeForCompare(left) === normalizeForCompare(right);

const canReuseInactiveBarcode = async (variantId, transaction = null) => {
  const [orderRef, refundRef] = await Promise.all([
    OrderItem.findOne({ where: { variant_id: variantId }, attributes: ['id'], transaction }),
    RefundItem.findOne({ where: { variant_id: variantId }, attributes: ['id'], transaction })
  ]);

  return !(orderRef || refundRef);
};

const generateSequentialBarcode = async (transaction = null) => {
  const options = {};
  if (transaction) options.transaction = transaction;

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

class InventoryService {
  async getAll(query = {}) {
    const { search, status, page = 1, limit = 10 } = query;

    const where = {};
    const variantWhere = { is_active: true };
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.max(1, parseInt(limit) || 10);

    if (search) {
      where[Op.or] = [
        sequelize.where(sequelize.col('variant.sku'), { [Op.like]: `%${search}%` }),
        sequelize.where(sequelize.col('variant.barcode'), { [Op.like]: `%${search}%` }),
        sequelize.where(sequelize.col('variant->product.name'), { [Op.like]: `%${search}%` })
      ];
    }

    const statusWhere = (() => {
      if (status === 'low') {
        return {
          [Op.and]: [
            { quantity: { [Op.gt]: 0 } },
            sequelize.where(sequelize.col('Inventory.quantity'), '<=', sequelize.col('Inventory.min_quantity'))
          ]
        };
      }
      if (status === 'out') {
        return { quantity: 0 };
      }
      if (status === 'ok') {
        return sequelize.where(sequelize.col('Inventory.quantity'), '>', sequelize.col('Inventory.min_quantity'));
      }
      return null;
    })();

    const mergeWhere = (baseWhere, extraWhere) => {
      const isEmptyBase = !baseWhere || (
        Object.keys(baseWhere).length === 0 && Object.getOwnPropertySymbols(baseWhere).length === 0
      );
      if (!extraWhere) return baseWhere;
      if (isEmptyBase) return extraWhere;
      return { [Op.and]: [baseWhere, extraWhere] };
    };

    const mainWhere = mergeWhere(where, statusWhere);
    const offset = (parsedPage - 1) * parsedLimit;

    const include = [{
      model: Variant,
      as: 'variant',
      where: variantWhere,
      include: [{
        model: Product,
        as: 'product',
        where: { is_active: true },
        attributes: ['id', 'name']
      }]
    }];

    let { count, rows } = await Inventory.findAndCountAll({
      where: mainWhere,
      include,
      order: [['updated_at', 'DESC']],
      limit: parsedLimit,
      offset,
      distinct: true,
      subQuery: false
    });

    const [totalCount, inStockCount, lowStockCount, outStockCount] = await Promise.all([
      Inventory.count({ where, include, distinct: true, subQuery: false }),
      Inventory.count({
        where: mergeWhere(where, sequelize.where(sequelize.col('Inventory.quantity'), '>', sequelize.col('Inventory.min_quantity'))),
        include,
        distinct: true,
        subQuery: false
      }),
      Inventory.count({
        where: mergeWhere(where, {
          [Op.and]: [
            { quantity: { [Op.gt]: 0 } },
            sequelize.where(sequelize.col('Inventory.quantity'), '<=', sequelize.col('Inventory.min_quantity'))
          ]
        }),
        include,
        distinct: true,
        subQuery: false
      }),
      Inventory.count({ where: mergeWhere(where, { quantity: 0 }), include, distinct: true, subQuery: false })
    ]);

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
      summary: {
        total: totalCount,
        in_stock: inStockCount,
        low_stock: lowStockCount,
        out_of_stock: outStockCount
      },
      pagination: {
        total: count,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(count / parsedLimit)
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
          throw { status: 404, message: `Không tìm thấy tồn kho cho biến thể ID: ${item.variant_id}` };
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
          note: item.note || data.note || 'Nhập kho',
          created_by: userId,
          supplier_id: data.supplier_id || null
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
        throw { status: 404, message: 'Không tìm thấy tồn kho' };
      }

      const oldQuantity = inventory.quantity;
      const quantityChange = quantity - oldQuantity;

      await inventory.update({ quantity }, { transaction });

      await InventoryHistory.create({
        variant_id: variantId,
        quantity_change: quantityChange,
        type: 'ADJUSTMENT',
        reference_id: null,
        note: note || 'Điều chỉnh tồn kho',
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
        { model: User, as: 'createdByUser', attributes: ['id', 'username', 'full_name'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'supplier_code', 'name', 'phone'] }
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

  async updateMinQuantity(variantId, minQuantity) {
    const inventory = await Inventory.findOne({
      where: { variant_id: variantId }
    });

    if (!inventory) {
      throw { status: 404, message: 'Không tìm thấy tồn kho cho sản phẩm này' };
    }

    await inventory.update({ min_quantity: minQuantity });

    return {
      variant_id: variantId,
      min_quantity: minQuantity
    };
  }

  /**
   * Generate Excel template for import
   */
  generateTemplate() {
    const templateData = [
      {
        'Barcode': '000001',
        'Tên sản phẩm': 'Áo dài lụa trắng',
        'Danh mục': 'Áo dài',
        'Size': 'M',
        'Màu': 'Trắng',
        'Giá bán': 350000,
        'Giá nhập': 200000,
        'Số lượng': 50
      },
      {
        'Barcode': '000002',
        'Tên sản phẩm': 'Áo dài lụa trắng',
        'Danh mục': 'Áo dài',
        'Size': 'L',
        'Màu': 'Đỏ',
        'Giá bán': 350000,
        'Giá nhập': 200000,
        'Số lượng': 30
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 },  // Barcode
      { wch: 25 },  // Tên sản phẩm
      { wch: 15 },  // Danh mục
      { wch: 10 },  // Size
      { wch: 12 },  // Màu
      { wch: 15 },  // Giá bán
      { wch: 15 },  // Giá nhập
      { wch: 12 },  // Số lượng
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Nhập kho');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Validate Excel import data (parse + validate)
   */
  async validateExcelImport(fileBuffer) {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw { status: 400, message: 'File Excel trống hoặc không có dữ liệu' };
    }

    const results = [];
    const seenManualBarcodes = new Set();

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      const item = {
        row: rowNum,
        barcode: String(row['Barcode'] || '').trim(),
        product_name: String(row['Tên sản phẩm'] || '').trim(),
        category_name: String(row['Danh mục'] || '').trim(),
        size: String(row['Size'] || '').trim(),
        color: String(row['Màu'] || '').trim(),
        price: Number(row['Giá bán'] || 0),
        cost_price: Number(row['Giá nhập'] || 0),
        quantity: Number(row['Số lượng'] || 0),
        errors: [],
        status: 'valid', // 'valid', 'error', 'new'
        variant_id: null,
        product_id: null,
        is_new_product: false,
        is_new_variant: false
      };

      // Validate required fields
      if (!item.product_name) {
        item.errors.push('Tên sản phẩm là bắt buộc');
      }
      if (!item.size) {
        item.errors.push('Size là bắt buộc');
      }
      if (!item.color) {
        item.errors.push('Màu là bắt buộc');
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        item.errors.push('Số lượng phải lớn hơn 0');
      }
      if (!Number.isFinite(item.price) || item.price <= 0) {
        item.errors.push('Giá bán phải lớn hơn 0');
      }
      if (!Number.isFinite(item.cost_price) || item.cost_price <= 0) {
        item.errors.push('Giá nhập phải lớn hơn 0');
      }
      if (item.cost_price >= item.price) {
        item.errors.push('Giá nhập phải nhỏ hơn giá bán');
      }

      // Check if barcode exists in DB
      if (item.barcode) {
        const normalizedBarcode = item.barcode.toLowerCase();
        if (seenManualBarcodes.has(normalizedBarcode)) {
          item.errors.push(`Mã vạch ${item.barcode} bị trùng trong file Excel`);
          item.status = 'error';
        } else {
          seenManualBarcodes.add(normalizedBarcode);
        }

        const existingVariant = await Variant.findOne({
          where: { barcode: item.barcode, is_active: true },
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }]
        });

        if (existingVariant) {
          const existingProductName = existingVariant.product?.name || '';
          const mismatchFields = [];

          if (!isSameText(existingProductName, item.product_name)) {
            mismatchFields.push('tên sản phẩm');
          }
          if (!isSameText(existingVariant.size, item.size)) {
            mismatchFields.push('size');
          }
          if (!isSameText(existingVariant.color, item.color)) {
            mismatchFields.push('màu');
          }

          if (mismatchFields.length > 0) {
            item.errors.push(`Mã vạch ${item.barcode} đã tồn tại nhưng không khớp ${mismatchFields.join(', ')} với dữ liệu đang có`);
            item.status = 'error';
          } else {
            item.variant_id = existingVariant.id;
            item.product_id = existingVariant.product_id;
            item.existing_product_name = existingProductName;
            item.is_new_product = false;
            item.is_new_variant = false;
            item.status = 'valid';
          }
        } else {
          const inactiveVariant = await Variant.findOne({
            where: { barcode: item.barcode, is_active: false },
            attributes: ['id']
          });

          if (inactiveVariant) {
            const canReuse = await canReuseInactiveBarcode(inactiveVariant.id);
            if (!canReuse) {
              item.errors.push(`Mã vạch ${item.barcode} đang thuộc biến thể cũ đã có hóa đơn, không thể tái sử dụng`);
              item.status = 'error';
            } else {
              item.is_new_variant = true;
              item.status = 'new';
            }
          } else {
            // Barcode provided but not found → will create new
            item.is_new_variant = true;
            item.status = 'new';
          }
        }
      } else {
        // No barcode → will create new product/variant with auto-generated barcode
        item.is_new_variant = true;
        item.status = 'new';
      }

      // If it's to be a new variant, check if the product name matches an existing product
      if (item.is_new_variant && item.product_name) {
        const existingProduct = await Product.findOne({
          where: {
            name: { [Op.like]: item.product_name },
            is_active: true
          }
        });
        if (existingProduct) {
          item.product_id = existingProduct.id;
          item.is_new_product = false;
          // Check if a variant with same size + color exists under this product
          const existingVariant = await Variant.findOne({
            where: {
              product_id: existingProduct.id,
              size: item.size,
              color: item.color,
              is_active: true
            }
          });
          if (existingVariant) {
            item.variant_id = existingVariant.id;
            item.is_new_variant = false;
            item.status = 'valid';
          }
        } else {
          item.is_new_product = true;
        }
      }

      if (item.errors.length > 0) {
        item.status = 'error';
      }

      results.push(item);
    }

    return results;
  }

  /**
   * Process Excel import: create new products/variants and add stock
   */
  async processExcelImport(validatedItems, userId, supplierId = null) {
    const transaction = await sequelize.transaction();

    try {
      const importResults = [];
      const createdProductsByKey = new Map();
      const reservedBarcodes = new Set(
        validatedItems
          .map((item) => String(item?.barcode || '').trim())
          .filter(Boolean)
      );

      for (const item of validatedItems) {
        if (item.status === 'error') continue;

        let variantId = item.variant_id;
        let productId = item.product_id;

        const productKey = `${normalizeVietnamese(item.product_name)}::${normalizeVietnamese(item.category_name)}`;

        // Re-validate barcode on server to prevent bypassing client-side checks.
        if (item.barcode) {
          const existingVariantByBarcode = await Variant.findOne({
            where: { barcode: item.barcode, is_active: true },
            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
            transaction
          });

          if (existingVariantByBarcode) {
            const mismatchFields = [];

            if (!isSameText(existingVariantByBarcode.product?.name, item.product_name)) {
              mismatchFields.push('tên sản phẩm');
            }
            if (!isSameText(existingVariantByBarcode.size, item.size)) {
              mismatchFields.push('size');
            }
            if (!isSameText(existingVariantByBarcode.color, item.color)) {
              mismatchFields.push('màu');
            }

            if (mismatchFields.length > 0) {
              throw {
                status: 400,
                message: `Dòng ${item.row || '?'}: mã vạch ${item.barcode} đã tồn tại nhưng không khớp ${mismatchFields.join(', ')}`
              };
            }

            variantId = existingVariantByBarcode.id;
            productId = existingVariantByBarcode.product_id;
            item.is_new_product = false;
            item.is_new_variant = false;
          }
        }

        // Reuse product created earlier in the same Excel import batch.
        if (!productId && createdProductsByKey.has(productKey)) {
          productId = createdProductsByKey.get(productKey);
          item.is_new_product = false;
        }

        // Create new product if needed
        if (item.is_new_product && !productId) {
          // Find or create category
          let categoryId = null;
          if (item.category_name) {
            let category = await Category.findOne({
              where: { name: { [Op.like]: item.category_name } },
              transaction
            });
            if (!category) {
              category = await Category.create({
                name: item.category_name,
                description: ''
              }, { transaction });
            }
            categoryId = category.id;
          }

          const product = await Product.create({
            name: item.product_name,
            category_id: categoryId,
            description: '',
            is_active: true
          }, { transaction });

          productId = product.id;
          createdProductsByKey.set(productKey, product.id);
        }

        // If product is still unknown, find existing active product by exact name.
        if (!productId) {
          const existingProduct = await Product.findOne({
            where: {
              name: { [Op.like]: item.product_name },
              is_active: true
            },
            transaction
          });

          if (existingProduct) {
            productId = existingProduct.id;
            item.is_new_product = false;
            createdProductsByKey.set(productKey, existingProduct.id);
          }
        }

        // Create new variant if needed
        if (item.is_new_variant && !variantId) {
          // Avoid creating duplicate variant (same size + color) under one product in the same import.
          const duplicateVariant = await Variant.findOne({
            where: {
              product_id: productId,
              size: item.size,
              color: item.color,
              is_active: true
            },
            transaction
          });

          if (duplicateVariant) {
            variantId = duplicateVariant.id;
            item.is_new_variant = false;
          }
        }

        if (item.is_new_variant && !variantId) {
          const sku = generateSku(item.product_name, item.size, item.color);
          let barcode = item.barcode;

          if (barcode) {
            const inactiveVariant = await Variant.findOne({
              where: { barcode, is_active: false },
              attributes: ['id'],
              transaction
            });

            if (inactiveVariant) {
              const canReuse = await canReuseInactiveBarcode(inactiveVariant.id, transaction);
              if (!canReuse) {
                throw {
                  status: 400,
                  message: `Dòng ${item.row || '?'}: mã vạch ${barcode} thuộc biến thể cũ đã có hóa đơn, không thể tái sử dụng`
                };
              }

              await Variant.update(
                { barcode: null },
                { where: { id: inactiveVariant.id }, transaction }
              );
            }
          }

          if (!barcode) {
            barcode = await generateSequentialBarcode(transaction);
            // Make sure generated barcode is unique
            let attempts = 0;
            while (attempts < 50) {
              if (reservedBarcodes.has(barcode)) {
                const nextNum = parseInt(barcode, 10) + 1;
                barcode = String(nextNum).padStart(4, '0');
                attempts++;
                continue;
              }

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

          reservedBarcodes.add(barcode);

          const variant = await Variant.create({
            product_id: productId,
            sku,
            barcode,
            size: item.size,
            color: item.color,
            price: item.price,
            cost_price: item.cost_price,
            is_active: true
          }, { transaction });

          variantId = variant.id;

          // Create inventory record
          await Inventory.create({
            variant_id: variantId,
            quantity: 0,
            min_quantity: 10
          }, { transaction });
        }

        // Add stock
        const inventory = await Inventory.findOne({
          where: { variant_id: variantId },
          transaction
        });

        if (!inventory) {
          throw { status: 404, message: `Không tìm thấy tồn kho cho biến thể ID: ${variantId}` };
        }

        const oldQuantity = inventory.quantity;
        const newQuantity = oldQuantity + item.quantity;

        await inventory.update({ quantity: newQuantity }, { transaction });

        // Update cost price if variant already exists
        if (!item.is_new_variant) {
          await Variant.update(
            { cost_price: item.cost_price, price: item.price },
            { where: { id: variantId }, transaction }
          );
        }

        await InventoryHistory.create({
          variant_id: variantId,
          quantity_change: item.quantity,
          type: 'IMPORT',
          reference_id: null,
          note: supplierId
            ? `Nhập kho từ file Excel | NCC ID: ${supplierId}`
            : 'Nhập kho từ file Excel',
          created_by: userId,
          supplier_id: supplierId || null
        }, { transaction });

        // Get variant with product info for result
        const variantInfo = await Variant.findByPk(variantId, {
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
          transaction
        });

        importResults.push({
          variant_id: variantId,
          product_name: variantInfo?.product?.name || item.product_name,
          barcode: variantInfo?.barcode || item.barcode,
          size: variantInfo?.size || item.size,
          color: variantInfo?.color || item.color,
          price: Number(variantInfo?.price || item.price),
          cost_price: Number(variantInfo?.cost_price || item.cost_price),
          quantity_imported: item.quantity,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          is_new_product: item.is_new_product,
          is_new_variant: item.is_new_variant
        });
      }

      await transaction.commit();
      return importResults;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new InventoryService();
