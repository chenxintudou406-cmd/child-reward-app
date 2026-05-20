import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { ensureSeedData } from "@/lib/defaults";
import { prisma } from "@/lib/prisma";
import { previewLogin } from "@/lib/preview-store";

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!process.env.DATABASE_URL) {
    const user = previewLogin(username, password);
    if (!user) return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ user });
  }

  await ensureSeedData();
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      username: user.username,
      role: user.role
    }
  });
}
