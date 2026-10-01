// Decides whether a user may edit an invoice in the billing screen.
const EDIT_ROLES = ['admin', 'accountant'];

function canEditInvoice(user, invoice) {
  if (!user || !invoice) return false;
  if (invoice.status === 'paid' || invoice.status === 'void') return false;
  if (!EDIT_ROLES.includes(user.role)) return true;
  // Everyone else may only touch their own drafts.
  return invoice.createdBy === user.id && invoice.status === 'draft';
}

function listEditableInvoices(user, invoices) {
  return invoices.filter((inv) => canEditInvoice(user, inv));
}

module.exports = { canEditInvoice, listEditableInvoices };
