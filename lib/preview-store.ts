import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addDays, endOfWeek, parseDateKey, startOfLocalDay, startOfWeek, toDateKey } from "@/lib/date";
import { defaultCredentials, defaultRandomTasks } from "@/lib/defaults";

const storePath = join(process.cwd(), ".local-preview.json");

type PreviewStore = {
  settings: Record<string, any>;
  users: Array<Record<string, any>>;
  rules: Array<Record<string, any>>;
  templates: Array<Record<string, any>>;
  rewards: Array<Record<string, any>>;
  dailyRecords: Array<Record<string, any>>;
  weeklyReviews: Array<Record<string, any>>;
  transactions: Array<Record<string, any>>;
  taskInstances: Array<Record<string, any>>;
  redemptions: Array<Record<string, any>>;
  allowanceLedgers: Array<Record<string, any>>;
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

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function now() {
  return new Date().toISOString();
}

function appendNote(existing: string | undefined, next: string | undefined, operator: string) {
  const value = next?.trim();
  if (!value) return existing ?? "";
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const entry = `[${stamp} ${operator}] ${value}`;
  return existing?.trim() ? `${existing.trim()}\n${entry}` : entry;
}

function defaults(): PreviewStore {
  const createdAt = now();
  return {
    settings: {
      id: "family",
      monthlyBudgetYuan: 600,
      dailyAllowanceYuan: 6,
      dailyPointFloor: 200,
      dailyPointCap: 1000,
      savingRewardPoints: 1000,
      weeklyReviewWeekday: 6,
      immediateRate: 1,
      plannedRate: 1.5,
      parentPlannedRateMin: 2,
      parentPlannedRateMax: 3,
      assetImageUrl: "",
      skinTheme: "sunny",
      createdAt,
      updatedAt: createdAt
    },
    users: defaultCredentials.map((account, index) => ({
      id: index === 0 ? "dad" : "mom",
      nickname: account.nickname,
      username: account.username,
      role: "parent",
      createdAt,
      updatedAt: createdAt
    })),
    rules: [
      ["每日保底", "daily", "daily_floor", 200, 200, "当天没有获得任务分时，保底获得 200 分。"],
      ["课堂作业", "daily", "homework", 300, 300, "20:00 前完成、耐心订正、字迹格式好。"],
      ["预习完成", "daily", "preview", 200, 200, "按老师要求填写，并能用 5 句话概括课文。"],
      ["课外任务", "daily", "extra_homework", 200, 200, "课外作业或培训班任务耐心完成。"],
      ["积极态度", "daily", "attitude", 200, 200, "主动学习、分享观点、积极面对生活。"],
      ["周复盘", "weekly", "weekly_review", 500, null, "每周看见优点，也找到下周改进动作。"],
      ["存钱计划", "weekly", "saving_plan", 1000, null, "每周花费少于本周零花钱一半。"]
    ].map(([name, category, trigger, points, cap, description], index) => ({
      id: id("rule"),
      name,
      category,
      trigger,
      points,
      cap,
      enabled: true,
      sortOrder: (index + 1) * 10,
      description,
      createdAt,
      updatedAt: createdAt
    })),
    templates: [
      ["daily_homework", "课堂作业认真完成", "pangpang", "daily", 300, true, false],
      ["daily_preview", "预习和 5 句话概括", "mom", "daily", 200, true, false],
      ["extra_work", "课外作业耐心完成", "pangpang", "daily", 200, true, true],
      ["weekly_review", "周复盘", "family", "weekly", 500, true, true],
      ["dad_task", "爸爸任务", "dad", "weekly", 500, false, true],
      ["mom_task", "妈妈任务", "mom", "weekly", 1000, false, true],
      ["self_value", "自主提供价值", "pangpang", "active", 1000, false, true],
      ...defaultRandomTasks.map((title) => ["random_task", title, "pangpang", "active", 100, false, false])
    ].map(([type, title, owner, cycle, defaultPoints, autoShowOnDatePage, allowAdHocReward]) => ({
      id: id("task"),
      type,
      title,
      owner,
      cycle,
      defaultPoints,
      autoShowOnDatePage,
      allowAdHocReward,
      enabled: true,
      notes: "",
      createdAt,
      updatedAt: createdAt
    })),
    rewards: [
      ["周末小计划", 30, 2000, 1.5, "提前提交计划，父母确认后执行。"],
      ["大玩具基金", 90, 6000, 1.5, "胖胖主动提前计划时使用。"],
      ["父母惊喜礼物", 100, 4000, 2.5, "父母提前说好的礼物，倍率更高。"]
    ].map(([name, priceYuan, pointsRequired, exchangeRate, limitNote]) => ({
      id: id("reward"),
      name,
      imageUrl: "",
      priceYuan,
      pointsRequired,
      exchangeRate,
      enabled: true,
      limitNote,
      createdAt,
      updatedAt: createdAt
    })),
    dailyRecords: [],
    weeklyReviews: [],
    transactions: [],
    taskInstances: [],
    redemptions: [],
    allowanceLedgers: []
  };
}

function load(): PreviewStore {
  if (!existsSync(storePath)) {
    const data = defaults();
    save(data);
    return data;
  }
  let data: PreviewStore;
  try {
    data = JSON.parse(readFileSync(storePath, "utf8")) as PreviewStore;
  } catch {
    data = defaults();
    save(data);
  }
  const merged = {
    ...defaults(),
    ...data,
    settings: { ...defaults().settings, ...data.settings }
  };
  if (!merged.templates.some((item) => item.type === "random_task")) {
    merged.templates = merged.templates.concat(defaults().templates.filter((item) => item.type === "random_task"));
  }
  merged.templates = merged.templates.map((item) => item.type === "random_task" ? { ...item, defaultPoints: 100 } : item);
  return merged;
}

function save(data: PreviewStore) {
  writeFileSync(storePath, JSON.stringify(data, null, 2), "utf8");
}

function balance(data: PreviewStore) {
  return data.transactions.reduce((sum, item) => sum + (item.direction === "income" ? item.points : -item.points), 0);
}

function withOperator(item: Record<string, any>, data: PreviewStore) {
  const operator = data.users.find((user) => user.id === item.operatorId);
  return { ...item, operator };
}

function calendarDays(data: PreviewStore, month: string) {
  const dayMap = new Map<string, { date: string; points: number; net: number; hasNote: boolean }>();
  for (const record of data.dailyRecords.filter((item) => item.date.startsWith(month))) {
    dayMap.set(record.date, {
      date: record.date,
      points: record.dailyPoints,
      net: 0,
      hasNote: Boolean(record.dynamicNote)
    });
  }
  for (const transaction of data.transactions.filter((item) => item.createdAt.startsWith(month))) {
    const key = transaction.createdAt.slice(0, 10);
    const item = dayMap.get(key) ?? { date: key, points: 0, net: 0, hasNote: false };
    item.net += transaction.direction === "income" ? transaction.points : -transaction.points;
    dayMap.set(key, item);
  }
  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function previewLogin(username: string, password: string) {
  const account = defaultCredentials.find((item) => item.username === username && item.password === password);
  if (!account) return null;
  const data = load();
  return data.users.find((user) => user.username === username) ?? null;
}

export function getPreviewUser(userId: string) {
  const data = load();
  return data.users.find((user) => user.id === userId) ?? null;
}

export function getPreviewAppData() {
  const data = load();
  const today = startOfLocalDay(new Date());
  const todayKey = toDateKey(today);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const month = todayKey.slice(0, 7);
  const ledgerStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const todayRecord = data.dailyRecords.find((record) => record.date === todayKey) ?? null;
  const weekTransactions = data.transactions.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt >= weekStart && createdAt <= addDays(weekEnd, 1);
  });
  const weekRedemptions = data.redemptions.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt >= weekStart && createdAt <= addDays(weekEnd, 1);
  });
  const randomTaskPool = data.templates.filter((item) => item.type === "random_task" && item.enabled);
  const todayRandomTask = data.taskInstances.find((item) => item.note === "random_task" && item.targetDate === todayKey) ?? null;

  return {
    settings: data.settings,
    users: data.users,
    balance: balance(data),
    todayKey,
    week: {
      start: toDateKey(weekStart),
      end: toDateKey(weekEnd),
      income: weekTransactions.filter((item) => item.direction === "income").reduce((sum, item) => sum + item.points, 0),
      expense: weekTransactions.filter((item) => item.direction === "expense").reduce((sum, item) => sum + item.points, 0),
      allowanceBudget: data.settings.dailyAllowanceYuan * 7,
      allowanceSpent: weekRedemptions
        .filter((item) => item.type === "allowance" && item.status === "confirmed")
        .reduce((sum, item) => sum + (item.amountYuan ?? 0), 0)
    },
    rules: data.rules.sort((a, b) => a.sortOrder - b.sortOrder),
    templates: data.templates.sort((a, b) => b.defaultPoints - a.defaultPoints),
    autoTasks: data.templates.filter((item) => item.enabled && item.autoShowOnDatePage).sort((a, b) => b.defaultPoints - a.defaultPoints),
    rewards: data.rewards.filter((item) => item.enabled),
    allRewards: data.rewards,
    randomTaskPool,
    todayRandomTask,
    todayRecord,
    weeklyReview: data.weeklyReviews.find((review) => review.weekStart === toDateKey(weekStart)) ?? null,
    recentTransactions: data.transactions.slice().reverse().slice(0, 12).map((item) => withOperator(item, data)),
    ledgerTransactions: data.transactions
      .filter((item) => new Date(item.createdAt) >= ledgerStart)
      .slice()
      .reverse()
      .map((item) => withOperator(item, data)),
    pendingRedemptions: data.redemptions.filter((item) => item.status === "pending").reverse(),
    calendar: {
      month,
      days: calendarDays(data, month)
    }
  };
}

