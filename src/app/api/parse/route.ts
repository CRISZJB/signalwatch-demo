import { NextResponse } from "next/server";
import { parseRuleText } from "@/lib/task-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body.text ?? "");
    const result = parseRuleText(text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "解析失败" },
      { status: 500 },
    );
  }
}
