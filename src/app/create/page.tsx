"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MonitorRule, ParseResult } from "@/lib/types";

const EXAMPLES = [
  "贵州茅台跌破1700元提醒我",
  "宁德时代跌超5%并且热度超过80",
  "比亚迪突破280元或者出现减持公告",
  "茅台5天内有财报时提醒我",
];

export default function CreatePage() {
  const router = useRouter();
  const [text, setText] = useState(EXAMPLES[0]);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [ruleJson, setRuleJson] = useState("");
  const [cooldown, setCooldown] = useState(30);
  const [intervalSec, setIntervalSec] = useState(60);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleParse() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as ParseResult;
      setParsed(data);
      if (data.rule) {
        setRuleJson(JSON.stringify(data.rule, null, 2));
        setMsg(`解析成功，置信度 ${(data.confidence * 100).toFixed(0)}%`);
      } else {
        setErr(data.warnings.join("；") || "解析失败");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "解析请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      let rule: MonitorRule;
      try {
        rule = JSON.parse(ruleJson) as MonitorRule;
      } catch {
        throw new Error("规则 JSON 格式无效，请检查后再保存");
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          naturalLanguage: text,
          rule,
          cooldownMinutes: cooldown,
          scheduleIntervalSec: intervalSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setMsg("任务已写入数据库");
      router.push(`/tasks/${data.task.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sw-grid" style={{ gap: 16 }}>
      <div className="sw-panel">
        <h2 style={{ marginTop: 0 }}>自然语言 → 结构化规则</h2>
        <p className="sw-muted" style={{ marginTop: 0 }}>
          输入关注点，系统解析为可编辑规则。解析后可直接改 JSON，再保存为监控任务。
        </p>
        <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
          自然语言
        </label>
        <textarea className="sw-textarea" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="sw-row" style={{ marginTop: 10 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="sw-btn sw-btn-ghost" onClick={() => setText(ex)}>
              {ex.slice(0, 14)}…
            </button>
          ))}
        </div>
        <div className="sw-row" style={{ marginTop: 14 }}>
          <button className="sw-btn sw-btn-primary" onClick={handleParse} disabled={busy}>
            {busy ? "处理中…" : "解析规则"}
          </button>
        </div>
      </div>

      {parsed && (
        <div className="sw-panel">
          <h3 style={{ marginTop: 0 }}>解析结果（可编辑）</h3>
          {parsed.warnings?.length > 0 && (
            <div className="sw-muted" style={{ marginBottom: 10 }}>
              提示：{parsed.warnings.join("；")}
            </div>
          )}
          <div className="sw-grid sw-grid-2">
            <div>
              <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
                任务名称（可选）
              </label>
              <input className="sw-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="自动生成" />
            </div>
            <div className="sw-row">
              <div style={{ flex: 1 }}>
                <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
                  冷却（分钟）
                </label>
                <input
                  className="sw-input"
                  type="number"
                  min={1}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="sw-muted" style={{ fontSize: "0.85rem" }}>
                  调度间隔（秒）
                </label>
                <input
                  className="sw-input"
                  type="number"
                  min={10}
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <label className="sw-muted" style={{ fontSize: "0.85rem", display: "block", marginTop: 12 }}>
            结构化规则 JSON
          </label>
          <textarea
            className="sw-textarea"
            style={{ minHeight: 260, fontFamily: "ui-monospace, monospace" }}
            value={ruleJson}
            onChange={(e) => setRuleJson(e.target.value)}
          />
          <div className="sw-row" style={{ marginTop: 14 }}>
            <button className="sw-btn sw-btn-primary" onClick={handleSave} disabled={busy || !ruleJson}>
              保存到数据库并启动
            </button>
          </div>
        </div>
      )}

      {msg && <div className="sw-ok">{msg}</div>}
      {err && <div className="sw-error">{err}</div>}
    </main>
  );
}
