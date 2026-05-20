import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createRedemption } from "@/lib/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await request.json();
    const redemption = await createRedemption(body, user);
    return NextResponse.json(redemption);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交兑换失败" },
      { status: 400 }
    );
  }
}
