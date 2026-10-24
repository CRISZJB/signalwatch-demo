import { NextResponse } from "next/server";
import { authorizeScheduler } from "@/lib/scheduler-auth";
import { runSchedulerTick } from "@/lib/task-service";

export async function POST(req: Request) {
  const auth = authorizeScheduler(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未授权的调度请求", reason: auth.reason }, { status: 401 });
  }
  const result = await runSchedulerTick();
  return NextResponse.json({ ...result, auth: auth.reason });
}

export async function GET(req: Request) {
  const auth = authorizeScheduler(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未授权的调度请求", reason: auth.reason }, { status: 401 });
  }
  const result = await runSchedulerTick();
  return NextResponse.json({ ...result, auth: auth.reason });
}
