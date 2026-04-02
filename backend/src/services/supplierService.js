const { Supplier, InventoryHistory, Variant, Product } = require('../models');
const { Op } = require('sequelize');

class SupplierService {
  async getAll(query = {}) {
    const { search, page = 1, limit = 50, is_active } = query;

    const where = {};

    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { supplier_code: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Supplier.findAndCountAll({
      where,
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

  async getById(id) {
    const supplier = await Supplier.findByPk(id, {
      include: [{
        model: InventoryHistory,
        as: 'imports',
        where: { type: 'IMPORT' },
        required: false,
        attributes: ['id', 'quantity_change', 'created_at', 'note'],
        include: [{
          model: Variant,
          as: 'variant',
          attributes: ['id', 'sku', 'barcode', 'size', 'color', 'cost_price', 'price'],
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }]
        }],
        order: [['created_at', 'DESC']]
      }]
    });
    if (!supplier) {
      throw { status: 404, message: 'Supplier not found' };
    }
    return supplier;
  }

  async create(data) {
    // Check duplicate name
    if (data.name) {
      const existing = await Supplier.findOne({ where: { name: data.name.trim() } });
      if (existing) {
        throw { status: 400, message: 'Nhà cung cấp đã tồn tại' };
      }
    }

    // Generate supplier code: NCC-YYYYMMDD-XXXX
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const supplier_code = data.supplier_code || `NCC-${y}${m}${d}-${random}`;

    const supplier = await Supplier.create({
      supplier_code,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      region: data.region?.trim() || null,
      ward: data.ward?.trim() || null,
      note: data.note?.trim() || null,
      is_active: true
    });

    return supplier;
  }

  async update(id, data) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      throw { status: 404, message: 'Supplier not found' };
    }

    // Check duplicate name (excluding current)
    if (data.name && data.name.trim() !== supplier.name) {
      const existing = await Supplier.findOne({
        where: { name: data.name.trim(), id: { [Op.ne]: id } }
      });
      if (existing) {
        throw { status: 400, message: 'Nhà cung cấp đã tồn tại' };
      }
    }

    await supplier.update({
      name: data.name?.trim() || supplier.name,
      phone: data.phone?.trim() ?? supplier.phone,
      address: data.address?.trim() ?? supplier.address,
      region: data.region?.trim() ?? supplier.region,
      ward: data.ward?.trim() ?? supplier.ward,
      note: data.note?.trim() ?? supplier.note,
      is_active: data.is_active !== undefined ? data.is_active : supplier.is_active
    });

    return supplier;
  }

  async delete(id) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      throw { status: 404, message: 'Supplier not found' };
    }

    // Soft delete - just deactivate
    await supplier.update({ is_active: false });
    return { message: 'Supplier deactivated successfully' };
  }
}

module.exports = new SupplierService();
