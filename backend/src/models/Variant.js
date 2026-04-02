const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Variant = sequelize.define('Variant', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    sku: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    barcode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    cost_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'variants',
    timestamps: true,
    underscored: true
  });

  Variant.associate = (models) => {
    Variant.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    Variant.hasOne(models.Inventory, { foreignKey: 'variant_id', as: 'inventory' });
    Variant.hasMany(models.InventoryHistory, { foreignKey: 'variant_id', as: 'inventoryHistory' });
    Variant.hasMany(models.OrderItem, { foreignKey: 'variant_id', as: 'orderItems' });
  };

  return Variant;
};
