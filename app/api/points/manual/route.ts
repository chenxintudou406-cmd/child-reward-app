import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createManualPoint } from "@/lib/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await request.json();
    const result = await createManualPoint(
      {
        date: body.date,
        title: body.title,
        points: Number(body.points),
        sourceType: body.sourceType === "weekly_task" ? "weekly_task" : "temporary_task",
        templateId: body.templateId,
        note: body.note
      },
      user
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发放失败" },
      { status: 400 }
    );
  }
}
