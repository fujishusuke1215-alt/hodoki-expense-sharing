import { getDb } from "../../../db";
import { groups } from "../../../db/schema";
import type { ExpenseGroup, Member } from "../../../lib/types";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validShareMap(value: unknown, members: Member[]) {
  if (!isRecord(value)) return false;
  const ids = members.map((member) => member.id);
  if (Object.keys(value).length !== ids.length || ids.some((id) => !(id in value))) {
    return false;
  }
  const values = Object.values(value);
  if (values.some((share) => typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100)) {
    return false;
  }
  return Math.abs(values.reduce<number>((sum, share) => sum + Number(share), 0) - 100) < 0.001;
}

function validateInitial(payload: unknown): Omit<ExpenseGroup, "id" | "version"> | null {
  if (!isRecord(payload)) return null;
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 80) : "";
  if (!title || !Array.isArray(payload.members) || payload.members.length < 2 || payload.members.length > 30) return null;

  const members: Member[] = [];
  for (const raw of payload.members) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
    const id = raw.id.trim();
    const name = raw.name.trim().slice(0, 40);
    if (!id || !name || members.some((member) => member.id === id)) return null;
    members.push({ id, name });
  }
  if (!validShareMap(payload.shares, members)) return null;
  return { title, members, shares: payload.shares as Record<string, number>, expenses: [], activities: [], repayments: [] };
}

export async function POST(request: Request) {
  try {
    const initial = validateInitial(await request.json());
    if (!initial) return Response.json({ error: "グループ名、メンバー、負担割合を確認してください。" }, { status: 400 });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getDb();
    const [row] = await db
      .insert(groups)
      .values({ id, ...initial, version: 1, createdAt: now, updatedAt: now })
      .returning();
    return Response.json({ group: row }, { status: 201 });
  } catch {
    return Response.json({ error: "グループを作成できませんでした。時間をおいて再度お試しください。" }, { status: 500 });
  }
}
