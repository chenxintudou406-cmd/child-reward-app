import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelRedemption, confirmRedemption } from "@/lib/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  try {
    const result =
      body.action === "cancel"
        ? await cancelRedemption(id, user)
        : await confirmRedemption(id, user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "处理兑换失败" },
      { status: 400 }
    );
  }
}