export function getPreviewDayData(dateKey: string) {
  const data = load();
  const date = parseDateKey(dateKey);
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const weekday = date.getDay();
  const weekAwardMap = new Map<string, number>();
  for (const transaction of data.transactions) {
    const createdAt = new Date(transaction.createdAt);
    if (createdAt < weekStart || createdAt >= addDays(weekEnd, 1)) continue;
    if (!["weekly_task", "temporary_task", "weekly_review"].includes(transaction.sourceType)) continue;
    if (!transaction.sourceId) continue;
    weekAwardMap.set(transaction.sourceId, (weekAwardMap.get(transaction.sourceId) ?? 0) + transaction.points);
  }
  const withWeekAward = (item: Record<string, any>) => ({
    ...item,
    weekAwardedPoints: weekAwardMap.get(item.id) ?? 0,
    weeklyCapPoints: item.defaultPoints
  });
  return {
    settings: data.settings,
    date: dateKey,
    weekday,
    record: data.dailyRecords.find((record) => record.date === dateKey) ?? null,
    weeklyReview: data.weeklyReviews.find((review) => review.weekStart === toDateKey(weekStart)) ?? null,
    weekStart: toDateKey(weekStart),
    weekEnd: toDateKey(weekEnd),
    showWeeklyReview: weekday === data.settings.weeklyReviewWeekday,
    dailyTasks: data.rules
      .filter((item) => item.enabled && item.category === "daily" && item.trigger !== "daily_floor" && item.trigger in dailyStatusFields)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((rule) => ({
        id: rule.id,
        trigger: rule.trigger,
        name: rule.name,
        points: rule.points,
        cap: rule.cap,
        description: rule.description
      })),
    weeklyTasks: data.templates.filter((item) => item.cycle === "weekly" && item.enabled).sort((a, b) => b.defaultPoints - a.defaultPoints).map(withWeekAward),
    adHocTasks: data.templates.filter((item) => item.allowAdHocReward && item.enabled && item.type !== "extra_work").sort((a, b) => b.defaultPoints - a.defaultPoints).map(withWeekAward),
    transactions: data.transactions
      .filter((item) => item.dailyRecordDate === dateKey || item.createdAt.startsWith(dateKey))
      .slice()
      .reverse()
      .map((item) => withOperator(item, data))
  };
}

