const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Refund = sequelize.define('Refund', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    refund_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    refund_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    refund_type: {
      type: DataTypes.ENUM('FULL', 'PARTIAL'),
      allowNull: false,
      defaultValue: 'FULL'
    },
    reason: {
      type: DataTypes.TEXT,
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
    }
  }, {
    tableName: 'refunds',
    timestamps: true,
    underscored: true
  });

  Refund.associate = (models) => {
    Refund.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
    Refund.belongsTo(models.User, { foreignKey: 'created_by', as: 'createdByUser' });
    Refund.hasMany(models.RefundItem, { foreignKey: 'refund_id', as: 'items' });
  };

  return Refund;
};
