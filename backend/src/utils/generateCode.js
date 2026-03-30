/**
 * Generate order code with format: ORD-YYYYMMDD-XXXX
 * @returns {string} Order code
 */
const generateOrderCode = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);

  return `ORD-${year}${month}${day}-${random}`;
};

/**
 * Generate refund code with format: REF-YYYYMMDD-XXXX
 * @returns {string} Refund code
 */
const generateRefundCode = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);

  return `REF-${year}${month}${day}-${random}`;
};

/**
 * Generate SKU with format: SKU-XXXXX
 * @param {string} prefix - Optional prefix
 * @returns {string} SKU code
 */
const generateSKU = (prefix = 'SKU') => {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${random}`;
};

/**
 * Generate barcode (EAN-13 style but simplified)
 * @returns {string} Barcode
 */
const generateBarcode = () => {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(100 + Math.random() * 900);
  return `${timestamp}${random}`;
};

module.exports = {
  generateOrderCode,
  generateRefundCode,
  generateSKU,
  generateBarcode
};
