"use client";

import { ArrowRight, Check, ChevronRight, FolderPlus, Link2, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { equalShares } from "../lib/splits";
import type { ExpenseGroup, Member } from "../lib/types";

type RecentGroup = { id: string; title: string; updatedAt: string | undefined };

function remember(group: Pick<ExpenseGroup, "id" | "title" | "updatedAt">) {
  try {
    const previous = JSON.parse(localStorage.getItem("hodoki.recent") || "[]") as RecentGroup[];
    const next = [{ id: group.id, title: group.title, updatedAt: group.updatedAt }, ...previous.filter((item) => item.id !== group.id)].slice(0, 8);
    localStorage.setItem("hodoki.recent", JSON.stringify(next));
  } catch {
    // Recent links are a convenience; the shared group remains on the server.
  }
}

function Logo() {
  return <a className="brand" href="/" aria-label="Hodoki ホーム"><span className="brand-mark">h</span><span>hodoki<span className="brand-period">.</span></span></a>;
}

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [memberNames, setMemberNames] = useState("");
  const [recent, setRecent] = useState<RecentGroup[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hodoki.recent") || "[]") as RecentGroup[];
      if (!Array.isArray(saved)) return;
      setLoadingRecent(true);
      Promise.all(saved.slice(0, 6).map(async (item) => {
        try {
          const response = await fetch(`/api/groups/${encodeURIComponent(item.id)}`);
          if (!response.ok) return null;
          const data = await response.json() as { group: ExpenseGroup };
          return { id: data.group.id, title: data.group.title, updatedAt: data.group.updatedAt };
        } catch {
          return null;
        }
      })).then((rows) => setRecent(rows.filter((item): item is RecentGroup => item !== null))).finally(() => setLoadingRecent(false));
    } catch {
      setRecent([]);
    }
  }, []);

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const names = memberNames.split(/[\n,、]/).map((name) => name.trim()).filter(Boolean);
    if (title.trim().length < 1) return setError("グループ名を入力してください。");
    if (names.length < 2) return setError("メンバーを2人以上入力してください。");
    if (names.length > 30) return setError("メンバーは30人まで登録できます。");

    setCreating(true);
    try {
      const members: Member[] = names.map((name) => ({ id: crypto.randomUUID(), name }));
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), members, shares: equalShares(members.map((member) => member.id)) }),
      });
      const data = await response.json() as { group?: ExpenseGroup; error?: string };
      if (!response.ok || !data.group) throw new Error(data.error || "グループを作成できませんでした。");
      remember(data.group);
      window.location.href = `/g/${data.group.id}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通信に失敗しました。もう一度お試しください。");
      setCreating(false);
    }
  }

  async function copyHomeLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("リンクをコピーできませんでした。ブラウザーの共有メニューをお試しください。");
    }
  }

  return (
    <main className="home-shell">
      <header className="site-header home-header">
        <Logo />
        <div className="header-actions">
          <span className="header-note"><span className="live-dot" />共有会計ノート</span>
          <button className="icon-button" type="button" onClick={copyHomeLink} aria-label="アプリのリンクをコピー">{copied ? <Check size={18} /> : <Link2 size={18} />}</button>
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> いつもの割り勘に、ちょうどいい柔軟さを</div>
          <h1>それぞれの負担に、<br /><span>ちょうどいい割合。</span></h1>
          <p className="hero-lead">グループ全体の負担率も、ひとつの明細だけの割合も。あとから見ても納得できる会計を、みんなで共有。</p>
          <div className="feature-pills">
            <span><i>01</i> 全体の割合を設定</span>
            <span><i>02</i> 明細ごとに上書き</span>
            <span><i>03</i> 精算額を自動計算</span>
          </div>
          <div className="hero-note"><span className="note-icon"><Users size={16} /></span><span>アカウント登録なし。グループのリンクを共有すれば、メンバーも一緒に編集できます。</span></div>
        </div>

        <section className="create-card" aria-labelledby="create-title">
          <div className="card-kicker">START A NEW GROUP <span>01 / 01</span></div>
          <div className="create-heading"><div className="create-icon"><FolderPlus size={21} /></div><div><h2 id="create-title">新しい会計をつくる</h2><p>まずは名前とメンバーから</p></div></div>
          <form onSubmit={createGroup} className="create-form">
            <label className="field-label" htmlFor="group-title">グループ名</label>
            <input id="group-title" className="text-field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="例：週末の温泉旅行" required />
            <div className="field-label-row"><label className="field-label" htmlFor="members">メンバー</label><span>改行またはカンマで区切る</span></div>
            <textarea id="members" className="text-field member-area" value={memberNames} onChange={(event) => setMemberNames(event.target.value)} placeholder={'例：\nあき\nりょう\nみな'} rows={4} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary create-submit" type="submit" disabled={creating}>{creating ? <span className="spinner" /> : <>グループを作成 <ArrowRight size={17} /></>}</button>
            <p className="form-hint">作成後、リンクを共有すると全員が同じ内容を見られます。</p>
          </form>
        </section>
      </section>

      <section className="recent-section">
        <div className="section-title-row"><div><div className="eyebrow muted-eyebrow">YOUR RECENT GROUPS</div><h2>最近開いたグループ</h2></div><span className="recent-count">{recent.length.toString().padStart(2, "0")}</span></div>
        {loadingRecent ? <div className="recent-empty">グループを読み込んでいます…</div> : recent.length ? <div className="recent-grid">{recent.map((group, index) => <a className="recent-card" href={`/g/${group.id}`} key={group.id}><span className="recent-index">{String(index + 1).padStart(2, "0")}</span><span className="recent-card-main"><strong>{group.title}</strong><small>{group.updatedAt ? `更新 ${new Date(group.updatedAt).toLocaleDateString("ja-JP")}` : "共有グループ"}</small></span><ChevronRight size={18} /></a>)}</div> : <div className="recent-empty"><span className="recent-empty-mark">+</span><span>作成したグループは、次回ここから開けます。</span></div>}
      </section>

      <footer className="site-footer"><span>hodoki<span className="brand-period">.</span> <small>会計を、気持ちよく。</small></span><span>共有リンクを知っている人は、グループの内容を閲覧・編集できます。</span></footer>
    </main>
  );
}
