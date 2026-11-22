import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { groups } from "../../../../db/schema";
import type { Activity, Expense, ExpenseGroup, Member, Repayment } from "../../../../lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validShareMap(value: unknown, members: Member[]) {
  if (!isRecord(value)) return false;
  const ids = members.map((member) => member.id);
  if (Object.keys(value).length !== ids.length || ids.some((id) => !(id in value))) return false;
  const shares = Object.values(value);
  if (shares.some((share) => typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100)) return false;
  return Math.abs(shares.reduce<number>((sum, share) => sum + Number(share), 0) - 100) < 0.001;
}

function validateGroup(payload: unknown): Omit<ExpenseGroup, "id" | "version"> | null {
  if (!isRecord(payload)) return null;
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 80) : "";
  if (!title || !Array.isArray(payload.members) || payload.members.length < 2 || payload.members.length > 30) return null;
  if (!Array.isArray(payload.expenses) || payload.expenses.length > 500) return null;

  const members: Member[] = [];
  for (const raw of payload.members) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
    const id = raw.id.trim();
    const name = raw.name.trim().slice(0, 40);
    if (!id || !name || members.some((member) => member.id === id)) return null;
    members.push({ id, name });
  }
  if (!validShareMap(payload.shares, members)) return null;

  const rawActivities = payload.activities ?? [];
  if (!Array.isArray(rawActivities) || rawActivities.length > 200) return null;
  const activities: Activity[] = [];
  for (const raw of rawActivities) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.date !== "string") return null;
    const id = raw.id.trim();
    const activityTitle = raw.title.trim().slice(0, 80);
    if (!id || !activityTitle || activities.some((activity) => activity.id === id) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
    activities.push({ id, title: activityTitle, date: raw.date });
  }

  const expenses: Expense[] = [];
  for (const raw of payload.expenses) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.payerId !== "string" || typeof raw.date !== "string") return null;
    const id = raw.id.trim();
    const title = raw.title.trim().slice(0, 80);
    const amount = Number(raw.amount);
    if (!id || !title || !Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) return null;
    if (!members.some((member) => member.id === raw.payerId) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
    if (raw.shares !== null && !validShareMap(raw.shares, members)) return null;
    const eventId = raw.eventId == null ? null : typeof raw.eventId === "string" ? raw.eventId : undefined;
    if (eventId === undefined || (eventId !== null && !activities.some((activity) => activity.id === eventId))) return null;
    expenses.push({
      id,
      title,
      amount,
      payerId: raw.payerId,
      date: raw.date,
      shares: raw.shares as Record<string, number> | null,
      eventId,
    });
  }

  const rawRepayments = payload.repayments ?? [];
  if (!Array.isArray(rawRepayments) || rawRepayments.length > 10000) return null;
  const repayments: Repayment[] = [];
  for (const raw of rawRepayments) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.fromId !== "string" || typeof raw.toId !== "string" || typeof raw.date !== "string") return null;
    const id = raw.id.trim();
    const fromId = raw.fromId.trim();
    const toId = raw.toId.trim();
    const amount = Number(raw.amount);
    const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 120) : "";
    if (!id || !fromId || !toId || fromId === toId || repayments.some((repayment) => repayment.id === id)) return null;
    if (!members.some((member) => member.id === fromId) || !members.some((member) => member.id === toId)) return null;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
    repayments.push({ id, fromId, toId, amount, date: raw.date, note });
  }

  return { title, members, shares: payload.shares as Record<string, number>, expenses, activities, repayments };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const [group] = await getDb().select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) return Response.json({ error: "このグループは見つかりませんでした。" }, { status: 404 });
  return Response.json({ group: { ...group, activities: group.activities ?? [], repayments: group.repayments ?? [] } });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || !Number.isSafeInteger(body.version) || Number(body.version) < 1) {
    return Response.json({ error: "保存内容を確認してください。" }, { status: 400 });
  }
  const next = validateGroup(body.group);
  if (!next) return Response.json({ error: "グループの内容を確認してください。" }, { status: 400 });

  const db = getDb();
  const now = new Date().toISOString();
  const [saved] = await db
    .update(groups)
    .set({ ...next, version: sql`${groups.version} + 1`, updatedAt: now })
    .where(and(eq(groups.id, id), eq(groups.version, Number(body.version))))
    .returning();
  if (saved) return Response.json({ group: saved });

  const [latest] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!latest) return Response.json({ error: "このグループは見つかりませんでした。" }, { status: 404 });
  return Response.json({ error: "別の人が先に更新しました。最新の内容を読み直してください。", group: latest }, { status: 409 });
}