export function settlePreviewDaily(input: Record<string, any>, user: Record<string, any>) {
  const data = load();
  const dateKey = input.date;
  const levels: Record<DailyTaskTrigger, DailyLevel> = {
    homework: normalizeLevel(input.levels?.homework ?? input.homework),
    preview: normalizeLevel(input.levels?.preview ?? input.preview),
    extra_homework: normalizeLevel(input.levels?.extra_homework ?? input.extra),
    attitude: normalizeLevel(input.levels?.attitude ?? input.attitude)
  };
  const taskRules = data.rules.filter((rule) => rule.enabled && rule.category === "daily" && rule.trigger !== "daily_floor" && rule.trigger in dailyStatusFields);
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
  const floorPoints = data.rules.find((rule) => rule.enabled && rule.trigger === "daily_floor")?.points || data.settings.dailyPointFloor;
  const raw = earnedDetail.reduce((sum, item) => sum + item.points, 0) + adHocPoints;
  const points = Math.min(data.settings.dailyPointCap, raw > 0 ? raw : floorPoints);
  const existing = data.dailyRecords.find((record) => record.date === dateKey);
  const statusData = Object.fromEntries(
    Object.entries(dailyStatusFields).map(([trigger, field]) => [field, levels[trigger as DailyTaskTrigger]])
  );
  const record = {
    id: existing?.id ?? id("daily"),
    date: dateKey,
    ...statusData,
    dynamicNote: appendNote(existing?.dynamicNote, input.dynamicNote, user.nickname),
    parentNote: appendNote(existing?.parentNote, input.parentNote, user.nickname),
    settlementNote: appendNote(existing?.settlementNote, input.settlementNote, user.nickname),
    dailyPoints: points,
    createdById: existing?.createdById ?? user.id,
    updatedById: user.id,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now()
  };
  data.dailyRecords = data.dailyRecords.filter((item) => item.date !== dateKey).concat(record);
  data.transactions = data.transactions.filter((item) => !(item.sourceType === "daily_settlement" && item.dailyRecordDate === dateKey));
  const detail = raw > 0
    ? earnedDetail.concat(adHocPoints ? [{ trigger: "ad_hoc", label: input.adHocTitle || "临时奖励", level: "full" as DailyLevel, points: adHocPoints }] : [])
    : [{ trigger: "daily_floor", label: "保底结算", level: "full" as DailyLevel, points: floorPoints }];
  data.transactions.push({
    id: id("tx"),
    direction: "income",
    points,
    sourceType: "daily_settlement",
    sourceId: record.id,
    dailyRecordId: record.id,
    dailyRecordDate: dateKey,
    operatorId: user.id,
    description: `${dateKey} 每日结算：${detail.map((item) => `${item.label} ${levelLabel(item.level)} +${item.points}`).join("，")}`,
    note: input.settlementNote?.trim() || null,
    createdAt: new Date(`${dateKey}T12:00:00`).toISOString()
  });
  save(data);
  return { record, points };
}

