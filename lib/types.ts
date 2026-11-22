export type Member = {
  id: string;
  name: string;
};

export type Activity = {
  id: string;
  title: string;
  date: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  payerId: string;
  date: string;
  /** null uses the group's default percentages; a map overrides them for this expense. */
  shares: Record<string, number> | null;
  /** Optional outing/activity this expense belongs to. */
  eventId?: string | null;
};

export type Repayment = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  note: string;
};

export type ExpenseGroup = {
  id: string;
  title: string;
  members: Member[];
  shares: Record<string, number>;
  expenses: Expense[];
  activities: Activity[];
  repayments: Repayment[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Settlement = {
  from: Member;
  to: Member;
  amount: number;
};
