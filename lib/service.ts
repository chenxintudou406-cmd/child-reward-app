import { Prisma, type User } from "@prisma/client";
import { addDays, endOfWeek, parseDateKey, startOfLocalDay, startOfWeek, toDateKey } from "@/lib/date";
import { ensureSeedData } from "@/lib/defaults";
import { prisma } from "@/lib/prisma";
import {
  cancelPreviewRedemption,
  confirmPreviewRandomTask,
  createPreviewRandomTask,
  confirmPreviewRedemption,
  createPreviewManualPoint,
  createPreviewRedemption,
  deletePreviewTransaction,
  getPreviewAppData,
  getPreviewDayData,
  savePreviewWeeklyReview,
  settlePreviewDaily,
  updatePreviewRule,
  updatePreviewRandomTasks,
  updatePreviewSettings,
  upsertPreviewReward,
  upsertPreviewTask
} from "@/lib/preview-store";

export type DailySettlementInput = {
  date: string;
  homework: boolean;
  preview: boolean;
  extra: boolean;
  attitude: boolean;
  levels?: Partial<Record<DailyTaskTrigger, DailyLevel>>;
  dynamicNote?: string;
  parentNote?: string;
  settlementNote?: string;
  adHocTitle?: string;
  adHocPoints?: number;
};

export type ManualPointInput = {
  date: string;
  title: string;
  points: number;
  sourceType: "temporary_task" | "weekly_task";
  templateId?: string;
  note?: string;
};

type DailyLevel = "none" | "low" | "mid" | "full";
type DailyTaskTrigger = "homework" | "preview" | "extra_homework" | "attitude";
type DailyDetail = { trigger: string; label: string; level: DailyLevel; points: number };

const dailyStatusFields: Record<DailyTaskTrigger, "homeworkStatus" | "previewStatus" | "extraStatus" | "attitudeStatus"> = {
  homework: "homeworkStatus",
  preview: "previewStatus",
  extra_homework: "extraStatus",
  attitude: "attitudeStatus"
};

function normalizeLevel(value: unknown): DailyLevel {
  if (value === "low" || value === "mid" || value === "full" || value === "none") return value;
  if (value === "done" || value === true) return "full";
  return "none";
}

function levelPoints(points: number, level: DailyLevel) {
  if (level === "none") return 0;
  if (level === "full") return points;
  const ratio = level === "low" ? 1 / 3 : 2 / 3;
  return Math.max(0, Math.round((points * ratio) / 50) * 50);
}

function levelLabel(level: DailyLevel) {
  return ({ none: "未完成", low: "1/3", mid: "2/3", full: "完成" } as const)[level];
}

function appendNote(existing: string | null | undefined, next: string | null | undefined, operator: string) {
  const value = next?.trim();
  if (!value) return existing ?? "";
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const entry = `[${stamp} ${operator}] ${value}`;
  return existing?.trim() ? `${existing.trim()}\n${entry}` : entry;
}

export async function getBalance() {
  if (!process.env.DATABASE_URL) return getPreviewAppData().balance;

  const result = await prisma.pointTransaction.groupBy({
    by: ["direction"],
    _sum: { points: true }
  });
  const income = result.find((item) => item.direction === "income")?._sum.points ?? 0;
  const expense = result.find((item) => item.direction === "expense")?._sum.points ?? 0;
  return income - expense;
}

