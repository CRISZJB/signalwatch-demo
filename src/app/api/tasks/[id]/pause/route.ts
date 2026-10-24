import { NextResponse } from "next/server";
import { setTaskStatus } from "@/lib/task-service";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const task = await setTaskStatus(id, "PAUSED");
  return NextResponse.json({ task });
}
