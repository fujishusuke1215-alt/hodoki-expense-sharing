"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Copy, Edit2, Link2, Plus, ReceiptText, RotateCcw, Share2, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calculateLedger, equalShares, expenseAllocations, formatYen, normalizeShares } from "../lib/splits";
import type { Expense, ExpenseGroup, Member } from "../lib/types";

const COLORS = ["#9c4e32", "#466a52", "#73649a", "#b87927", "#357787", "#a04b69", "#55724b", "#4d658f"];
const PERCENT_TOLERANCE = 0.001;

function remember(group: Pick<ExpenseGroup, "id" | "title" | "updatedAt">) {
  try {
    const previous = JSON.parse(localStorage.getItem("hodoki.recent") || "[]") as Array<{ id: string }>;
    const next = [{ id: group.id, title: group.title, updatedAt: group.updatedAt }, ...previous.filter((item) => item.id !== group.id)].slice(0, 8);
    localStorage.setItem("hodoki.recent", JSON.stringify(next));
  } catch {
    // The shared group stays on the server if local recent links are unavailable.
  }
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(date);
}

function percentLabel(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

function Logo() {
  return <a className="brand" href="/" aria-label="Hodoki ホーム"><span className="brand-mark">h</span><span>hodoki<span className="brand-period">.</span></span></a>;
}

type ExpenseModalProps = {
  members: Member[];
  globalShares: Record<string, number>;
  initial?: Expense;
  onClose: () => void;
  onSave: (expense: Expense) => Promise<void>;
};

function ExpenseModal({ members, globalShares, initial, onClose, onSave }: ExpenseModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [payerId, setPayerId] = useState(initial?.payerId ?? members[0]?.id ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [mode, setMode] = useState<"group" | "custom">(initial?.shares ? "custom" : "group");
  const [shareDraft, setShareDraft] = useState<Record<string, string>>(() => Object.fromEntries(members.map((member) => [member.id, String(initial?.shares?.[member.id] ?? globalShares[member.id] ?? 0)])));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const parsedShares = Object.fromEntries(members.map((member) => [member.id, Number(shareDraft[member.id] || 0)]));
  const shareTotal = members.reduce((sum, member) => sum + (Number.isFinite(parsedShares[member.id]) ? parsedShares[member.id] : 0), 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wholeAmount = Number(amount);
    if (!title.trim()) return setError("明細名を入力してください。");
    if (!Number.isSafeInteger(wholeAmount) || wholeAmount < 1) return setError("金額は1円以上の整数で入力してください。");
    if (mode === "custom" && (parsedShares && Object.values(parsedShares).some((value) => !Number.isFinite(value) || value < 0 || value > 100) || Math.abs(shareTotal - 100) >= PERCENT_TOLERANCE)) {
      return setError("明細の負担割合の合計を100%にしてください。");
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        title: title.trim(),
        amount: wholeAmount,
        payerId,
        date,
        shares: mode === "custom" ? parsedShares : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
      <header className="modal-header"><div><span className="modal-kicker">EXPENSE DETAIL</span><h2 id="expense-modal-title">{initial ? "明細を編集" : "立替を追加"}</h2></div><button className="icon-button" type="button" aria-label="閉じる" onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit} className="modal-form">
        <div className="form-grid two-col">
          <label className="form-control span-two"><span>明細名</span><input autoFocus className="text-field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="例：夕食、レンタカー" /></label>
          <label className="form-control"><span>金額</span><div className="currency-input"><span>¥</span><input className="text-field" inputMode="numeric" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div></label>
          <label className="form-control"><span>立て替えた人</span><div className="select-wrap"><select className="text-field" value={payerId} onChange={(event) => setPayerId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><ChevronDown size={16} /></div></label>
          <label className="form-control span-two"><span>日付</span><input className="text-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <div className="form-control"><span>この明細の分け方</span><div className="split-mode" role="group" aria-label="明細の分け方"><button type="button" className={mode === "group" ? "active" : ""} onClick={() => setMode("group")}><span>グループの割合</span><small>全体設定を使う</small></button><button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}><span>この明細だけ</span><small>個別に割合を指定</small></button></div></div>
        {mode === "custom" ? <div className="custom-share-list"><div className="custom-share-heading"><span>メンバーごとの負担</span><span className={Math.abs(shareTotal - 100) < PERCENT_TOLERANCE ? "sum-good" : "sum-warn"}>合計 {percentLabel(shareTotal)}</span></div>{members.map((member, index) => <label className="custom-share-row" key={member.id}><span className="member-dot" style={{ "--member-color": COLORS[index % COLORS.length] } as React.CSSProperties} /><span>{member.name}</span><div className="percent-field"><input inputMode="decimal" type="number" min="0" max="100" step="0.01" aria-label={`${member.name}の負担割合`} value={shareDraft[member.id] ?? "0"} onChange={(event) => setShareDraft((current) => ({ ...current, [member.id]: event.target.value }))} /><span>%</span></div></label>)}</div> : <p className="mode-hint">全体の負担率を使います。あとから全体設定を調整しても、この明細に反映されます。</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>キャンセル</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? <span className="spinner" /> : initial ? "変更を保存" : "明細を追加"}</button></div>
      </form>
    </section>
  </div>;
}

export default function GroupExperience({ id }: { id: string }) {
  const [group, setGroup] = useState<ExpenseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareDraft, setShareDraft] = useState<Record<string, string>>({});
  const [memberName, setMemberName] = useState("");
  const [modalExpense, setModalExpense] = useState<Expense | null | "new">(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/groups/${encodeURIComponent(id)}`).then(async (response) => {
      const data = await response.json() as { group?: ExpenseGroup; error?: string };
      if (!response.ok || !data.group) throw new Error(data.error || "グループを開けませんでした。");
      if (!active) return;
      setGroup(data.group);
      setShareDraft(Object.fromEntries(data.group.members.map((member) => [member.id, String(data.group?.shares[member.id] ?? 0)])));
      remember(data.group);
    }).catch((cause) => {
      if (active) setFatal(cause instanceof Error ? cause.message : "通信に失敗しました。");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const ledger = useMemo(() => group ? calculateLedger(group) : null, [group]);
  const draftTotal = group?.members.reduce((sum, member) => sum + (Number(shareDraft[member.id]) || 0), 0) ?? 0;

  async function saveGroup(next: ExpenseGroup) {
    if (!group) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: group.version, group: { title: next.title, members: next.members, shares: next.shares, expenses: next.expenses } }),
      });
      const data = await response.json() as { group?: ExpenseGroup; error?: string };
      if (!response.ok || !data.group) {
        if (response.status === 409 && data.group) setGroup(data.group);
        throw new Error(data.error || "変更を保存できませんでした。");
      }
      setGroup(data.group);
      setShareDraft(Object.fromEntries(data.group.members.map((member) => [member.id, String(data.group?.shares[member.id] ?? 0)])));
      remember(data.group);
      setNotice("変更を保存しました");
      return data.group;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "通信に失敗しました。";
      setNotice(message);
      throw cause instanceof Error ? cause : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveExpense(expense: Expense) {
    if (!group) return;
    const exists = group.expenses.some((item) => item.id === expense.id);
    const expenses = exists ? group.expenses.map((item) => item.id === expense.id ? expense : item) : [...group.expenses, expense];
    const saved = await saveGroup({ ...group, expenses });
    if (saved) setModalExpense(null);
  }

  async function deleteExpense(expense: Expense) {
    if (!group || !window.confirm(`「${expense.title}」を削除しますか？`)) return;
    await saveGroup({ ...group, expenses: group.expenses.filter((item) => item.id !== expense.id) });
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group || !memberName.trim()) return;
    if (group.members.length >= 30) return setNotice("メンバーは30人まで登録できます。");
    const member = { id: crypto.randomUUID(), name: memberName.trim().slice(0, 40) };
    const members = [...group.members, member];
    const scale = (members.length - 1) / members.length;
    const shares = normalizeShares({ ...group.shares, [member.id]: 100 / members.length, ...Object.fromEntries(group.members.map((person) => [person.id, group.shares[person.id] * scale])) }, members);
    const expenses = group.expenses.map((expense) => expense.shares ? { ...expense, shares: { ...expense.shares, [member.id]: 0 } } : expense);
    await saveGroup({ ...group, members, shares, expenses });
    setMemberName("");
  }

  async function removeMember(member: Member) {
    if (!group) return;
    if (group.members.length <= 2) return setNotice("グループには2人以上のメンバーが必要です。");
    if (group.expenses.some((expense) => expense.payerId === member.id)) return setNotice("このメンバーが立て替えた明細を先に編集してください。");
    if (!window.confirm(`${member.name}さんをグループから外しますか？`)) return;
    const members = group.members.filter((person) => person.id !== member.id);
    const shares = normalizeShares(group.shares, members);
    const expenses = group.expenses.map((expense) => {
      if (!expense.shares) return expense;
      const nextShares = { ...expense.shares };
      delete nextShares[member.id];
      return { ...expense, shares: normalizeShares(nextShares, members) };
    });
    await saveGroup({ ...group, members, shares, expenses });
  }

  async function saveGlobalShares() {
    if (!group) return;
    const shares = Object.fromEntries(group.members.map((member) => [member.id, Number(shareDraft[member.id]) || 0]));
    if (Math.abs(draftTotal - 100) >= PERCENT_TOLERANCE || Object.values(shares).some((value) => value < 0 || value > 100)) {
      setNotice("全体の負担割合の合計を100%にしてください。");
      return;
    }
    await saveGroup({ ...group, shares });
  }

  async function distributeEvenly() {
    if (!group) return;
    const shares = equalShares(group.members.map((member) => member.id));
    await saveGroup({ ...group, shares });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setNotice("リンクをコピーできませんでした。アドレスバーからコピーしてください。");
    }
  }

  async function copySettlement() {
    if (!group || !ledger) return;
    const summary = ledger.settlements.length
      ? `${group.title}｜精算メモ\n${ledger.settlements.map((item) => `${item.from.name} → ${item.to.name}　${formatYen(item.amount)}`).join("\n")}`
      : `${group.title}｜精算は完了しています。`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      setNotice("精算メモをコピーできませんでした。");
    }
  }

  if (loading) return <main className="loading-screen"><span className="spinner large" /><span>会計をひらいています…</span></main>;
  if (fatal || !group || !ledger) return <main className="not-found"><Logo /><div className="not-found-icon"><CircleHelp size={28} /></div><h1>このグループを開けませんでした</h1><p>{fatal || "グループが見つかりませんでした。URLを確認してください。"}</p><a className="button button-primary" href="/">ホームへ戻る <ArrowRight size={17} /></a></main>;

  const paidTotal = ledger.total;
  const sortedExpenses = [...group.expenses].sort((a, b) => b.date.localeCompare(a.date));

  return <main className="group-shell">
    <header className="site-header group-header"><Logo /><div className="header-actions"><a className="back-link" href="/"><ArrowLeft size={16} />グループ一覧</a><button className="button button-share" onClick={copyLink} type="button">{copiedLink ? <Check size={16} /> : <Share2 size={16} />}{copiedLink ? "コピーしました" : "リンクを共有"}</button></div></header>
    <div className="group-breadcrumb"><span>共有グループ</span><span className="breadcrumb-slash">/</span><span>{group.members.length}人</span><span className="saved-state"><span className={busy ? "save-dot saving" : "save-dot"} />{busy ? "保存中" : "共有中"}</span></div>

    <section className="group-title-row"><div><div className="group-overline">GROUP ACCOUNT <span>#{group.id.slice(0, 6).toUpperCase()}</span></div><h1>{group.title}</h1><p>メンバーでひとつの会計を共有しています。</p></div><button className="button button-primary add-expense-top" onClick={() => setModalExpense("new")} type="button"><Plus size={17} />立替を追加</button></section>

    <section className="summary-grid" aria-label="グループの概要"><div className="summary-card total-summary"><span className="summary-label">立替の合計</span><strong>{formatYen(paidTotal)}</strong><span className="summary-foot"><ReceiptText size={15} />{group.expenses.length}件の明細</span></div><div className="summary-card"><span className="summary-label">メンバー</span><strong>{group.members.length}<small>人</small></strong><span className="summary-foot"><Users size={15} />リンクから一緒に編集</span></div><div className="summary-card"><span className="summary-label">ひとりあたりの目安</span><strong>{formatYen(Math.round(paidTotal / group.members.length))}</strong><span className="summary-foot"><CircleHelp size={15} />実際の負担は設定割合で計算</span></div></section>

    <div className="group-layout">
      <section className="expenses-panel panel-card">
        <div className="panel-heading expense-heading"><div><div className="panel-kicker">THE LEDGER</div><h2>立替の明細 <span className="count-pill">{group.expenses.length}</span></h2></div><button className="button button-quiet compact-add" onClick={() => setModalExpense("new")} type="button"><Plus size={16} />明細を追加</button></div>
        {sortedExpenses.length ? <div className="expense-list">{sortedExpenses.map((expense) => {
          const payer = group.members.find((member) => member.id === expense.payerId);
          const allocation = expenseAllocations(expense, group);
          const shares = expense.shares ?? group.shares;
          return <article className="expense-row" key={expense.id}>
            <div className="expense-date"><span>{dateLabel(expense.date)}</span><span className="expense-date-line" /></div>
            <div className="expense-main"><div className="expense-title-line"><strong>{expense.title}</strong><span className={`expense-mode-tag ${expense.shares ? "custom-tag" : ""}`}>{expense.shares ? "明細ごと" : "全体割合"}</span></div><p><span className="member-dot" style={{ "--member-color": COLORS[Math.max(group.members.findIndex((member) => member.id === expense.payerId), 0) % COLORS.length] } as React.CSSProperties} />{payer?.name ?? "不明"}が立替</p><div className="expense-split-note">{group.members.map((member) => `${member.name} ${percentLabel(shares[member.id] ?? 0)}`).join(" · ")}</div><div className="expense-amount-breakdown">{group.members.filter((member) => (allocation[member.id] ?? 0) > 0).map((member) => <span key={member.id}>{member.name} {formatYen(allocation[member.id])}</span>)}</div></div>
            <div className="expense-total"><strong>{formatYen(expense.amount)}</strong><div className="expense-actions"><button className="icon-button small" type="button" onClick={() => setModalExpense(expense)} aria-label={`${expense.title}を編集`} title="編集"><Edit2 size={15} /></button><button className="icon-button small danger-icon" type="button" onClick={() => deleteExpense(expense)} aria-label={`${expense.title}を削除`} title="削除" disabled={busy}><Trash2 size={15} /></button></div></div>
          </article>;
        })}</div> : <div className="empty-ledger"><div className="empty-ledger-art"><ReceiptText size={24} /></div><h3>まだ明細がありません</h3><p>立て替えた金額を追加すると、割合に合わせた精算を計算します。</p><button className="button button-primary" onClick={() => setModalExpense("new")} type="button"><Plus size={17} />最初の明細を追加</button></div>}
        <div className="ledger-footnote"><CircleHelp size={14} /><span>全体割合の明細は、全体設定を変えると負担額も更新されます。</span></div>
      </section>

      <aside className="right-rail">
        <section className="panel-card share-panel">
          <div className="panel-heading compact-heading"><div><div className="panel-kicker">DEFAULT SPLIT</div><h2>全体の負担率</h2></div><span className="info-badge" title="個別設定がある明細を除き、すべての明細に適用されます。">i</span></div>
          <p className="panel-description">グループ全体の支出を、どんな割合で負担するか決めます。</p>
          <div className="share-meter" role="img" aria-label="メンバーごとの負担割合"><div className="share-meter-track">{group.members.map((member, index) => <span key={member.id} style={{ width: `${Math.max(group.shares[member.id] ?? 0, 0)}%`, backgroundColor: COLORS[index % COLORS.length] }} />)}</div></div>
          <div className="global-share-list">{group.members.map((member, index) => <label className="global-share-row" key={member.id}><span className="member-dot" style={{ "--member-color": COLORS[index % COLORS.length] } as React.CSSProperties} /><span className="global-share-name">{member.name}</span><div className="percent-field global-percent"><input aria-label={`${member.name}の全体負担率`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={shareDraft[member.id] ?? String(group.shares[member.id] ?? 0)} onChange={(event) => setShareDraft((current) => ({ ...current, [member.id]: event.target.value }))} /><span>%</span></div></label>)}</div>
          <div className="share-total-row"><span>合計</span><strong className={Math.abs(draftTotal - 100) < PERCENT_TOLERANCE ? "sum-good" : "sum-warn"}>{percentLabel(draftTotal)}</strong></div>
          <div className="share-actions"><button className="button button-quiet" onClick={distributeEvenly} disabled={busy} type="button"><RotateCcw size={14} />均等に戻す</button><button className="button button-dark" onClick={saveGlobalShares} disabled={busy || Math.abs(draftTotal - 100) >= PERCENT_TOLERANCE} type="button">割合を保存</button></div>
          <p className="share-hint">各明細の割合を指定すると、その明細だけこちらの設定を上書きします。</p>
        </section>

        <section className="panel-card people-panel">
          <div className="panel-heading compact-heading"><div><div className="panel-kicker">THE PEOPLE</div><h2>メンバー <span className="count-pill">{group.members.length}</span></h2></div></div>
          <div className="people-list">{ledger.balances.map(({ member, paid, owed, net }) => {
            const index = group.members.findIndex((person) => person.id === member.id);
            const canRemove = group.members.length > 2 && !group.expenses.some((expense) => expense.payerId === member.id);
            return <div className="person-row" key={member.id}><span className="person-avatar" style={{ "--member-color": COLORS[index % COLORS.length] } as React.CSSProperties}>{member.name.slice(0, 1)}</span><div className="person-details"><strong>{member.name}</strong><small>立替 {formatYen(paid)} · 負担 {formatYen(owed)}</small></div><span className={`person-balance ${net > 0 ? "positive" : net < 0 ? "negative" : "neutral"}`}>{net > 0 ? "+" : net < 0 ? "−" : ""}{formatYen(Math.abs(net))}</span><button type="button" className="icon-button small member-remove" disabled={!canRemove || busy} title={canRemove ? `${member.name}を外す` : "立替明細の編集後に外せます"} aria-label={`${member.name}を外す`} onClick={() => removeMember(member)}><X size={14} /></button></div>;
          })}</div>
          <form className="add-member-form" onSubmit={addMember}><input className="text-field" aria-label="追加するメンバー名" maxLength={40} value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="名前を追加" disabled={busy || group.members.length >= 30} /><button className="button button-outline" type="submit" disabled={busy || !memberName.trim() || group.members.length >= 30}><Plus size={16} />追加</button></form>
        </section>

        <section className="panel-card settlement-panel">
          <div className="panel-heading compact-heading"><div><div className="panel-kicker">SETTLEMENT</div><h2>精算のまとめ</h2></div><button className="icon-button small" onClick={copySettlement} type="button" aria-label="精算内容をコピー" title="精算内容をコピー">{copiedSummary ? <Check size={16} /> : <Copy size={16} />}</button></div>
          {ledger.settlements.length ? <div className="settlement-list">{ledger.settlements.map((settlement, index) => <div className="settlement-row" key={`${settlement.from.id}-${settlement.to.id}-${index}`}><div className="settlement-people"><span>{settlement.from.name}</span><ArrowRight size={15} /><span>{settlement.to.name}</span></div><strong>{formatYen(settlement.amount)}</strong></div>)}</div> : <div className="settled-state"><span className="settled-check"><Check size={16} /></span><div><strong>いまのところ精算は不要です</strong><small>全員の支払額と負担額が一致しています。</small></div></div>}
          <div className="settlement-caption"><span className="save-dot" />立替合計と負担額から精算の送金先と金額を計算</div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
        </section>
      </aside>
    </div>
    <footer className="site-footer group-footer"><span>hodoki<span className="brand-period">.</span> <small>会計を、気持ちよく。</small></span><span><Link2 size={13} /> このリンクを知っている人はグループを閲覧・編集できます。</span></footer>
    {modalExpense && <ExpenseModal members={group.members} globalShares={group.shares} initial={modalExpense === "new" ? undefined : modalExpense} onClose={() => setModalExpense(null)} onSave={saveExpense} />}
  </main>;
}
