import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESCHEDULE_STATUS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? RESCHEDULE_STATUS.PENDING;
  const requests = await prisma.rescheduleRequest.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    include: {
      booking: { include: { client: true, appointmentType: true } },
    },
  });
  return NextResponse.json({ requests });
}
