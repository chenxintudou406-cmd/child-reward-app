import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDayData, settleDaily } from "@/lib/service";

type Params = {
  params: Promise<{ date: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { date } = await params;
  return NextResponse.json(await getDayData(date));
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { date } = await params;
  const body = await request.json();
  try {
    const result = await settleDaily({ ...body, date }, user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "结算失败" },
      { status: 400 }
    );
  }
}
