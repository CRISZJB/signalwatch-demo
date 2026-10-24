import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Render / 负载均衡健康检查。
 * 检查进程存活与数据库连通性，不返回敏感信息。
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "signalwatch",
      db: "up",
      dataMode: process.env.NEXT_PUBLIC_DATA_MODE || "SIMULATED",
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: "signalwatch",
        db: "down",
        latencyMs: Date.now() - started,
        ts: new Date().toISOString(),
        error: err instanceof Error ? err.message : "db_error",
      },
      { status: 503 },
    );
  }
}
