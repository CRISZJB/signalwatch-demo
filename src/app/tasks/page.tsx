"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface TaskRow {
  id: string;
  name: string;
  status: string;
  currentVersion: number;
  cooldownMinutes: number;
  scheduleIntervalSec: number;
  lastRunAt: string | null;
  lastAlertAt: string | null;
  degradedReason: string | null;
  naturalLanguage: string;
  _count: { alerts: number; executions: number };
  versions: Array<{ ruleJson: string }>;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setError("");
    } catch {
      setError("加载任务失败");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  async function act(id: string, path: string) {
    setBusyId(id);
    try {
      await fetch(`/api/tasks/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await load();
    } finally {
      setBusyId("");
    }
  }

  function statusClass(s: string) {
    if (s === "ACTIVE") return "active";
    if (s === "PAUSED") return "paused";
    return "degraded";
  }

  return (
    <main className="sw-panel">
      <div className="sw-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>监控任务</h2>
        <Link className="sw-btn sw-btn-primary" href="/create">
          新建任务
        </Link>
      </div>
      {error && <div className="sw-error">{error}</div>}
      {!tasks.length && !error && <p className="sw-muted">暂无任务，请先创建。</p>}
      <div style={{ overflowX: "auto" }}>
        <table className="sw-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>版本</th>
              <th>执行/预警</th>
              <th>最近执行</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/tasks/${t.id}`} style={{ color: "var(--accent-2)" }}>
                    {t.name}
                  </Link>
                  <div className="sw-muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                    {t.naturalLanguage.slice(0, 40)}
                  </div>
                </td>
                <td>
                  <span className={`sw-status ${statusClass(t.status)}`}>{t.status}</span>
                  {t.degradedReason && (
                    <div className="sw-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                      {t.degradedReason}
                    </div>
                  )}
                </td>
                <td>v{t.currentVersion}</td>
                <td>
                  {t._count.executions} / {t._count.alerts}
                </td>
                <td className="sw-muted">
                  {t.lastRunAt ? new Date(t.lastRunAt).toLocaleString("zh-CN") : "尚未执行"}
                </td>
                <td>
                  <div className="sw-row">
                    {t.status === "PAUSED" ? (
                      <button className="sw-btn sw-btn-ghost" disabled={busyId === t.id} onClick={() => act(t.id, "resume")}>
                        恢复
                      </button>
                    ) : (
                      <button className="sw-btn sw-btn-ghost" disabled={busyId === t.id} onClick={() => act(t.id, "pause")}>
                        暂停
                      </button>
                    )}
                    <button className="sw-btn sw-btn-primary" disabled={busyId === t.id} onClick={() => act(t.id, "run")}>
                      立即执行
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
