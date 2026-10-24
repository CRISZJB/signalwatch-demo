"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEMO_OVERRIDE_PREV_CLOSE,
  DEMO_OVERRIDE_PRICE,
} from "@/lib/quote-override";

interface Quote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  heat: number;
  asOf: string;
  source: string;
  stale?: boolean;
}

export default function MarketPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [fault, setFault] = useState("none");
  const [symbol, setSymbol] = useState("600519");
  const [price, setPrice] = useState(DEMO_OVERRIDE_PRICE);
  const [prevClose, setPrevClose] = useState(DEMO_OVERRIDE_PREV_CLOSE);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/market");
    const data = await res.json();
    setQuotes(data.quotes ?? []);
    setDisclaimer(data.disclaimer ?? "");
    setFault(data.fault ?? "none");
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  async function setFaultMode(mode: string) {
    await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setFault", mode }),
    });
    setErr("");
    setMsg(`已设置故障模式：${mode}`);
    await load();
  }

  async function applyOverride() {
    setErr("");
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "override",
        symbol,
        patch: {
          price: Number(price),
          prevClose: Number(prevClose),
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("");
      setErr(typeof data.error === "string" ? data.error : "覆盖失败：请检查价格输入");
      return;
    }
    setMsg(
      `已覆盖 ${symbol}：现价 ${price} / 前收 ${prevClose}（涨跌幅由二者计算，仍标记为 SIMULATED）`,
    );
    await load();
  }

  async function clearOverride() {
    await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearOverride" }),
    });
    setErr("");
    setMsg("已清除价格覆盖，恢复默认模拟行情");
    await load();
  }

  return (
    <main className="sw-grid" style={{ gap: 16 }}>
      <div className="sw-panel">
        <h2 style={{ marginTop: 0 }}>模拟行情控制台</h2>
        <p className="sw-muted">{disclaimer}</p>
        <div className="sw-badge">当前故障模式：{fault}</div>
        <div className="sw-row" style={{ marginTop: 14 }}>
          <button className="sw-btn sw-btn-ghost" onClick={() => setFaultMode("none")}>
            正常
          </button>
          <button className="sw-btn sw-btn-ghost" onClick={() => setFaultMode("timeout")}>
            模拟超时
          </button>
          <button className="sw-btn sw-btn-ghost" onClick={() => setFaultMode("stale")}>
            模拟过期
          </button>
          <button className="sw-btn sw-btn-ghost" onClick={() => setFaultMode("conflict")}>
            模拟冲突
          </button>
        </div>
        <div className="sw-row" style={{ marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label className="sw-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            代码
            <input
              className="sw-input"
              style={{ width: 100 }}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </label>
          <label className="sw-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            当前模拟价格
            <input
              className="sw-input"
              style={{ width: 120 }}
              type="number"
              min={0}
              step="any"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
          <label className="sw-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            模拟前收盘价
            <input
              className="sw-input"
              style={{ width: 120 }}
              type="number"
              min={0}
              step="any"
              value={prevClose}
              onChange={(e) => setPrevClose(Number(e.target.value))}
            />
          </label>
          <button className="sw-btn sw-btn-primary" onClick={applyOverride}>
            覆盖模拟价（便于演示触发）
          </button>
          <button className="sw-btn sw-btn-ghost" onClick={clearOverride}>
            清除覆盖
          </button>
        </div>
        <p className="sw-muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
          演示「跌破 1700」：前收默认 1720（≥1700）、现价默认 1650（&lt;1700）。前收若仍低于阈值则不会判定为新跌破。
        </p>
        {msg && <div className="sw-ok" style={{ marginTop: 12 }}>{msg}</div>}
        {err && (
          <div className="sw-error" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}
      </div>

      <div className="sw-panel">
        <h3 style={{ marginTop: 0 }}>当前模拟报价</h3>
        <table className="sw-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>价格</th>
              <th>前收盘价</th>
              <th>涨跌幅</th>
              <th>热度</th>
              <th>来源</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.symbol}>
                <td>{q.symbol}</td>
                <td>{q.name}</td>
                <td>{q.price}</td>
                <td>{q.prevClose}</td>
                <td>{q.changePct.toFixed(2)}%</td>
                <td>{q.heat}</td>
                <td>
                  <span className="sw-badge">
                    {q.source}
                    {q.stale ? " / 过期" : ""}
                  </span>
                </td>
                <td className="sw-muted">{new Date(q.asOf).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
