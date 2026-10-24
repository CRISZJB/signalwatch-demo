"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TaskDetail {
  id: string;
  name: string;
  status: string;
  naturalLanguage: string;
  cooldownMinutes: number;
  scheduleIntervalSec: number;
  currentVersion: number;
  degradedReason: string | null;
  lastRunAt: string | null;
  lastAlertAt: string | null;
  versions: Array<{ id: string; version: number; ruleJson: string; changeNote: string | null; createdAt: string }>;
  executions: Array<{
    id: string;
    outcome: string;
    triggered: boolean;
    explanation: string;
    skipReason: string | null;
    ruleVersion: number;
    createdAt: string;
    marketSnapshot: string | null;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    suppressed: boolean;
    suppressReason: string | null;
    fingerprint: string;
    createdAt: string;
  }>;
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [ruleJson, setRuleJson] = useState("");
  const [changeNote, setChangeNote] = useState("人工调整阈值");
  const [cooldown, setCooldown] = useState(30);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "加载失败");
      return;
    }
    setTask(data.task);
    const latest = data.task.versions?.[0];
    if (latest) setRuleJson(JSON.stringify(JSON.parse(latest.ruleJson), null, 2));
    setCooldown(data.task.cooldownMinutes);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRule() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const rule = JSON.parse(ruleJson);
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule, changeNote, cooldownMinutes: cooldown }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setMsg(`已保存，新版本 v${data.task.currentVersion}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function runNow(force = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "执行失败");
      setMsg(`执行完成：${data.log?.outcome}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "执行失败");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!task) return;
    const path = task.status === "PAUSED" ? "resume" : "pause";
    await fetch(`/api/tasks/${id}/${path}`, { method: "POST" });
    await load();
  }

  if (!task && !err) return <main className="sw-panel">加载中…</main>;
  if (!task) return <main className="sw-error">{err}</main>;

  return (
    <main className="sw-grid" style={{ gap: 16 }}>
      <div className="sw-panel">
        <div className="sw-row" style={{ justifyContent: "space-between" }}>
          <div>
            <Link href="/tasks" className="sw-muted" style={{ fontSize: "0.85rem" }}>
              ← 返回列表
            </Link>
            <h2 style={{ margin: "8px 0" }}>{task.name}</h2>
            <div className="sw-muted">{task.naturalLanguage}</div>
          </div>
          <div className="sw-row">
            <span className={`sw-status ${task.status === "ACTIVE" ? "active" : task.status === "PAUSED" ? "paused" : "degraded"}`}>
              {task.status}
            </span>
            <button className="sw-btn sw-btn-ghost" onClick={togglePause}>
              {task.status === "PAUSED" ? "恢复" : "暂停"}
            </button>
            <button className="sw-btn sw-btn-primary" disabled={busy} onClick={() => runNow(false)}>
              立即执行
            </button>
            <button className="sw-btn sw-btn-ghost" disabled={busy} onClick={() => runNow(true)}>
              强制执行(跳过冷却)
            </button>
          </div>
        </div>
        <div className="sw-row sw-muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
          <span>当前版本 v{task.currentVersion}</span>
          <span>冷却 {task.cooldownMinutes} 分钟</span>
          <span>间隔 {task.scheduleIntervalSec} 秒</span>
          <span>最近执行 {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString("zh-CN") : "—"}</span>
        </div>
        {task.degradedReason && <div className="sw-error" style={{ marginTop: 12 }}>降级原因：{task.degradedReason}</div>}
      </div>

      <div className="sw-panel">
        <h3 style={{ marginTop: 0 }}>编辑规则（保存将生成新版本）</h3>
        <div className="sw-row" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
              变更说明
            </label>
            <input className="sw-input" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
          </div>
          <div style={{ width: 160 }}>
            <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
              冷却分钟
            </label>
            <input className="sw-input" type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
          </div>
        </div>
        <textarea
          className="sw-textarea"
          style={{ minHeight: 220, fontFamily: "ui-monospace, monospace" }}
          value={ruleJson}
          onChange={(e) => setRuleJson(e.target.value)}
        />
        <div className="sw-row" style={{ marginTop: 12 }}>
          <button className="sw-btn sw-btn-primary" disabled={busy} onClick={saveRule}>
            保存并升版
          </button>
        </div>
        {msg && <div className="sw-ok" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="sw-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>

      <div className="sw-grid sw-grid-2">
        <div className="sw-panel">
          <h3 style={{ marginTop: 0 }}>规则版本历史</h3>
          {task.versions.map((v) => (
            <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>v{v.version}</strong>
              <span className="sw-muted"> · {new Date(v.createdAt).toLocaleString("zh-CN")}</span>
              <div className="sw-muted" style={{ fontSize: "0.85rem" }}>
                {v.changeNote}
              </div>
            </div>
          ))}
        </div>
        <div className="sw-panel">
          <h3 style={{ marginTop: 0 }}>预警记录</h3>
          {!task.alerts.length && <p className="sw-muted">暂无预警</p>}
          {task.alerts.map((a) => (
            <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                {a.title} {a.suppressed && <span className="sw-badge">已抑制</span>}
              </div>
              <div className="sw-muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
                {a.message.slice(0, 160)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sw-panel">
        <h3 style={{ marginTop: 0 }}>执行历史（可追溯）</h3>
        <table className="sw-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>版本</th>
              <th>结果</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {task.executions.map((e) => (
              <tr key={e.id}>
                <td className="sw-muted">{new Date(e.createdAt).toLocaleString("zh-CN")}</td>
                <td>v{e.ruleVersion}</td>
                <td>{e.outcome}</td>
                <td>
                  <div>{e.explanation}</div>
                  {e.skipReason && <div className="sw-muted">跳过原因：{e.skipReason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