export function createPreviewManualPoint(input: Record<string, any>, user: Record<string, any>) {
  const data = load();
  const points = Math.max(0, Number(input.points || 0));
  if (!input.title?.trim()) throw new Error("请填写任务名称");
  if (points <= 0) throw new Error("积分必须大于 0");
  const transaction = {
    id: id("tx"),
    direction: "income",
    points,
    sourceType: input.sourceType,
    sourceId: input.templateId || input.date,
    operatorId: user.id,
    description: `${input.sourceType === "weekly_task" ? "周任务" : "临时任务"}：${input.title}${input.note ? `｜${input.note}` : ""}`,
    note: input.note?.trim() || null,
    createdAt: new Date(`${input.date}T12:00:00`).toISOString()
  };
  data.transactions.push(transaction);
  save(data);
  return transaction;
}

export function savePreviewWeeklyReview(input: Record<string, any>, user: Record<string, any>) {
  const data = load();
  const points = input.completed ? data.rules.find((rule) => rule.trigger === "weekly_review")?.points ?? 500 : 0;
  const existing = data.weeklyReviews.find((review) => review.weekStart === input.weekStart);
  const review = {
    id: existing?.id ?? id("review"),
    weekStart: input.weekStart,
    weekEnd: toDateKey(endOfWeek(parseDateKey(input.weekStart))),
    content: input.content,
    strengths: input.strengths,
    improvements: input.improvements,
    nextActions: input.nextActions,
    recordingUrl: input.recordingUrl,
    completed: Boolean(input.completed),
    pointsAwarded: points,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now()
  };
  data.weeklyReviews = data.weeklyReviews.filter((item) => item.weekStart !== input.weekStart).concat(review);
  data.transactions = data.transactions.filter((item) => !(item.sourceType === "weekly_review" && item.sourceId === review.id));
  if (points > 0) {
    data.transactions.push({
      id: id("tx"),
      direction: "income",
      points,
      sourceType: "weekly_review",
      sourceId: review.id,
      operatorId: user.id,
      description: "完成周复盘：看见优点，也找到下周动作",
      createdAt: new Date(`${input.weekStart}T12:00:00`).toISOString()
    });
  }
  save(data);
  return review;
}

