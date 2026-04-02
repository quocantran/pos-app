const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InventoryHistory = sequelize.define('InventoryHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    variant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'variants',
        key: 'id'
      }
    },
    quantity_change: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('IMPORT', 'SALE', 'RETURN', 'ADJUSTMENT'),
      allowNull: false
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'suppliers',
        key: 'id'
      }
    }
  }, {
    tableName: 'inventory_history',
    timestamps: true,
    underscored: true,
    updatedAt: false
  });

  InventoryHistory.associate = (models) => {
    InventoryHistory.belongsTo(models.Variant, { foreignKey: 'variant_id', as: 'variant' });
    InventoryHistory.belongsTo(models.User, { foreignKey: 'created_by', as: 'createdByUser' });
    InventoryHistory.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
  };

  return InventoryHistory;
};
