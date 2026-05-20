import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteTransaction } from "@/lib/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await deleteTransaction(id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 400 }
    );
  }
}
