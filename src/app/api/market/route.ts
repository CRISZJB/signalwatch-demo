import { NextResponse } from "next/server";
import {
  DATA_DISCLAIMER,
  buildEvalContext,
  clearQuoteOverrideAsync,
  getFaultMode,
  hydrateMarketState,
  listSymbols,
  setFaultModeAsync,
  setQuoteOverrideAsync,
  type FaultMode,
} from "@/lib/market-data";
import { buildPriceOverridePatch, isValidPositivePrice } from "@/lib/quote-override";

export async function GET() {
  await hydrateMarketState();
  const ctx = buildEvalContext();
  return NextResponse.json({
    disclaimer: DATA_DISCLAIMER,
    fault: getFaultMode(),
    symbols: listSymbols(),
    quotes: Object.values(ctx.quotes),
    events: ctx.events,
    calendar: ctx.calendar,
    persistentDemoState: true,
  });
}

export async function POST(req: Request) {
  await hydrateMarketState();
  const body = await req.json();
  if (body.action === "setFault") {
    await setFaultModeAsync(body.mode as FaultMode);
    return NextResponse.json({ ok: true, fault: getFaultMode() });
  }
  if (body.action === "override") {
    const symbol = String(body.symbol ?? "").trim();
    if (!symbol) {
      return NextResponse.json({ error: "缺少标的代码" }, { status: 400 });
    }
    const patchIn = (body.patch ?? {}) as Record<string, unknown>;
    // 价格类覆盖必须同时给出合法 price + prevClose，并由服务端计算涨跌幅
    if ("price" in patchIn || "prevClose" in patchIn) {
      const built = buildPriceOverridePatch(patchIn.price, patchIn.prevClose);
      if (!built.ok) {
        return NextResponse.json({ error: built.error }, { status: 400 });
      }
      await setQuoteOverrideAsync(symbol, built.patch);
      return NextResponse.json({ ok: true, patch: built.patch });
    }
    if ("heat" in patchIn && !isValidPositivePrice(patchIn.heat) && patchIn.heat !== 0) {
      return NextResponse.json({ error: "heat 非法" }, { status: 400 });
    }
    await setQuoteOverrideAsync(symbol, patchIn as Parameters<typeof setQuoteOverrideAsync>[1]);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "clearOverride") {
    await clearQuoteOverrideAsync(body.symbol);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
