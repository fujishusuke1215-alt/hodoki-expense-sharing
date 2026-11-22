import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Expense, Member } from "../lib/types";

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  members: text("members", { mode: "json" }).$type<Member[]>().notNull(),
  shares: text("shares", { mode: "json" })
    .$type<Record<string, number>>()
    .notNull(),
  expenses: text("expenses", { mode: "json" }).$type<Expense[]>().notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
