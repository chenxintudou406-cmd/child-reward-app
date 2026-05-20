import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { upsertTaskTemplate } from "@/lib/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await request.json();
    const task = await upsertTaskTemplate({
      id: body.id,
      type: body.type || "manual",
      title: body.title,
      owner: body.owner || "family",
      cycle: body.cycle || "weekly",
      defaultPoints: Number(body.defaultPoints || 0),
      autoShowOnDatePage: Boolean(body.autoShowOnDatePage),
      allowAdHocReward: Boolean(body.allowAdHocReward),
      enabled: body.enabled ?? true,
      notes: body.notes
    });
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存任务失败" },
      { status: 400 }
    );
  }
}
