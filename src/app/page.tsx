"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Stats {
  taskCount: number;
  activeCount: number;
  pausedCount: number;
  degradedCount: number;
  alertCount: number;
  execCount: number;
  dataDisclaimer: string;
  recentAlerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    suppressed: boolean;
    createdAt: string;
    task: { name: string };
  }>;
  recentExecs: Array<{
    id: string;
    outcome: string;
    explanation: string;
    createdAt: string;
    task: { name: string };
  }>;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [ticking, setTicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("加载统计失败");
      setStats(await res.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  async function runTick() {
    setTicking(true);
    try {
      await fetch("/api/scheduler/tick", { method: "POST" });
      await load();
    } finally {
      setTicking(false);
    }
  }

  return (
    <main>
      <section className="sw-hero">
        <div className="sw-panel">
          <h2>把自然语言关注点，变成可长期运行的监控任务</h2>
          <p style={{ marginTop: 12 }}>
            SignalWatch 将「贵州茅台跌破 1700 元提醒我」解析为可检查、可修改的结构化规则，
            并在调度中真实执行规则引擎——触发有解释，未触发也有原因；支持去重、冷却、暂停恢复与规则版本追溯。
          </p>
          <div className="sw-row" style={{ marginTop: 18 }}>
            <Link className="sw-btn sw-btn-primary" href="/create">
              创建监控任务
            </Link>
            <button className="sw-btn sw-btn-ghost" onClick={runTick} disabled={ticking}>
              {ticking ? "调度中…" : "立即调度一轮"}
            </button>
            <Link className="sw-btn sw-btn-ghost" href="/tasks">
              查看任务
            </Link>
          </div>
        </div>
        <div className="sw-panel">
          <div className="sw-badge" style={{ marginBottom: 12 }}>
            可追溯声明
          </div>
          <p className="sw-muted" style={{ lineHeight: 1.7, margin: 0, fontSize: "0.9rem" }}>
            {stats?.dataDisclaimer ??
              "当前行情为 SIMULATED 模拟数据。页面数字均来自数据库真实统计与规则引擎执行结果。"}
          </p>
        </div>
      </section>

      {error && <div className="sw-error" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="sw-grid sw-grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "监控任务", value: stats?.taskCount ?? "—" },
          { label: "运行中", value: stats?.activeCount ?? "—" },
          { label: "有效预警", value: stats?.alertCount ?? "—" },
          { label: "执行次数", value: stats?.execCount ?? "—" },
        ].map((s) => (
          <div key={s.label} className="sw-stat">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </section>

      <section className="sw-grid sw-grid-2">
        <div className="sw-panel">
          <h3 style={{ marginTop: 0 }}>最近预警</h3>
          {!stats?.recentAlerts?.length && <p className="sw-muted">暂无预警</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stats?.recentAlerts?.map((a) => (
              <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div className="sw-muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
                  {a.task.name} · {new Date(a.createdAt).toLocaleString("zh-CN")}
                  {a.suppressed ? " · 已抑制" : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="sw-panel">
          <h3 style={{ marginTop: 0 }}>最近执行</h3>
          {!stats?.recentExecs?.length && <p className="sw-muted">暂无执行记录</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stats?.recentExecs?.map((e) => (
              <li key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 600 }}>
                  {e.task.name} · {e.outcome}
                </div>
                <div className="sw-muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
                  {e.explanation.slice(0, 120)}
                  {e.explanation.length > 120 ? "…" : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
