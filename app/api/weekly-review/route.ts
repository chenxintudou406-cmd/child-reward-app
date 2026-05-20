import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveWeeklyReview } from "@/lib/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json();
  try {
    const result = await saveWeeklyReview(body, user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存周复盘失败" },
      { status: 400 }
    );
  }
}
