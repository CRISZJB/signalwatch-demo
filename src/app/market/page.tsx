"use client";

import { useCallback, useEffect, useState } from "react";

interface Quote {
  symbol: string;
  name: string;
  price: number;
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
  const [price, setPrice] = useState(1650);
  const [msg, setMsg] = useState("");

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
    setMsg(`已设置故障模式：${mode}`);
    await load();
  }

  async function applyOverride() {
    await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "override",
        symbol,
        patch: {
          price: Number(price),
          changePct: -((1688 - Number(price)) / 1688) * 100,
          prevClose: 1688,
        },
      }),
    });
    setMsg(`已覆盖 ${symbol} 模拟价为 ${price}（仍标记为 SIMULATED）`);
    await load();
  }

  async function clearOverride() {
    await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearOverride" }),
    });
    setMsg("已清除价格覆盖");
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
        <div className="sw-row" style={{ marginTop: 16 }}>
          <input className="sw-input" style={{ width: 120 }} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          <input
            className="sw-input"
            style={{ width: 140 }}
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
          <button className="sw-btn sw-btn-primary" onClick={applyOverride}>
            覆盖模拟价（便于演示触发）
          </button>
          <button className="sw-btn sw-btn-ghost" onClick={clearOverride}>
            清除覆盖
          </button>
        </div>
        {msg && <div className="sw-ok" style={{ marginTop: 12 }}>{msg}</div>}
      </div>

      <div className="sw-panel">
        <h3 style={{ marginTop: 0 }}>当前模拟报价</h3>
        <table className="sw-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>价格</th>
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
                <td>{q.changePct.toFixed(2)}%</td>
                <td>{q.heat}</td>
                <td>
                  <span className="sw-badge">{q.source}{q.stale ? " / 过期" : ""}</span>
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
