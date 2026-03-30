'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [categories] = await queryInterface.sequelize.query(
      'SELECT id, name FROM categories'
    );

    const findCategoryId = (...names) => {
      const category = categories.find((item) => names.includes(item.name));
      return category ? category.id : null;
    };

    const products = [
      {
        name: 'Áo dài lụa truyền thống',
        category_id: findCategoryId('Áo dài'),
        description: 'Áo dài chất liệu lụa mềm, phù hợp mặc lễ chùa.',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Áo bà ba cotton',
        category_id: findCategoryId('Áo bà ba'),
        description: 'Áo bà ba vải cotton thoáng mát, dễ giặt ủi.',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Quần suông vải kate',
        category_id: findCategoryId('Quần'),
        description: 'Quần suông form đứng, dễ phối cùng áo truyền thống.',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Áo khoác nhẹ đi lễ',
        category_id: findCategoryId('Áo khoác'),
        description: 'Áo khoác mỏng chống nắng, tiện mang theo khi đi lễ.',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('products', products);

    const productNames = products.map((item) => item.name);
    const [insertedProducts] = await queryInterface.sequelize.query(
      'SELECT id, name FROM products WHERE name IN (:names)',
      {
        replacements: { names: productNames }
      }
    );

    const getProductId = (name) => {
      const product = insertedProducts.find((item) => item.name === name);
      return product ? product.id : null;
    };

    const variants = [
      {
        product_id: getProductId('Áo dài lụa truyền thống'),
        sku: 'AD-LUA-S-WHT',
        barcode: '893100000001',
        size: 'S',
        color: 'Trắng',
        price: 650000,
        cost_price: 420000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Áo dài lụa truyền thống'),
        sku: 'AD-LUA-M-WHT',
        barcode: '893100000002',
        size: 'M',
        color: 'Trắng',
        price: 650000,
        cost_price: 420000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Áo dài lụa truyền thống'),
        sku: 'AD-LUA-L-BLU',
        barcode: '893100000003',
        size: 'L',
        color: 'Xanh navy',
        price: 690000,
        cost_price: 450000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Áo bà ba cotton'),
        sku: 'ABB-COT-M-BRN',
        barcode: '893100000004',
        size: 'M',
        color: 'Nâu',
        price: 320000,
        cost_price: 210000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Áo bà ba cotton'),
        sku: 'ABB-COT-L-BLK',
        barcode: '893100000005',
        size: 'L',
        color: 'Đen',
        price: 330000,
        cost_price: 220000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Quần suông vải kate'),
        sku: 'QK-SUONG-M-BLK',
        barcode: '893100000006',
        size: 'M',
        color: 'Đen',
        price: 260000,
        cost_price: 170000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Quần suông vải kate'),
        sku: 'QK-SUONG-L-GRY',
        barcode: '893100000007',
        size: 'L',
        color: 'Xám',
        price: 270000,
        cost_price: 175000,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        product_id: getProductId('Áo khoác nhẹ đi lễ'),
        sku: 'AK-NHE-FR-CRM',
        barcode: '893100000008',
        size: 'Free',
        color: 'Kem',
        price: 290000,
        cost_price: 180000,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('variants', variants);

    const variantSkus = variants.map((item) => item.sku);
    const [insertedVariants] = await queryInterface.sequelize.query(
      'SELECT id, sku FROM variants WHERE sku IN (:skus)',
      {
        replacements: { skus: variantSkus }
      }
    );

    const inventoryBySku = {
      'AD-LUA-S-WHT': { quantity: 25, min_quantity: 5 },
      'AD-LUA-M-WHT': { quantity: 18, min_quantity: 5 },
      'AD-LUA-L-BLU': { quantity: 12, min_quantity: 5 },
      'ABB-COT-M-BRN': { quantity: 30, min_quantity: 8 },
      'ABB-COT-L-BLK': { quantity: 14, min_quantity: 8 },
      'QK-SUONG-M-BLK': { quantity: 20, min_quantity: 10 },
      'QK-SUONG-L-GRY': { quantity: 7, min_quantity: 10 },
      'AK-NHE-FR-CRM': { quantity: 9, min_quantity: 6 }
    };

    const inventories = insertedVariants.map((item) => ({
      variant_id: item.id,
      quantity: inventoryBySku[item.sku].quantity,
      min_quantity: inventoryBySku[item.sku].min_quantity,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert('inventories', inventories);
  },

  async down(queryInterface, Sequelize) {
    const skuList = [
      'AD-LUA-S-WHT',
      'AD-LUA-M-WHT',
      'AD-LUA-L-BLU',
      'ABB-COT-M-BRN',
      'ABB-COT-L-BLK',
      'QK-SUONG-M-BLK',
      'QK-SUONG-L-GRY',
      'AK-NHE-FR-CRM'
    ];

    const [variants] = await queryInterface.sequelize.query(
      'SELECT id FROM variants WHERE sku IN (:skus)',
      {
        replacements: { skus: skuList }
      }
    );

    const variantIds = variants.map((item) => item.id);

    if (variantIds.length > 0) {
      await queryInterface.bulkDelete('inventories', {
        variant_id: {
          [Sequelize.Op.in]: variantIds
        }
      });
    }

    await queryInterface.bulkDelete('variants', {
      sku: {
        [Sequelize.Op.in]: skuList
      }
    });

    await queryInterface.bulkDelete('products', {
      name: {
        [Sequelize.Op.in]: [
          'Áo dài lụa truyền thống',
          'Áo bà ba cotton',
          'Quần suông vải kate',
          'Áo khoác nhẹ đi lễ'
        ]
      }
    });
  }
};
