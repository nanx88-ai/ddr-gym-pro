import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { format } from "date-fns";

/** Backup: scarica il file del database SQLite cosi' com'e' (copia fedele, non un dump parziale). */
export async function GET() {
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Database non trovato" }, { status: 404 });
  }

  const buffer = fs.readFileSync(dbPath);
  const filename = `backup-koalendar-palestra-${format(new Date(), "yyyy-MM-dd-HHmm")}.db`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
