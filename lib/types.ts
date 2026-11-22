export type Member = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  payerId: string;
  date: string;
  /** null uses the group's default percentages; a map overrides them for this expense. */
  shares: Record<string, number> | null;
};

export type ExpenseGroup = {
  id: string;
  title: string;
  members: Member[];
  shares: Record<string, number>;
  expenses: Expense[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Settlement = {
  from: Member;
  to: Member;
  amount: number;
};
