import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppData } from "@/lib/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const data = await getAppData();
  return NextResponse.json({ ...data, currentUser: user });
}
