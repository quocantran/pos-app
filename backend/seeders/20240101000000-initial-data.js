'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert('users', [{
      username: 'admin',
      password: hashedPassword,
      full_name: 'Administrator',
      role: 'ADMIN',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Create default categories for temple clothes
    await queryInterface.bulkInsert('categories', [
      {
        name: 'Áo dài',
        description: 'Traditional Vietnamese long dress',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Áo bà ba',
        description: 'Vietnamese traditional blouse',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Quần',
        description: 'Pants and trousers',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Váy',
        description: 'Skirts',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Áo khoác',
        description: 'Jackets and outerwear',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Phụ kiện',
        description: 'Accessories',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('categories', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
