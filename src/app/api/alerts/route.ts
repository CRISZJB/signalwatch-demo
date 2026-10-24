import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeSuppressed = searchParams.get("suppressed") === "1";
  const alerts = await prisma.alert.findMany({
    where: includeSuppressed ? undefined : { suppressed: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { task: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ alerts });
}
