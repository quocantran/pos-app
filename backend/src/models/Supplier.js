const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    supplier_code: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Tỉnh/TP - Quận/Huyện'
    },
    ward: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Phường/Xã'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    underscored: true
  });

  Supplier.associate = (models) => {
    Supplier.hasMany(models.InventoryHistory, { foreignKey: 'supplier_id', as: 'imports' });
  };

  return Supplier;
};
