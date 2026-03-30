const reportService = require('../services/reportService');

class ReportController {
  async getRevenue(req, res, next) {
    try {
      const result = await reportService.getRevenueReport(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getTopProducts(req, res, next) {
    try {
      const result = await reportService.getTopProducts(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getInventorySummary(req, res, next) {
    try {
      const result = await reportService.getInventorySummary();
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const result = await reportService.getDashboardStats();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
