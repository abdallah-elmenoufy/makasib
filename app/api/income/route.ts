import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getIncomeStatement } from "@/lib/income";

/** `?from=yyyy-mm-dd&to=yyyy-mm-dd[&vehicleId=]` (to is inclusive) → proof-of-income statement. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const q = req.nextUrl.searchParams;
    const day = (s: string | null) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    };
    const from = day(q.get("from"));
    const toDay = day(q.get("to"));
    if (!from || !toDay || toDay < from) return NextResponse.json({ error: "from and to (yyyy-mm-dd) required" }, { status: 400 });
    const to = new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1);
    if (to.getTime() - from.getTime() > 3 * 366 * 86_400_000) return NextResponse.json({ error: "at most three years" }, { status: 400 });
    return NextResponse.json(await getIncomeStatement(from, to, q.get("vehicleId") || null));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
