const productService = require('../services/productService');

class ProductController {
  async getAll(req, res, next) {
    try {
      const result = await productService.getAll(req.query);
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
      const product = await productService.getById(req.params.id);
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { name, category_id, description, is_active, variants } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Tên sản phẩm là bắt buộc'
        });
      }

      const product = await productService.create({
        name,
        category_id,
        description,
        is_active,
        variants
      });

      res.status(201).json({
        success: true,
        message: 'Tạo sản phẩm thành công',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { name, category_id, description, is_active, variants } = req.body;
      const product = await productService.update(req.params.id, {
        name,
        category_id,
        description,
        is_active,
        variants
      });

      res.json({
        success: true,
        message: 'Cập nhật sản phẩm thành công',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await productService.delete(req.params.id);
      res.json({
        success: true,
        message: 'Xóa sản phẩm thành công'
      });
    } catch (error) {
      next(error);
    }
  }

  async discontinue(req, res, next) {
    try {
      await productService.discontinue(req.params.id);
      res.json({
        success: true,
        message: 'Đã ngừng kinh doanh sản phẩm'
      });
    } catch (error) {
      next(error);
    }
  }

  async reactivate(req, res, next) {
    try {
      await productService.reactivate(req.params.id);
      res.json({
        success: true,
        message: 'Đã mở bán lại sản phẩm'
      });
    } catch (error) {
      next(error);
    }
  }

  async getNextBarcode(req, res, next) {
    try {
      const barcode = await productService.getNextBarcode();
      res.json({
        success: true,
        data: { barcode }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
