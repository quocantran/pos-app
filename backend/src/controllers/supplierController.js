const supplierService = require('../services/supplierService');

class SupplierController {
  async getAll(req, res, next) {
    try {
      const result = await supplierService.getAll(req.query);
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
      const supplier = await supplierService.getById(req.params.id);
      res.json({
        success: true,
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { name, phone, address, region, ward, note, supplier_code } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tên nhà cung cấp là bắt buộc'
        });
      }

      const supplier = await supplierService.create({
        supplier_code,
        name,
        phone,
        address,
        region,
        ward,
        note
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Supplier updated successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await supplierService.delete(req.params.id);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupplierController();
