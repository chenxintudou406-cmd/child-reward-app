import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updatePointRule, updateRandomTasks, updateSettings, upsertReward } from "@/lib/service";

function numberField(body: Record<string, unknown>, key: string) {
  return body[key] === undefined || body[key] === "" ? undefined : Number(body[key]);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json();
  try {
    if (body.kind === "rule") {
      const result = await updatePointRule(body.id, {
        name: body.name,
        points: Number(body.points),
        cap: body.cap === "" || body.cap == null ? null : Number(body.cap),
        enabled: Boolean(body.enabled),
        description: body.description
      });
      return NextResponse.json(result);
    }

    if (body.kind === "reward") {
      const result = await upsertReward({
        id: body.id,
        name: body.name,
        imageUrl: body.imageUrl || null,
        priceYuan: body.priceYuan === "" ? null : Number(body.priceYuan || 0),
        pointsRequired: Number(body.pointsRequired || 0),
        exchangeRate: Number(body.exchangeRate || 1.5),
        enabled: body.enabled ?? true,
        limitNote: body.limitNote
      });
      return NextResponse.json(result);
    }

    if (body.kind === "randomTasks") {
      const names = Array.isArray(body.names)
        ? body.names
        : String(body.names ?? "").split(/\r?\n/);
      const result = await updateRandomTasks(names);
      return NextResponse.json(result);
    }

    const result = await updateSettings({
      monthlyBudgetYuan: numberField(body, "monthlyBudgetYuan"),
      dailyAllowanceYuan: numberField(body, "dailyAllowanceYuan"),
      dailyPointFloor: numberField(body, "dailyPointFloor"),
      dailyPointCap: numberField(body, "dailyPointCap"),
      savingRewardPoints: numberField(body, "savingRewardPoints"),
      weeklyReviewWeekday: numberField(body, "weeklyReviewWeekday"),
      immediateRate: numberField(body, "immediateRate"),
      plannedRate: numberField(body, "plannedRate"),
      parentPlannedRateMin: numberField(body, "parentPlannedRateMin"),
      parentPlannedRateMax: numberField(body, "parentPlannedRateMax"),
      assetImageUrl: body.assetImageUrl || null,
      skinTheme: body.skinTheme || undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存设置失败" },
      { status: 400 }
    );
  }
}
