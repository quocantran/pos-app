const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    customer_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    customer_phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    discount_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    payment_method: {
      type: DataTypes.ENUM('CASH', 'CARD', 'TRANSFER'),
      allowNull: false,
      defaultValue: 'CASH'
    },
    payment_status: {
      type: DataTypes.ENUM('PAID', 'PARTIAL', 'UNPAID'),
      allowNull: false,
      defaultValue: 'PAID'
    },
    status: {
      type: DataTypes.ENUM('COMPLETED', 'REFUNDED', 'PARTIAL_REFUND'),
      allowNull: false,
      defaultValue: 'COMPLETED'
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
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'created_by', as: 'createdByUser' });
    Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
    Order.hasMany(models.Refund, { foreignKey: 'order_id', as: 'refunds' });
  };

  return Order;
};
