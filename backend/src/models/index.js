const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = require('../config/database');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: dbConfig.define
  }
);

// Import models
const User = require('./User')(sequelize);
const Category = require('./Category')(sequelize);
const Product = require('./Product')(sequelize);
const Variant = require('./Variant')(sequelize);
const Inventory = require('./Inventory')(sequelize);
const InventoryHistory = require('./InventoryHistory')(sequelize);
const Order = require('./Order')(sequelize);
const OrderItem = require('./OrderItem')(sequelize);
const Refund = require('./Refund')(sequelize);
const RefundItem = require('./RefundItem')(sequelize);
const Supplier = require('./Supplier')(sequelize);

// Create models object
const models = {
  User,
  Category,
  Product,
  Variant,
  Inventory,
  InventoryHistory,
  Order,
  OrderItem,
  Refund,
  RefundItem,
  Supplier
};

// Setup associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = {
  sequelize,
  Sequelize,
  ...models
};
