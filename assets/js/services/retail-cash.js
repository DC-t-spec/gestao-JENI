// O recebimento de uma venda não é o saldo que sobra depois de comprar stock.
export function summarizeRetailCash(movements) {
  let received = 0, capital = 0, reinvested = 0, unclassified = 0;
  for (const movement of movements) {
    if (movement.kind === 'sale') received += Number(movement.amount_paid || 0);
    if (movement.kind !== 'entry') continue;
    if (movement.total_cost == null) { unclassified += 1; continue; }
    const cost = Number(movement.total_cost);
    if (cost === 0) continue;
    if (movement.funding_source === 'capital') capital += cost;
    else if (movement.funding_source === 'sales') reinvested += cost;
    else unclassified += 1;
  }
  return { received, capital, reinvested, unclassified,
    available: unclassified ? null : Number((received - reinvested).toFixed(2)) };
}
