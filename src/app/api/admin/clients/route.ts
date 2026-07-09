import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const clients = await prisma.client.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true } } },
  });
  return NextResponse.json({ clients });
}
