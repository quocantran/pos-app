const inventoryService = require('../services/inventoryService');
const multer = require('multer');

// Configure multer for file upload (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'), false);
    }
  }
});

class InventoryController {
  async getAll(req, res, next) {
    try {
      const result = await inventoryService.getAll(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req, res, next) {
    try {
      const data = await inventoryService.getLowStock();
      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async importStock(req, res, next) {
    try {
      const { items, note, supplier_id } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách sản phẩm nhập là bắt buộc'
        });
      }

      // Validate items
      for (const item of items) {
        if (!item.variant_id || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Mỗi sản phẩm phải có variant_id và số lượng > 0'
          });
        }
      }

      const result = await inventoryService.importStock({ items, note, supplier_id }, req.user.id);

      res.json({
        success: true,
        message: 'Nhập kho thành công',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { quantity, note } = req.body;
      const variantId = req.params.variantId;

      if (quantity === undefined || quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng không hợp lệ'
        });
      }

      const result = await inventoryService.adjustStock(variantId, quantity, note, req.user.id);

      res.json({
        success: true,
        message: 'Điều chỉnh tồn kho thành công',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req, res, next) {
    try {
      const result = await inventoryService.getHistory(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMinQuantity(req, res, next) {
    try {
      const variantId = req.params.variantId;
      const { min_quantity } = req.body;

      if (min_quantity === undefined || min_quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị ngưỡng cảnh báo không hợp lệ'
        });
      }

      const result = await inventoryService.updateMinQuantity(variantId, min_quantity);

      res.json({
        success: true,
        message: 'Cập nhật ngưỡng cảnh báo thành công',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download Excel template
   */
  async downloadTemplate(req, res, next) {
    try {
      const buffer = inventoryService.generateTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=mau_nhap_kho.xlsx');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload & validate Excel file
   */
  getUploadMiddleware() {
    return upload.single('file');
  }

  async validateExcel(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn file Excel để upload'
        });
      }

      const results = await inventoryService.validateExcelImport(req.file.buffer);

      const validCount = results.filter(r => r.status === 'valid').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const newCount = results.filter(r => r.status === 'new').length;

      res.json({
        success: true,
        message: `Đã validate ${results.length} dòng: ${validCount} hợp lệ, ${newCount} sẽ tạo mới, ${errorCount} lỗi`,
        data: {
          items: results,
          summary: {
            total: results.length,
            valid: validCount,
            error: errorCount,
            new: newCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm Excel import
   */
  async confirmExcelImport(req, res, next) {
    try {
      const { items, supplier_id } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có dữ liệu để import'
        });
      }

      // Filter out error items
      const validItems = items.filter(item => item.status !== 'error');

      if (validItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có dữ liệu hợp lệ để import'
        });
      }

      const results = await inventoryService.processExcelImport(validItems, req.user.id, supplier_id || null);

      res.json({
        success: true,
        message: `Nhập kho thành công ${results.length} sản phẩm`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
