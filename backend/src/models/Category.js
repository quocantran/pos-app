const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    underscored: true
  });

  Category.associate = (models) => {
    Category.hasMany(models.Product, { foreignKey: 'category_id', as: 'products' });
  };

  return Category;
};
