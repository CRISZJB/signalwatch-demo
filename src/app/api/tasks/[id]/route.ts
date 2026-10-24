import { NextResponse } from "next/server";
import { getTask, updateTaskRule } from "@/lib/task-service";
import type { MonitorRule } from "@/lib/types";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "未找到任务" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const rule = body.rule as MonitorRule;
    if (!rule?.condition) {
      return NextResponse.json({ error: "缺少规则" }, { status: 400 });
    }
    const task = await updateTaskRule(id, rule, body.changeNote, {
      name: body.name,
      cooldownMinutes: body.cooldownMinutes,
      scheduleIntervalSec: body.scheduleIntervalSec,
      naturalLanguage: body.naturalLanguage,
    });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 500 },
    );
  }
}
