#!/usr/bin/env python3
from pathlib import Path
app = Path('app.js').read_text()
old1 = "    const result = store.createStockAdjustment({ productId: product.id, quantity: formData.get('quantity'), note: formData.get('note') })"
new1 = "    const result = await store.createStockAdjustment({ productId: product.id, quantity: formData.get('quantity'), note: formData.get('note') })"
old2 = "    const result = store.transferStock({ productId: product.id, quantity: formData.get('quantity'), fromBranchId: formData.get('fromBranchId'), toBranchId: formData.get('toBranchId'), note: formData.get('note') })"
new2 = "    const result = await store.transferStock({ productId: product.id, quantity: formData.get('quantity'), fromBranchId: formData.get('fromBranchId'), toBranchId: formData.get('toBranchId'), note: formData.get('note') })"
old3 = """      const result = button.dataset.saleAction === 'invoice'
        ? await store.createInvoiceFromSale(button.dataset.id)
        : button.dataset.saleAction === 'ticket'
          ? await store.createTicketFromSale(button.dataset.id)
          : button.dataset.saleAction === 'cancel'
            ? store.cancelSale(button.dataset.id)
            : store.createReturnFromSale(button.dataset.id)
      feedbackMessage = result.message || ''
      if (result.ok && button.dataset.saleAction === 'invoice') { completeOnboardingStep('receipt'); resumeOnboardingAfterStep('receipt') }"""
new3 = """      try {
        const result = button.dataset.saleAction === 'invoice'
          ? await store.createInvoiceFromSale(button.dataset.id)
          : button.dataset.saleAction === 'ticket'
            ? await store.createTicketFromSale(button.dataset.id)
            : button.dataset.saleAction === 'cancel'
              ? await store.cancelSale(button.dataset.id)
              : await store.createReturnFromSale(button.dataset.id)
        feedbackMessage = result.message || ''
        if (result.ok && button.dataset.saleAction === 'invoice') { completeOnboardingStep('receipt'); resumeOnboardingAfterStep('receipt') }
      } catch (error) {
        feedbackMessage = error?.message || 'No se pudo completar la accion sobre la venta.'
      }"""
for name, old, new in [('stock-adj', old1, new1), ('stock-xfer', old2, new2), ('sale-actions', old3, new3)]:
    if old not in app:
        raise SystemExit(f'missing {name}')
    app = app.replace(old, new, 1)
Path('app.js').write_text(app)
print('app.js patched', len(app))
