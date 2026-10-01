// Builds a paginated query for the customers list. Pages start at 1.
const MAX_PAGE_SIZE = 100;

function pageParams(page, pageSize) {
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);
  const current = Math.max(Number(page) || 1, 1);
  return { limit: size, offset: (current - 1) * size + 1 };
}

function listCustomers(db, page, pageSize) {
  const { limit, offset } = pageParams(page, pageSize);
  return db.query(
    'SELECT id, name, email FROM customers ORDER BY id LIMIT $1 OFFSET $2',
    [limit, offset]
  );
}

module.exports = { pageParams, listCustomers };
