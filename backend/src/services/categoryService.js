const { Category } = require('../models');

class CategoryService {
  async getAll() {
    return await Category.findAll({
      order: [['name', 'ASC']]
    });
  }

  async getById(id) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw { status: 404, message: 'Category not found' };
    }
    return category;
  }

  async create(data) {
    return await Category.create(data);
  }

  async update(id, data) {
    const category = await this.getById(id);
    return await category.update(data);
  }

  async delete(id) {
    const category = await this.getById(id);
    await category.destroy();
    return { message: 'Category deleted successfully' };
  }
}

module.exports = new CategoryService();
