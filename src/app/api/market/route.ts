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
    await setQuoteOverrideAsync(String(body.symbol), body.patch ?? {});
    return NextResponse.json({ ok: true });
  }
  if (body.action === "clearOverride") {
    await clearQuoteOverrideAsync(body.symbol);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
