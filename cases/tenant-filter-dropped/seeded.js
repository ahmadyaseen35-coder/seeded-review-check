// Query helper for the orders table. Every query is scoped to one tenant.
function findOrders(db, tenantId, { status, customerId } = {}) {
  const args = [];
  const where = [];

  if (customerId) {
    args.push(customerId);
    where.push(`customer_id = $${args.length}`);
  } else {
    args.push(tenantId);
    where.push(`tenant_id = $${args.length}`);
  }
  if (status) {
    args.push(status);
    where.push(`status = $${args.length}`);
  }

  const sql = `SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id`;
  return db.query(sql, args);
}

module.exports = { findOrders };
