import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/** Integrazioni/API REST gestite da backend (Impostazioni), non da .env. */
export async function GET() {
  const integrations = await prisma.integration.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return NextResponse.json({ integrations });
}

const bodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["smtp", "google_oauth", "google_calendar", "aruba", "fattureincloud", "custom"]),
  config: z.record(z.string(), z.string()),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const integration = await prisma.integration.create({
    data: { name: parsed.data.name, type: parsed.data.type, config: JSON.stringify(parsed.data.config) },
  });

  return NextResponse.json({ integration });
}
