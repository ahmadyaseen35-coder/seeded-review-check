// Query helper for the orders table. Every query is scoped to one tenant.
function findOrders(db, tenantId, { status, customerId } = {}) {
  const args = [tenantId];
  const where = ['tenant_id = $1'];

  if (customerId) {
    args.push(customerId);
    where.push(`customer_id = $${args.length}`);
  }
  if (status) {
    args.push(status);
    where.push(`status = $${args.length}`);
  }

  const sql = `SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id`;
  return db.query(sql, args);
}

module.exports = { findOrders };
