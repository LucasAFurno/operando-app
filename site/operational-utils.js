// Cloud operations record receipts in the cash ledger. Desktop/legacy sales
// may only have a payment breakdown; use that fallback only without sale entries.
export const getCashSessionTotals = (session, sales = [], movements = []) => {
  const entries = session ? movements.filter((entry) => entry.cashSessionId === session.id) : []
  const receipts = entries.filter((entry) => entry.kind === 'sale')
  const manual = entries.filter((entry) => entry.kind !== 'sale')
  const sum = (items) => items.reduce((total, entry) => total + Number(entry.signedAmount || 0), 0)
  const cashSalesTotal = receipts.length ? sum(receipts) : session ? sales
    .filter((sale) => sale.cashSessionId === session.id && !['cancelled', 'returned'].includes(sale.status))
    .reduce((total, sale) => total + Number(sale.paymentBreakdown?.cash ?? (sale.paymentMethod === 'cash' ? sale.amountPaid : 0) ?? 0), 0) : 0
  const sessionCashMovementTotal = sum(manual)
  return {
    cashSalesTotal,
    sessionCashMovementTotal,
    sessionCashIncome: sum(manual.filter((entry) => Number(entry.signedAmount) > 0)),
    sessionCashExpenses: Math.abs(sum(manual.filter((entry) => Number(entry.signedAmount) < 0))),
    expectedCash: session ? Number(session.openingAmount || 0) + cashSalesTotal + sessionCashMovementTotal : 0,
  }
}

export const localDateKey = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const localTime = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export const localDateTime = (value) => {
  if (!value) return 'Sin fecha'
  const day = localDateKey(value)
  return day ? `${day} · ${localTime(value)}` : 'Sin fecha'
}
