import type { Expense, ExpenseGroup, Member, Settlement } from "./types";

export function formatYen(amount: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(amount);
}

export function equalShares(memberIds: string[]) {
  const count = memberIds.length;
  if (!count) return {} as Record<string, number>;
  const base = Math.floor(10_000 / count) / 100;
  const remainder = Math.round((100 - base * count) * 100);
  return Object.fromEntries(memberIds.map((id, index) => [id, Number((base + (index < remainder ? 0.01 : 0)).toFixed(2))]));
}

export function normalizeShares(source: Record<string, number>, members: Member[]) {
  const ids = members.map((member) => member.id);
  const total = ids.reduce((sum, id) => sum + Math.max(0, source[id] || 0), 0);
  if (total <= 0) return equalShares(ids);
  const raw = ids.map((id) => (Math.max(0, source[id] || 0) / total) * 10_000);
  const floors = raw.map(Math.floor);
  const remainder = 10_000 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) floors[order[index].index] += 1;
  return Object.fromEntries(ids.map((id, index) => [id, floors[index] / 100]));
}

export function amountByPercent(amount: number, shares: Record<string, number>, members: Member[]) {
  if (!members.length) return {} as Record<string, number>;
  const raw = members.map((member) => (amount * (shares[member.id] || 0)) / 100);
  const whole = raw.map(Math.floor);
  const remainder = amount - whole.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - whole[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) whole[order[index % order.length].index] += 1;
  return Object.fromEntries(members.map((member, index) => [member.id, whole[index]]));
}

export function expenseAllocations(expense: Expense, group: Pick<ExpenseGroup, "members" | "shares">) {
  return amountByPercent(expense.amount, expense.shares ?? group.shares, group.members);
}

export function calculateLedger(group: Pick<ExpenseGroup, "members" | "shares" | "expenses">) {
  const paid = Object.fromEntries(group.members.map((member) => [member.id, 0])) as Record<string, number>;
  const owed = Object.fromEntries(group.members.map((member) => [member.id, 0])) as Record<string, number>;
  for (const expense of group.expenses) {
    paid[expense.payerId] = (paid[expense.payerId] || 0) + expense.amount;
    const allocations = expenseAllocations(expense, group);
    for (const member of group.members) owed[member.id] += allocations[member.id] || 0;
  }
  const balances = group.members.map((member) => ({
    member,
    paid: paid[member.id] || 0,
    owed: owed[member.id] || 0,
    net: (paid[member.id] || 0) - (owed[member.id] || 0),
  }));
  const creditors = balances.filter((entry) => entry.net > 0).map((entry) => ({ member: entry.member, remaining: entry.net }));
  const debtors = balances.filter((entry) => entry.net < 0).map((entry) => ({ member: entry.member, remaining: -entry.net }));
  creditors.sort((a, b) => b.remaining - a.remaining);
  debtors.sort((a, b) => b.remaining - a.remaining);
  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.remaining, debtor.remaining);
    if (amount > 0) settlements.push({ from: debtor.member, to: creditor.member, amount });
    creditor.remaining -= amount;
    debtor.remaining -= amount;
    if (creditor.remaining === 0) creditorIndex += 1;
    if (debtor.remaining === 0) debtorIndex += 1;
  }
  return { balances, settlements, total: group.expenses.reduce((sum, expense) => sum + expense.amount, 0) };
}
