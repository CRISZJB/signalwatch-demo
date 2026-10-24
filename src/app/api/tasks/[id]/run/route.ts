import { NextResponse } from "next/server";
import { runTask } from "@/lib/task-service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = await runTask(id, { force: Boolean(body.force) });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "执行失败" },
      { status: 500 },
    );
  }
}
