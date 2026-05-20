import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { confirmRandomTask, createRandomTask } from "@/lib/service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const result = await createRandomTask(user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "抽取随机任务失败" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await request.json();
    const result = await confirmRandomTask(String(body.id ?? ""), user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "确认随机任务失败" },
      { status: 400 }
    );
  }
}
