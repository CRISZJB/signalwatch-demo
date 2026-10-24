"use client";

import { useCallback, useEffect, useState } from "react";

interface AlertRow {
  id: string;
  title: string;
  message: string;
  severity: string;
  suppressed: boolean;
  suppressReason: string | null;
  fingerprint: string;
  createdAt: string;
  task: { id: string; name: string };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [showSuppressed, setShowSuppressed] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/alerts?suppressed=${showSuppressed ? "1" : "0"}`);
    const data = await res.json();
    setAlerts(data.alerts ?? []);
  }, [showSuppressed]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <main className="sw-panel">
      <div className="sw-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>预警中心</h2>
        <label className="sw-row sw-muted" style={{ fontSize: "0.9rem" }}>
          <input type="checkbox" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} />
          显示去重/冷却抑制记录
        </label>
      </div>
      {!alerts.length && <p className="sw-muted">暂无预警。创建任务并调整模拟行情阈值后可触发。</p>}
      <table className="sw-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>任务</th>
            <th>标题</th>
            <th>状态</th>
            <th>指纹</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className="sw-muted">{new Date(a.createdAt).toLocaleString("zh-CN")}</td>
              <td>{a.task.name}</td>
              <td>
                <div>{a.title}</div>
                <div className="sw-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  {a.message.slice(0, 120)}
                </div>
              </td>
              <td>
                {a.suppressed ? (
                  <span className="sw-badge">{a.suppressReason || "已抑制"}</span>
                ) : (
                  <span className="sw-status active">有效</span>
                )}
              </td>
              <td className="sw-muted" style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                {a.fingerprint}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
