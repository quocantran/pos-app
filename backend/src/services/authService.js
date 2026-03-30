const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const jwtConfig = require('../config/jwt');

class AuthService {
  async login(username, password) {
    const user = await User.findOne({ where: { username } });

    if (!user) {
      throw { status: 401, message: 'Invalid username or password' };
    }

    if (!user.is_active) {
      throw { status: 401, message: 'User account is deactivated' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw { status: 401, message: 'Invalid username or password' };
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    };
  }

  async register(userData) {
    const existingUser = await User.findOne({ where: { username: userData.username } });

    if (existingUser) {
      throw { status: 400, message: 'Username already exists' };
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await User.create({
      ...userData,
      password: hashedPassword
    });

    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw { status: 400, message: 'Current password is incorrect' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({ password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    return user;
  }

  async updateProfile(userId, payload) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    if (payload.username !== user.username) {
      const existingUser = await User.findOne({ where: { username: payload.username } });
      if (existingUser) {
        throw { status: 400, message: 'Username already exists' };
      }
    }

    await user.update({
      full_name: payload.full_name,
      username: payload.username
    });

    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active
    };
  }
}

module.exports = new AuthService();