export function createPreviewRedemption(input: Record<string, any>, user: Record<string, any>) {
  const data = load();
  let title = input.title || "兑换申请";
  let pointsCost = Number(input.pointsCost || 0);
  let amountYuan = input.amountYuan == null ? null : Number(input.amountYuan);
  let rewardId = input.rewardId || null;
  if (input.type === "plan") {
    if (!title.trim()) throw new Error("请填写许愿名称");
    if (pointsCost <= 0) throw new Error("请填写预计积分");
    const reward = {
      id: id("reward"),
      name: title,
      imageUrl: "",
      priceYuan: null,
      pointsRequired: pointsCost,
      exchangeRate: 1.5,
      enabled: true,
      limitNote: input.planText || "胖胖提交的许愿计划，后续可兑换。",
      createdAt: now(),
      updatedAt: now()
    };
    data.rewards.push(reward);
    save(data);
    return reward;
  }
  if (input.type === "allowance") {
    amountYuan = Number(input.amountYuan || 0);
    pointsCost = Math.round(amountYuan * 100);
    title = `兑换零花钱 ${amountYuan} 元`;
  }
  if (input.type === "reward" && rewardId) {
    const reward = data.rewards.find((item) => item.id === rewardId);
    if (!reward) throw new Error("礼品不存在");
    title = reward.name;
    pointsCost = reward.pointsRequired;
  }
  const redemption = {
    id: id("redeem"),
    type: input.type,
    status: "pending",
    title,
    amountYuan,
    pointsCost,
    planText: input.planText,
    rewardId,
    createdById: user.id,
    createdAt: now(),
    updatedAt: now()
  };
  data.redemptions.push(redemption);
  save(data);
  return redemption;
}

export function confirmPreviewRedemption(redemptionId: string, user: Record<string, any>) {
  const data = load();
  const redemption = data.redemptions.find((item) => item.id === redemptionId);
  if (!redemption) throw new Error("兑换记录不存在");
  if (redemption.status !== "pending") throw new Error("这条兑换已处理");
  if (balance(data) < redemption.pointsCost) throw new Error("当前积分不足，不能确认兑换");
  const transaction = {
    id: id("tx"),
    direction: "expense",
    points: redemption.pointsCost,
    sourceType: "redemption",
    sourceId: redemption.id,
    operatorId: user.id,
    description: `确认兑换：${redemption.title}`,
    createdAt: now()
  };
  data.transactions.push(transaction);
  redemption.status = "confirmed";
  redemption.confirmedById = user.id;
  redemption.confirmedAt = now();
  redemption.transactionId = transaction.id;
  redemption.updatedAt = now();
  if (redemption.type === "allowance") {
    data.allowanceLedgers.push({
      id: id("allowance"),
      redemptionId: redemption.id,
      amountYuan: redemption.amountYuan ?? redemption.pointsCost / 100,
      pointsCost: redemption.pointsCost,
      offlineProcessed: false,
      createdAt: now(),
      updatedAt: now()
    });
  }
  save(data);
  return redemption;
}

export function cancelPreviewRedemption(redemptionId: string, user: Record<string, any>) {
  const data = load();
  const redemption = data.redemptions.find((item) => item.id === redemptionId);
  if (!redemption) throw new Error("兑换记录不存在");
  redemption.status = "cancelled";
  redemption.confirmedById = user.id;
  redemption.confirmedAt = now();
  redemption.updatedAt = now();
  save(data);
  return redemption;
}

export function deletePreviewTransaction(transactionId: string) {
  const data = load();
  const transaction = data.transactions.find((item) => item.id === transactionId);
  if (!transaction) throw new Error("记录不存在");
  data.transactions = data.transactions.filter((item) => item.id !== transactionId);
  if (transaction.sourceType === "daily_settlement" && transaction.dailyRecordId) {
    const record = data.dailyRecords.find((item) => item.id === transaction.dailyRecordId);
    if (record) record.dailyPoints = 0;
  }
  save(data);
  return { ok: true };
}

