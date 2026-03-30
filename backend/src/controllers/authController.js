const authService = require('../services/authService');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      const result = await authService.login(username, password);

      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const { username, password, full_name, role } = req.body;

      if (!username || !password || !full_name) {
        return res.status(400).json({
          success: false,
          message: 'Username, password, and full name are required'
        });
      }

      const result = await authService.register({ username, password, full_name, role });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters'
        });
      }

      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { full_name, username } = req.body;

      if (!full_name || !full_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Full name is required'
        });
      }

      if (!username || !username.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Username is required'
        });
      }

      const user = await authService.updateProfile(req.user.id, {
        full_name: full_name.trim(),
        username: username.trim()
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
