#!/usr/bin/env python3
"""Apply remove_entity role lockdown client patches to data-store.js."""
from pathlib import Path

path = Path('data-store.js')
text = path.read_text()

old_wire = """  return wireDataStoreCloudMutations(api, {
    getCloudCoreAdapter: () => cloudCoreAdapter,
    syncFromCloud,
    getState: () => state,
    getProduct: (productId) => getProduct(state, productId),
    getBranch: (branchId) => getBranch(state, branchId),
    getCurrentBranch: () => getCurrentBranch(state),
    getCurrentRegister: () => getCurrentRegister(state),
    makeOperationId,
  })"""

new_wire = """  return wireDataStoreCloudMutations(api, {
    getCloudCoreAdapter: () => cloudCoreAdapter,
    syncFromCloud,
    getState: () => state,
    getProduct: (productId) => getProduct(state, productId),
    getBranch: (branchId) => getBranch(state, branchId),
    getCurrentBranch: () => getCurrentBranch(state),
    getCurrentRegister: () => getCurrentRegister(state),
    getCurrentUser: () => currentUser(),
    makeOperationId,
  })"""

old_sale = """    if (entity === 'sale') {
      revertSaleEffects(state, before)
      state.invoices = state.invoices.filter((invoice) => invoice.saleId !== before.id)
      state.tickets = state.tickets.filter((ticket) => ticket.saleId !== before.id)
    }"""

new_sale = """    if (entity === 'sale') {
      const user = currentUser()
      const roleKey = String(user?.roleKey || roleKeysById[user?.roleId] || '').toLowerCase()
      const isOwnerAdmin = Boolean(user?.isOwner || user?.isPlatformAdmin || roleKey === 'owner' || roleKey === 'admin')
      if (!isOwnerAdmin) {
        return cancelSale(id, 'Anulacion (eliminacion permanente solo owner/admin)')
      }
      revertSaleEffects(state, before)
      state.invoices = state.invoices.filter((invoice) => invoice.saleId !== before.id)
      state.tickets = state.tickets.filter((ticket) => ticket.saleId !== before.id)
    }"""

changed = False
if 'getCurrentUser: () => currentUser()' not in text:
    if old_wire not in text:
        raise SystemExit('missing wireDataStoreCloudMutations block')
    text = text.replace(old_wire, new_wire, 1)
    changed = True

if 'eliminacion permanente solo owner/admin' not in text:
    if old_sale not in text:
        raise SystemExit('missing sale removeEntity block')
    text = text.replace(old_sale, new_sale, 1)
    changed = True

path.write_text(text)
print('data-store.js lockdown patch', 'applied' if changed else 'already present', len(text))
