import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/task-service";
import type { MonitorRule } from "@/lib/types";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const naturalLanguage = String(body.naturalLanguage ?? "");
    const rule = body.rule as MonitorRule;
    if (!rule?.condition) {
      return NextResponse.json({ error: "缺少结构化规则" }, { status: 400 });
    }
    const task = await createTask({
      name: body.name,
      naturalLanguage,
      rule,
      cooldownMinutes: body.cooldownMinutes,
      scheduleIntervalSec: body.scheduleIntervalSec,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}
