import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: { include: { booking: { include: { appointmentType: true } } } },
      submissions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Fattura non trovata" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}
