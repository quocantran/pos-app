const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RefundItem = sequelize.define('RefundItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    refund_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'refunds',
        key: 'id'
      }
    },
    order_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'order_items',
        key: 'id'
      }
    },
    variant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'variants',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    refund_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    }
  }, {
    tableName: 'refund_items',
    timestamps: true,
    underscored: true
  });

  RefundItem.associate = (models) => {
    RefundItem.belongsTo(models.Refund, { foreignKey: 'refund_id', as: 'refund' });
    RefundItem.belongsTo(models.OrderItem, { foreignKey: 'order_item_id', as: 'orderItem' });
    RefundItem.belongsTo(models.Variant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return RefundItem;
};
