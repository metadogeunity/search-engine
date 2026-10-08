import { NextResponse } from "next/server";
import { TERMS } from "@/lib/config";
import { collectAll } from "@/lib/trends";
import { saveSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (expected && auth !== "Bearer " + expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const terms = await collectAll(TERMS);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "google-trends",
    terms
  };

  const storage = await saveSnapshot(snapshot);

  return NextResponse.json({
    ok: true,
    generatedAt: snapshot.generatedAt,
    storage
  });
}