export function upsertPreviewTask(input: Record<string, any>) {
  const data = load();
  const task = {
    id: input.id || id("task"),
    type: input.type || "manual",
    title: input.title,
    owner: input.owner || "family",
    cycle: input.cycle || "weekly",
    defaultPoints: Number(input.defaultPoints || 0),
    autoShowOnDatePage: Boolean(input.autoShowOnDatePage),
    allowAdHocReward: Boolean(input.allowAdHocReward),
    enabled: input.enabled ?? true,
    notes: input.notes || "",
    createdAt: input.id ? data.templates.find((item) => item.id === input.id)?.createdAt ?? now() : now(),
    updatedAt: now()
  };
  data.templates = data.templates.filter((item) => item.id !== task.id).concat(task);
  save(data);
  return task;
}

export function updatePreviewSettings(input: Record<string, any>) {
  const data = load();
  data.settings = { ...data.settings, ...input, updatedAt: now() };
  save(data);
  return data.settings;
}

export function updatePreviewRule(ruleId: string, input: Record<string, any>) {
  const data = load();
  const rule = data.rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error("规则不存在");
  Object.assign(rule, input, { updatedAt: now() });
  save(data);
  return rule;
}

export function upsertPreviewReward(input: Record<string, any>) {
  const data = load();
  const reward = {
    id: input.id || id("reward"),
    name: input.name,
    imageUrl: input.imageUrl || "",
    priceYuan: input.priceYuan,
    pointsRequired: Number(input.pointsRequired || 0),
    exchangeRate: Number(input.exchangeRate || 1.5),
    enabled: input.enabled ?? true,
    limitNote: input.limitNote || "",
    createdAt: input.id ? data.rewards.find((item) => item.id === input.id)?.createdAt ?? now() : now(),
    updatedAt: now()
  };
  data.rewards = data.rewards.filter((item) => item.id !== reward.id).concat(reward);
  save(data);
  return reward;
}

export function updatePreviewRandomTasks(names: string[]) {
  const data = load();
  const cleanNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  data.templates = data.templates.map((task) => task.type === "random_task" ? { ...task, enabled: false, updatedAt: now() } : task);
  const saved = [];
  for (const title of cleanNames) {
    const existing = data.templates.find((task) => task.type === "random_task" && task.title === title);
    const task = {
      id: existing?.id ?? id("task"),
      type: "random_task",
      title,
      owner: "pangpang",
      cycle: "active",
      defaultPoints: 100,
      autoShowOnDatePage: false,
      allowAdHocReward: false,
      enabled: true,
      notes: existing?.notes ?? "",
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now()
    };
    data.templates = data.templates.filter((item) => item.id !== task.id).concat(task);
    saved.push(task);
  }
  save(data);
  return saved;
}

export function createPreviewRandomTask(user: Record<string, any>) {
  const data = load();
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  const existing = data.taskInstances.find((item) => item.note === "random_task" && item.targetDate === todayKey);
  if (existing) return { task: existing, alreadyUsed: true };
  const pool = data.templates.filter((item) => item.type === "random_task" && item.enabled);
  if (pool.length === 0) throw new Error("还没有设置随机任务");
  const template = pool[Math.floor(Math.random() * pool.length)];
  const task = {
    id: id("instance"),
    templateId: template.id,
    title: template.title,
    owner: "pangpang",
    cycle: "active",
    points: template.defaultPoints || 100,
    status: "pending",
    targetDate: todayKey,
    weekStart: null,
    note: "random_task",
    settledById: null,
    settledAt: null,
    createdAt: now(),
    updatedAt: now()
  };
  data.taskInstances.push(task);
  save(data);
  return { task, alreadyUsed: false };
}

export function confirmPreviewRandomTask(taskId: string, user: Record<string, any>) {
  const data = load();
  const task = data.taskInstances.find((item) => item.id === taskId);
  if (!task || task.note !== "random_task") throw new Error("随机任务不存在");
  if (task.status === "completed") return { task, alreadyConfirmed: true };
  if (task.status !== "pending") throw new Error("这条随机任务已处理");
  task.status = "completed";
  task.settledById = user.id;
  task.settledAt = now();
  task.updatedAt = now();
  data.transactions.push({
    id: id("tx"),
    direction: "income",
    points: task.points || 100,
    sourceType: "random_task",
    sourceId: task.id,
    operatorId: user.id,
    description: `随机任务：${task.title}`,
    note: "每天开心一点",
    createdAt: new Date(`${task.targetDate}T12:00:00`).toISOString()
  });
  save(data);
  return { task, alreadyConfirmed: false };
}