export async function getAppData() {
  if (!process.env.DATABASE_URL) return getPreviewAppData();

  await ensureSeedData();
  const today = startOfLocalDay(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const ledgerStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const settings = await prisma.familySettings.findUniqueOrThrow({ where: { id: "family" } });

  const [
    balance,
    users,
    rules,
    templates,
    rewards,
    allRewards,
    todayRecord,
    recentTransactions,
    ledgerTransactions,
    pendingRedemptions,
    weekTransactions,
    weekRedemptions,
    weeklyReview
  ] = await Promise.all([
    getBalance(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pointRule.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.taskTemplate.findMany({ orderBy: [{ cycle: "asc" }, { createdAt: "asc" }] }),
    prisma.reward.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } }),
    prisma.reward.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dailyRecord.findUnique({ where: { date: today } }),
    prisma.pointTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { operator: true }
    }),
    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: ledgerStart } },
      orderBy: { createdAt: "desc" },
      take: 800,
      include: { operator: true }
    }),
    prisma.redemption.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { reward: true, createdBy: true }
    }),
    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: weekStart, lte: addDays(weekEnd, 1) } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.redemption.findMany({
      where: { createdAt: { gte: weekStart, lte: addDays(weekEnd, 1) } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.weeklyReview.findUnique({ where: { weekStart } })
  ]);
  const [randomTaskPool, todayRandomTask] = await Promise.all([
    prisma.taskTemplate.findMany({
      where: { type: "random_task", enabled: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.taskInstance.findFirst({
      where: { targetDate: today, note: "random_task" },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const weekIncome = weekTransactions
    .filter((item) => item.direction === "income")
    .reduce((sum, item) => sum + item.points, 0);
  const weekExpense = weekTransactions
    .filter((item) => item.direction === "expense")
    .reduce((sum, item) => sum + item.points, 0);
  const weekAllowanceSpent = weekRedemptions
    .filter((item) => item.type === "allowance" && item.status === "confirmed")
    .reduce((sum, item) => sum + (item.amountYuan ?? 0), 0);

  const calendar = await getCalendarSummary(today);
  const autoTasks = templates.filter((item) => item.enabled && item.autoShowOnDatePage);

  return {
    settings,
    users: users.map(({ passwordHash: _passwordHash, ...user }) => user),
    balance,
    todayKey: toDateKey(today),
    week: {
      start: toDateKey(weekStart),
      end: toDateKey(weekEnd),
      income: weekIncome,
      expense: weekExpense,
      allowanceBudget: settings.dailyAllowanceYuan * 7,
      allowanceSpent: weekAllowanceSpent
    },
    rules,
    templates,
    autoTasks,
    rewards,
    allRewards,
    randomTaskPool,
    todayRandomTask,
    todayRecord,
    weeklyReview,
    recentTransactions,
    ledgerTransactions,
    pendingRedemptions,
    calendar
  };
}

async function getCalendarSummary(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const records = await prisma.dailyRecord.findMany({
    where: { date: { gte: first, lte: last } },
    orderBy: { date: "asc" },
    select: { date: true, dailyPoints: true, dynamicNote: true }
  });
  const transactions = await prisma.pointTransaction.findMany({
    where: { createdAt: { gte: first, lt: addDays(last, 1) } },
    select: { createdAt: true, direction: true, points: true }
  });
  const dayMap = new Map<string, { date: string; points: number; net: number; hasNote: boolean }>();

  for (const record of records) {
    dayMap.set(toDateKey(record.date), {
      date: toDateKey(record.date),
      points: record.dailyPoints,
      net: 0,
      hasNote: Boolean(record.dynamicNote)
    });
  }
  for (const transaction of transactions) {
    const key = toDateKey(transaction.createdAt);
    const item = dayMap.get(key) ?? { date: key, points: 0, net: 0, hasNote: false };
    item.net += transaction.direction === "income" ? transaction.points : -transaction.points;
    dayMap.set(key, item);
  }

  return {
    month: `${anchor.getFullYear()}-${`${anchor.getMonth() + 1}`.padStart(2, "0")}`,
    days: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

export async function getDayData(dateKey: string) {
  if (!process.env.DATABASE_URL) return getPreviewDayData(dateKey);

  await ensureSeedData();
  const date = parseDateKey(dateKey);
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const [settings, record, templates, rules, transactions, weeklyReview] = await Promise.all([
    prisma.familySettings.findUniqueOrThrow({ where: { id: "family" } }),
    prisma.dailyRecord.findUnique({ where: { date } }),
    prisma.taskTemplate.findMany({
      where: { enabled: true },
      orderBy: [{ defaultPoints: "desc" }, { createdAt: "asc" }]
    }),
    prisma.pointRule.findMany({
      where: { enabled: true, category: "daily", NOT: { trigger: "daily_floor" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.pointTransaction.findMany({
      where: {
        OR: [{ dailyRecord: { date } }, { createdAt: { gte: date, lt: addDays(date, 1) } }]
      },
      orderBy: { createdAt: "desc" },
      include: { operator: true }
    }),
    prisma.weeklyReview.findUnique({ where: { weekStart } })
  ]);
  const weekTransactions = await prisma.pointTransaction.findMany({
    where: {
      sourceType: { in: ["weekly_task", "temporary_task", "weekly_review"] },
      createdAt: { gte: weekStart, lt: addDays(weekEnd, 1) }
    },
    select: { sourceId: true, points: true }
  });
  const weekAwardMap = new Map<string, number>();
  for (const transaction of weekTransactions) {
    if (!transaction.sourceId) continue;
    weekAwardMap.set(transaction.sourceId, (weekAwardMap.get(transaction.sourceId) ?? 0) + transaction.points);
  }
  const withWeekAward = (item: typeof templates[number]) => ({
    ...item,
    weekAwardedPoints: weekAwardMap.get(item.id) ?? 0,
    weeklyCapPoints: item.defaultPoints
  });

  return {
    settings,
    date: dateKey,
    weekday: date.getDay(),
    record,
    weeklyReview,
    weekStart: toDateKey(weekStart),
    weekEnd: toDateKey(weekEnd),
    showWeeklyReview: date.getDay() === settings.weeklyReviewWeekday,
    dailyTasks: rules.map((rule) => ({
      id: rule.id,
      trigger: rule.trigger,
      name: rule.name,
      points: rule.points,
      cap: rule.cap,
      description: rule.description
    })),
    weeklyTasks: templates.filter((item) => item.cycle === "weekly").map(withWeekAward),
    adHocTasks: templates.filter((item) => item.allowAdHocReward && item.type !== "extra_work").map(withWeekAward),
    transactions
  };
}

export async function settleDaily(input: DailySettlementInput, user: User) {
  if (!process.env.DATABASE_URL) return settlePreviewDaily(input, user as any);

  await ensureSeedData();
  const date = parseDateKey(input.date);
  const settings = await prisma.familySettings.findUniqueOrThrow({ where: { id: "family" } });
  const rules = await prisma.pointRule.findMany({
    where: { enabled: true, category: "daily" },
    orderBy: { sortOrder: "asc" }
  });
  const levels: Record<DailyTaskTrigger, DailyLevel> = {
    homework: normalizeLevel(input.levels?.homework ?? input.homework),
    preview: normalizeLevel(input.levels?.preview ?? input.preview),
    extra_homework: normalizeLevel(input.levels?.extra_homework ?? input.extra),
    attitude: normalizeLevel(input.levels?.attitude ?? input.attitude)
  };
  const taskRules = rules.filter((rule) => rule.trigger !== "daily_floor" && rule.trigger in dailyStatusFields);
  const earnedDetail: DailyDetail[] = taskRules.map((rule) => {
    const trigger = rule.trigger as DailyTaskTrigger;
    const level = levels[trigger];
    return {
      trigger,
      label: rule.name,
      level,
      points: levelPoints(rule.points, level)
    };
  });
  const adHocPoints = Math.max(0, Number(input.adHocPoints ?? 0));
  const floorPoints = rules.find((rule) => rule.trigger === "daily_floor")?.points || settings.dailyPointFloor;
  const rawPoints = earnedDetail.reduce((sum, item) => sum + item.points, 0) + adHocPoints;
  const cappedPoints = Math.min(settings.dailyPointCap, rawPoints > 0 ? rawPoints : floorPoints);
  const statusData = Object.fromEntries(
    Object.entries(dailyStatusFields).map(([trigger, field]) => [field, levels[trigger as DailyTaskTrigger]])
  );

  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyRecord.findUnique({ where: { date } });
    const record = await tx.dailyRecord.upsert({
      where: { date },
      create: {
        date,
        ...statusData,
        dynamicNote: appendNote(null, input.dynamicNote, user.nickname),
        parentNote: appendNote(null, input.parentNote, user.nickname),
        settlementNote: appendNote(null, input.settlementNote, user.nickname),
        dailyPoints: cappedPoints,
        createdById: user.id,
        updatedById: user.id
      },
      update: {
        ...statusData,
        dynamicNote: appendNote(existing?.dynamicNote, input.dynamicNote, user.nickname),
        parentNote: appendNote(existing?.parentNote, input.parentNote, user.nickname),
        settlementNote: appendNote(existing?.settlementNote, input.settlementNote, user.nickname),
        dailyPoints: cappedPoints,
        updatedById: user.id
      }
    });

    await tx.pointTransaction.deleteMany({
      where: { sourceType: "daily_settlement", dailyRecordId: record.id }
    });

    const detail = rawPoints > 0
      ? earnedDetail.concat(adHocPoints ? [{ trigger: "ad_hoc", label: input.adHocTitle || "临时奖励", level: "full" as DailyLevel, points: adHocPoints }] : [])
      : [{ trigger: "daily_floor", label: "保底结算", level: "full" as DailyLevel, points: floorPoints }];
    const description = detail.map((item) => `${item.label} ${levelLabel(item.level)} +${item.points}`).join("，");
    await tx.pointTransaction.create({
      data: {
        direction: "income",
        points: cappedPoints,
        sourceType: "daily_settlement",
        sourceId: record.id,
        dailyRecordId: record.id,
        operatorId: user.id,
        description: `${input.date} 每日结算：${description}`,
        note: input.settlementNote?.trim() || null
      }
    });

    return { record, points: cappedPoints };
  });
}

export async function createManualPoint(input: ManualPointInput, user: User) {
  if (!process.env.DATABASE_URL) return createPreviewManualPoint(input, user as any);

  await ensureSeedData();
  const date = parseDateKey(input.date);
  const points = Math.max(0, Number(input.points || 0));
  if (!input.title?.trim()) throw new Error("请填写任务名称");
  if (points <= 0) throw new Error("积分必须大于 0");
  return prisma.pointTransaction.create({
    data: {
      direction: "income",
      points,
      sourceType: input.sourceType,
      sourceId: input.templateId || input.date,
      operatorId: user.id,
      createdAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12),
      description: `${input.sourceType === "weekly_task" ? "周任务" : "临时任务"}：${input.title}${input.note ? `｜${input.note}` : ""}`,
      note: input.note?.trim() || null
    }
  });
}

export async function deleteTransaction(id: string) {
  if (!process.env.DATABASE_URL) return deletePreviewTransaction(id);

  await ensureSeedData();
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.pointTransaction.findUnique({ where: { id } });
    if (!transaction) throw new Error("记录不存在");
    await tx.pointTransaction.delete({ where: { id } });
    if (transaction.sourceType === "daily_settlement" && transaction.dailyRecordId) {
      await tx.dailyRecord.update({
        where: { id: transaction.dailyRecordId },
        data: { dailyPoints: 0 }
      }).catch(() => null);
    }
    return { ok: true };
  });
}

export async function saveWeeklyReview(data: {
  weekStart: string;
  content?: string;
  strengths?: string;
  improvements?: string;
  nextActions?: string;
  recordingUrl?: string;
  completed?: boolean;
}, user: User) {
  if (!process.env.DATABASE_URL) return savePreviewWeeklyReview(data, user as any);

  await ensureSeedData();
  const weekStart = parseDateKey(data.weekStart);
  const reviewRule = await prisma.pointRule.findFirst({
    where: { enabled: true, trigger: "weekly_review" }
  });
  const points = data.completed ? reviewRule?.points ?? 500 : 0;

  return prisma.$transaction(async (tx) => {
    const review = await tx.weeklyReview.upsert({
      where: { weekStart },
      create: {
        weekStart,
        weekEnd: endOfWeek(weekStart),
        content: data.content,
        strengths: data.strengths,
        improvements: data.improvements,
        nextActions: data.nextActions,
        recordingUrl: data.recordingUrl,
        completed: Boolean(data.completed),
        pointsAwarded: points
      },
      update: {
        content: data.content,
        strengths: data.strengths,
        improvements: data.improvements,
        nextActions: data.nextActions,
        recordingUrl: data.recordingUrl,
        completed: Boolean(data.completed),
        pointsAwarded: points
      }
    });

    await tx.pointTransaction.deleteMany({
      where: { sourceType: "weekly_review", sourceId: review.id }
    });

    if (points > 0) {
      await tx.pointTransaction.create({
        data: {
          direction: "income",
          points,
          sourceType: "weekly_review",
          sourceId: review.id,
          operatorId: user.id,
          description: "完成周复盘：看见优点，也找到下周动作"
        }
      });
    }

    return review;
  });
}

export async function createRedemption(data: {
  type: "allowance" | "reward" | "plan";
  title?: string;
  amountYuan?: number;
  pointsCost?: number;
  rewardId?: string;
  planText?: string;
}, user: User) {
  if (!process.env.DATABASE_URL) return createPreviewRedemption(data, user as any);

  await ensureSeedData();
  let title = data.title?.trim() || "兑换申请";
  let pointsCost = Math.max(0, Math.round(data.pointsCost ?? 0));
  let amountYuan = data.amountYuan;
  let rewardId = data.rewardId;

  if (data.type === "plan") {
    if (!title.trim()) throw new Error("请填写许愿名称");
    if (pointsCost <= 0) throw new Error("请填写预计积分");
    return prisma.reward.create({
      data: {
        name: title,
        pointsRequired: pointsCost,
        exchangeRate: 1.5,
        enabled: true,
        limitNote: data.planText || "胖胖提交的许愿计划，后续可兑换。"
      }
    });
  }

  if (data.type === "allowance") {
    amountYuan = Math.max(0, Number(data.amountYuan ?? 0));
    pointsCost = Math.round(amountYuan * 100);
    title = `兑换零花钱 ${amountYuan} 元`;
  }

  if (data.type === "reward" && rewardId) {
    const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
    if (!reward) throw new Error("礼品不存在");
    title = reward.name;
    pointsCost = reward.pointsRequired;
  }

  if (pointsCost <= 0) throw new Error("兑换积分必须大于 0");

  return prisma.redemption.create({
    data: {
      type: data.type,
      title,
      amountYuan,
      pointsCost,
      rewardId,
      planText: data.planText,
      createdById: user.id
    }
  });
}

export async function confirmRedemption(id: string, user: User) {
  if (!process.env.DATABASE_URL) return confirmPreviewRedemption(id, user as any);

  await ensureSeedData();
  return prisma.$transaction(async (tx) => {
    const redemption = await tx.redemption.findUnique({ where: { id } });
    if (!redemption) throw new Error("兑换记录不存在");
    if (redemption.status !== "pending") throw new Error("这条兑换已处理");

    const balance = await getBalance();
    if (balance < redemption.pointsCost) throw new Error("当前积分不足，不能确认兑换");

    const transaction = await tx.pointTransaction.create({
      data: {
        direction: "expense",
        points: redemption.pointsCost,
        sourceType: "redemption",
        sourceId: redemption.id,
        operatorId: user.id,
        description: `确认兑换：${redemption.title}`
      }
    });

    if (redemption.type === "allowance") {
      await tx.allowanceLedger.create({
        data: {
          redemptionId: redemption.id,
          amountYuan: redemption.amountYuan ?? redemption.pointsCost / 100,
          pointsCost: redemption.pointsCost
        }
      });
    }

    return tx.redemption.update({
      where: { id },
      data: {
        status: "confirmed",
        confirmedById: user.id,
        confirmedAt: new Date(),
        transactionId: transaction.id
      }
    });
  });
}

export async function cancelRedemption(id: string, user: User) {
  if (!process.env.DATABASE_URL) return cancelPreviewRedemption(id, user as any);

  await ensureSeedData();
  return prisma.redemption.update({
    where: { id },
    data: {
      status: "cancelled",
      confirmedById: user.id,
      confirmedAt: new Date()
    }
  });
}

export async function upsertTaskTemplate(data: Prisma.TaskTemplateUncheckedCreateInput & { id?: string }) {
  if (!process.env.DATABASE_URL) return upsertPreviewTask(data as any);

  await ensureSeedData();
  const { id, ...values } = data;
  if (id) return prisma.taskTemplate.update({ where: { id }, data: values });
  return prisma.taskTemplate.create({ data: values });
}

export async function updateSettings(data: Prisma.FamilySettingsUpdateInput) {
  if (!process.env.DATABASE_URL) return updatePreviewSettings(data as any);

  await ensureSeedData();
  return prisma.familySettings.update({ where: { id: "family" }, data });
}

export async function updatePointRule(id: string, data: Prisma.PointRuleUpdateInput) {
  if (!process.env.DATABASE_URL) return updatePreviewRule(id, data as any);

  await ensureSeedData();
  return prisma.pointRule.update({ where: { id }, data });
}

export async function upsertReward(data: Prisma.RewardUncheckedCreateInput & { id?: string }) {
  if (!process.env.DATABASE_URL) return upsertPreviewReward(data as any);

  await ensureSeedData();
  const { id, ...values } = data;
  if (id) return prisma.reward.update({ where: { id }, data: values });
  return prisma.reward.create({ data: values });
}

export async function updateRandomTasks(names: string[]) {
  if (!process.env.DATABASE_URL) return updatePreviewRandomTasks(names);

  await ensureSeedData();
  const cleanNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  return prisma.$transaction(async (tx) => {
    await tx.taskTemplate.updateMany({
      where: { type: "random_task" },
      data: { enabled: false }
    });
    const saved = [];
    for (const title of cleanNames) {
      const existing = await tx.taskTemplate.findFirst({ where: { type: "random_task", title } });
      const task = existing
        ? await tx.taskTemplate.update({
            where: { id: existing.id },
            data: {
              enabled: true,
              defaultPoints: 100,
              cycle: "active",
              owner: "pangpang",
              autoShowOnDatePage: false,
              allowAdHocReward: false
            }
          })
        : await tx.taskTemplate.create({
            data: {
              type: "random_task",
              title,
              owner: "pangpang",
              cycle: "active",
              defaultPoints: 100,
              autoShowOnDatePage: false,
              allowAdHocReward: false,
              enabled: true
            }
          });
      saved.push(task);
    }
    return saved;
  });
}

export async function createRandomTask(user: User) {
  if (!process.env.DATABASE_URL) return createPreviewRandomTask(user as any);

  await ensureSeedData();
  const today = startOfLocalDay(new Date());
  const existing = await prisma.taskInstance.findFirst({
    where: { targetDate: today, note: "random_task" },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return { task: existing, alreadyUsed: true };

  const pool = await prisma.taskTemplate.findMany({ where: { type: "random_task", enabled: true } });
  if (pool.length === 0) throw new Error("还没有设置随机任务");
  const template = pool[Math.floor(Math.random() * pool.length)];
  const task = await prisma.taskInstance.create({
    data: {
      templateId: template.id,
      title: template.title,
      owner: "pangpang",
      cycle: "active",
      points: template.defaultPoints || 100,
      status: "pending",
      targetDate: today,
      note: "random_task"
    }
  });
  return { task, alreadyUsed: false };
}

export async function confirmRandomTask(id: string, user: User) {
  if (!process.env.DATABASE_URL) return confirmPreviewRandomTask(id, user as any);

  await ensureSeedData();
  return prisma.$transaction(async (tx) => {
    const task = await tx.taskInstance.findUnique({ where: { id } });
    if (!task || task.note !== "random_task") throw new Error("随机任务不存在");
    if (task.status === "completed") return { task, alreadyConfirmed: true };
    if (task.status !== "pending") throw new Error("这条随机任务已处理");
    const date = task.targetDate ? startOfLocalDay(task.targetDate) : startOfLocalDay(new Date());
    await tx.pointTransaction.create({
      data: {
        direction: "income",
        points: task.points || 100,
        sourceType: "random_task",
        sourceId: task.id,
        operatorId: user.id,
        createdAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12),
        description: `随机任务：${task.title}`,
        note: "每天开心一点"
      }
    });
    const updated = await tx.taskInstance.update({
      where: { id: task.id },
      data: {
        status: "completed",
        settledById: user.id,
        settledAt: new Date()
      }
    });
    return { task: updated, alreadyConfirmed: false };
  });
}
