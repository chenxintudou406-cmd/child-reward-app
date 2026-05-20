"use client";

import {
  CalendarDays,
  Check,
  ClipboardList,
  Coins,
  Gift,
  Home,
  Info,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react";
import { FormEvent, TouchEvent, useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, any>;
type TabKey = "home" | "date" | "redeem" | "tasks" | "settings";
type TaskTab = "daily" | "weekly" | "active";
type SettingTab = "daily" | "dad" | "mom";
type EggMood = "happy" | "sad" | "expect" | "peek" | "excited";
type DailyLevel = "none" | "low" | "mid" | "full";

const navTabs: Array<{ key: TabKey; label: string; Icon: typeof Home }> = [
  { key: "home", label: "首页", Icon: Home },
  { key: "date", label: "日期", Icon: CalendarDays },
  { key: "redeem", label: "兑换", Icon: Gift },
  { key: "tasks", label: "任务", Icon: ClipboardList },
  { key: "settings", label: "设置", Icon: Settings }
];

const skinOptions = [
  { key: "sunny", label: "阳光蛋仔", shell: "from-yellow-200 via-white to-orange-100", dot: "bg-coral" },
  { key: "mint", label: "薄荷蛋仔", shell: "from-emerald-100 via-white to-sky-100", dot: "bg-mint" },
  { key: "candy", label: "糖果蛋仔", shell: "from-pink-100 via-white to-yellow-100", dot: "bg-blue" }
];

const eggMoodImages: Record<EggMood, string> = {
  happy: "/egg-moods/happy.png",
  sad: "/egg-moods/sad.png",
  expect: "/egg-moods/expect.png",
  peek: "/egg-moods/peek.png",
  excited: "/egg-moods/excited.png"
};

const settlementTagOptions = [
  "勇敢挑战",
  "主动完成",
  "坚持到底",
  "认真订正",
  "时间管理",
  "情绪稳定",
  "表达清楚",
  "帮助家人",
  "独立思考",
  "复盘改进"
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "操作失败");
  return payload;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function dateKeyFromValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function oneYearAgoKey() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function cnDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function pointsToYuan(points: number) {
  return (points / 100).toFixed(0);
}

function isWeekend(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function templateRank(task: AnyRecord) {
  if (task.owner === "mom") return 1;
  if (task.owner === "dad") return 2;
  if (task.type === "self_value" || task.owner === "pangpang") return 3;
  if (task.type === "weekly_review") return 4;
  return 5;
}

function sortManualTemplates(tasks: AnyRecord[]) {
  return tasks
    .filter((task) => task.type !== "extra_work")
    .sort((a, b) => templateRank(a) - templateRank(b) || b.defaultPoints - a.defaultPoints);
}

function normalizeDailyLevel(value: unknown): DailyLevel {
  if (value === "low" || value === "mid" || value === "full" || value === "none") return value;
  if (value === "done" || value === true) return "full";
  return "none";
}

function dailyLevelPoints(points: number, level: DailyLevel) {
  if (level === "none") return 0;
  if (level === "full") return Number(points || 0);
  const ratio = level === "low" ? 1 / 3 : 2 / 3;
  return Math.max(0, Math.round((Number(points || 0) * ratio) / 50) * 50);
}

function statusFieldForTrigger(trigger: string) {
  return ({ homework: "homeworkStatus", preview: "previewStatus", extra_homework: "extraStatus", attitude: "attitudeStatus" } as const)[trigger as "homework" | "preview" | "extra_homework" | "attitude"];
}

export default function RewardApp() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [pullStart, setPullStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  async function refresh() {
    try {
      const result = await api<AnyRecord>("/api/app");
      setData(result);
      setSelectedDate((current) => current || result.todayKey || todayKey());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
      });
      await refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setData(null);
  }

  async function refreshAll(message = "已刷新最新积分") {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
      setRefreshSignal((value) => value + 1);
      showToast(message);
    } finally {
      setRefreshing(false);
      setPullDistance(0);
      setPullStart(null);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    if (window.scrollY <= 0) setPullStart(event.touches[0].clientY);
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    if (pullStart == null || window.scrollY > 0) return;
    const distance = Math.max(0, event.touches[0].clientY - pullStart);
    setPullDistance(Math.min(96, distance));
  }

  function handleTouchEnd() {
    if (pullDistance >= 72) {
      void refreshAll();
      return;
    }
    setPullDistance(0);
    setPullStart(null);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="egg-card rounded-[28px] bg-white/80 px-6 py-5 text-center shadow-soft">
          <EggBuddy mood="expect" skin={data?.settings?.skinTheme} />
          <p className="mt-3 font-semibold">正在打开胖胖的小账本</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
        <section className="mb-6">
          <EggBuddy mood="happy" skin="sunny" size="lg" />
          <p className="mt-5 text-sm font-semibold text-coral">胖胖勇敢向前冲</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">把努力、计划和兑换放进同一本账</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">默认账号：dad / pangpang123，mom / pangpang123。</p>
        </section>
      <form onSubmit={login} className="egg-card rounded-[28px] bg-white/90 p-5 shadow-soft backdrop-blur">
          <label className="text-sm font-bold">登录名</label>
          <input name="username" defaultValue="dad" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-mint" />
          <label className="mt-4 block text-sm font-bold">密码</label>
          <input name="password" type="password" defaultValue="pangpang123" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-mint" />
          {loginError && <p className="mt-3 text-sm font-semibold text-coral">{loginError}</p>}
          <button className="egg-button mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
            <Check size={18} />
            进入
          </button>
        </form>
      </main>
    );
  }

  const active = navTabs.find((item) => item.key === tab) ?? navTabs[0];
  const pageProps = { data, refresh, showToast };

  return (
    <main
      className={`park-screen egg-party-bg mx-auto min-h-screen max-w-md px-4 pb-28 pt-4 ${skinBackground(data.settings?.skinTheme)}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 8 || refreshing) && (
        <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-black text-ink shadow-soft">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "正在刷新" : pullDistance >= 72 ? "松手刷新" : "下拉刷新"}
        </div>
      )}
      <header className="park-header mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => refreshAll()} className="rounded-full" aria-label="刷新积分数据">
            <EggBuddy mood="happy" skin={data.settings?.skinTheme} size="sm" className={refreshing ? "animate-spin" : ""} />
          </button>
          <div>
            <p className="text-xs font-bold text-coral">胖胖勇敢向前冲</p>
            <h1 className="text-xl font-black tracking-normal">{active.label}</h1>
          </div>
        </div>
        <button type="button" onClick={logout} className="park-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft" aria-label="退出登录">
          <LogOut size={18} />
        </button>
      </header>
      {tab === "home" && <HomePage {...pageProps} setTab={setTab} setSelectedDate={setSelectedDate} />}
      {tab === "date" && <DatePage {...pageProps} selectedDate={selectedDate} setSelectedDate={setSelectedDate} refreshSignal={refreshSignal} />}
      {tab === "redeem" && <RedeemPage {...pageProps} />}
      {tab === "tasks" && <TasksPage {...pageProps} />}
      {tab === "settings" && <SettingsPage {...pageProps} />}

      {toast && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-soft slide-up">
          {toast}
        </div>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4">
        <div className="park-nav egg-card grid grid-cols-5 gap-1 rounded-[26px] border border-white/70 bg-white/95 p-2 shadow-soft backdrop-blur">
          {navTabs.map(({ key, label, Icon }) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`park-tab flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition ${
                tab === key ? "park-tab-active bg-ink text-white" : "park-tab-idle text-slate-500"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function HomePage({
  data,
  refresh,
  showToast,
  setTab,
  setSelectedDate
}: {
  data: AnyRecord;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
  setTab: (tab: TabKey) => void;
  setSelectedDate: (date: string) => void;
}) {
  const [randomBusy, setRandomBusy] = useState(false);
  const [randomResult, setRandomResult] = useState<AnyRecord | null>(data.todayRandomTask ?? null);
  const [randomReveal, setRandomReveal] = useState(false);
  const settledToday = Boolean(data.todayRecord);
  const excellentToday = settledToday && !isWeekend(data.todayKey) && Number(data.todayRecord.dailyPoints) >= 1000;
  const calendarMap = new Map<string, AnyRecord>((data.calendar?.days ?? []).map((day: AnyRecord) => [day.date, day]));
  const days = useMemo(() => {
    const [year, month] = String(data.calendar?.month ?? todayKey().slice(0, 7)).split("-").map(Number);
    const count = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const realDays = Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
      return {
        type: "day" as const,
        day,
        date,
        record: calendarMap.get(date),
        isSaturday: new Date(`${date}T00:00:00`).getDay() === 6,
        isExcellent: !isWeekend(date) && Number(calendarMap.get(date)?.points ?? 0) >= 1000
      };
    });
    return [
      ...Array.from({ length: leadingBlanks }, (_, index) => ({ type: "blank" as const, key: `blank-${index}` })),
      ...realDays
    ];
  }, [data.calendar?.month, data.calendar?.days]);

  function openDate(date: string) {
    setSelectedDate(date);
    setTab("date");
  }

  useEffect(() => {
    setRandomResult(data.todayRandomTask ?? null);
  }, [data.todayRandomTask]);

  async function drawRandomTask() {
    if (randomBusy) return;
    setRandomBusy(true);
    setRandomReveal(true);
    try {
      const result = await api<AnyRecord>("/api/random-task", { method: "POST" });
      setRandomResult(result.task);
      showToast(result.alreadyUsed ? "今天已经使用完毕，每天开心一点" : "随机任务来了，每天开心一点");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "抽取失败");
    } finally {
      window.setTimeout(() => setRandomReveal(false), 1300);
      setRandomBusy(false);
    }
  }

  async function confirmRandomTask(id: string) {
    try {
      const result = await api<AnyRecord>("/api/random-task", {
        method: "PATCH",
        body: JSON.stringify({ id })
      });
      setRandomResult(result.task);
      showToast(result.alreadyConfirmed ? "这个随机任务已经确认过了" : "随机任务确认完成，+100 积分");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "确认失败");
    }
  }

  return (
    <div className="park-home space-y-4">
      {randomReveal && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-white/25 backdrop-blur-[2px]">
          <div className="random-task-burst flex h-52 w-52 flex-col items-center justify-center rounded-full bg-sunny text-center shadow-soft">
            <EggBuddy mood="excited" size="xl" />
            <p className="mt-2 text-sm font-black text-ink">随机任务抽取中</p>
          </div>
        </div>
      )}
      <section className="park-balance-card egg-card relative overflow-hidden rounded-[30px] p-5 shadow-soft">
        <div className="park-ticket-dots" />
        <div className="park-coin-glow absolute -right-8 -top-8 h-32 w-32 rounded-full" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="park-eyebrow text-sm">乐园金币账户</p>
            <p className="number-pop mt-2 text-5xl font-black tracking-normal">{data.balance}</p>
            <p className="mt-1 text-sm text-white/85">约等于 {pointsToYuan(data.balance)} 元基础价值</p>
          </div>
          <button type="button" onClick={drawRandomTask} className="rounded-full outline-none" aria-label="抽取今日随机任务">
            <EggBuddy mood="excited" skin={data.settings?.skinTheme} size="lg" className={`park-hero-buddy ${randomBusy ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="park-stat-grid mt-5 grid grid-cols-2 gap-2 text-center">
          <MiniStat label="本周收入" value={`+${data.week.income}`} />
          <MiniStat label="本周支出" value={`-${data.week.expense}`} />
        </div>
      </section>

      {randomResult && (
        <section className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur slide-up">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-coral">今日随机任务</p>
              <h2 className="mt-1 text-lg font-black">{randomResult.title}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">{randomResult.status === "completed" ? "已确认得分" : "完成后确认，奖励 100 积分"}</p>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-sm font-black">+100</span>
          </div>
          {randomResult.status !== "completed" && (
            <button type="button" onClick={() => confirmRandomTask(randomResult.id)} className="egg-button mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
              <Check size={18} />
              确认完成
            </button>
          )}
        </section>
      )}

      <section className="park-status-card egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-coral">今日活动</p>
            <h2 className="mt-1 text-lg font-black">{settledToday ? `今天已得 ${data.todayRecord.dailyPoints} 分` : "今天待结算"}</h2>
            {excellentToday && <p className="mt-1 inline-flex rounded-full bg-sunny px-2 py-1 text-xs font-black text-ink">优秀日</p>}
          </div>
          <button type="button" onClick={() => openDate(data.todayKey)} className="park-primary-button rounded-2xl bg-mint px-4 py-2 text-sm font-bold text-ink">
            进入日期
          </button>
        </div>
      </section>

      <section className="park-calendar-card egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">本月日历</h2>
          <span className="text-xs font-bold text-slate-500">{data.calendar?.month}</span>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-black text-slate-500">
          {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((item) => {
            if (item.type === "blank") {
              return <div key={item.key} className="aspect-square rounded-xl bg-transparent" aria-hidden="true" />;
            }
            const net = item.record?.net ?? 0;
            return (
              <button
                type="button"
                key={item.date}
                onClick={() => openDate(item.date)}
                className={`park-day relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-black ${
                  item.isSaturday
                    ? "border-2 border-orange-300 bg-orange-100 text-orange-700"
                    : item.record
                      ? "bg-mint text-ink"
                      : item.date === data.todayKey
                        ? "bg-sunny/60"
                        : "bg-slate-50"
                }`}
              >
                <span>{item.day}</span>
                {net !== 0 && <span className={net > 0 ? "text-[10px] text-emerald-700" : "text-[10px] text-coral"}>{net > 0 ? `+${net}` : net}</span>}
                {item.isSaturday && <span className="absolute bottom-1 rounded-full bg-orange-400 px-1 text-[9px] leading-3 text-white">结算</span>}
                {item.isExcellent && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">橙色是周六复盘/结算日；红点代表非周末优秀日。</p>
      </section>

      <FilterableLedger transactions={data.ledgerTransactions ?? data.recentTransactions ?? []} refresh={refresh} showToast={showToast} />
    </div>
  );
}

function DatePage({
  data,
  refresh,
  showToast,
  selectedDate,
  setSelectedDate,
  refreshSignal
}: {
  data: AnyRecord;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  refreshSignal: number;
}) {
  const [date, setDate] = useState(selectedDate || data.todayKey || todayKey());
  const [day, setDay] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});
  const [selectedSettlementTags, setSelectedSettlementTags] = useState<string[]>([]);
  const [dateSection, setDateSection] = useState<"settlement" | "tasks" | "records">("settlement");
  const [burst, setBurst] = useState("");
  const [moodBurst, setMoodBurst] = useState("");

  useEffect(() => {
    if (selectedDate && selectedDate !== date) setDate(selectedDate);
  }, [selectedDate]);

  async function loadDay(target = date) {
    setDay(await api(`/api/day/${target}`));
  }

  useEffect(() => {
    setSelectedDate(date);
    loadDay(date).catch(() => null);
  }, [date]);

  useEffect(() => {
    if (refreshSignal > 0) loadDay(date).catch(() => null);
  }, [refreshSignal]);

  function jumpToDateSection(section: "settlement" | "tasks" | "records") {
    setDateSection(section);
    window.setTimeout(() => {
      document.getElementById(`date-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  function toggleSettlementTag(tag: string) {
    setSelectedSettlementTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : current.concat(tag)
    );
  }

  async function settle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = event.currentTarget;
    const dataForm = new FormData(form);
    const rawSettlementNote = String(dataForm.get("settlementNote") || "").trim();
    const tagText = selectedSettlementTags.length ? `标签：${selectedSettlementTags.join("、")}` : "";
    const settlementNote = [tagText, rawSettlementNote].filter(Boolean).join("\n");
    try {
      const result = await api<AnyRecord>(`/api/day/${date}`, {
        method: "POST",
        body: JSON.stringify({
          levels: Object.fromEntries((day?.dailyTasks ?? []).map((task: AnyRecord) => [task.trigger, dataForm.get(`level-${task.trigger}`) || "none"])),
          dynamicNote: dataForm.get("dynamicNote") || "",
          parentNote: dataForm.get("parentNote") || "",
          settlementNote
        })
      });
      setBurst(`+${result.points}`);
      showToast(`已更新为 ${result.points} 积分`);
      setSelectedSettlementTags([]);
      await Promise.all([loadDay(), refresh()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "结算失败");
    } finally {
      window.setTimeout(() => setBurst(""), 1200);
      setBusy(false);
    }
  }

  const templates = sortManualTemplates(day?.adHocTasks ?? []);
  const selectedTemplate = templates.find((task) => task.id === selectedTemplateId);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualBusy) return;
    setManualBusy(true);
    const form = event.currentTarget;
    const dataForm = new FormData(form);
    const taskId = String(dataForm.get("taskId") ?? "");
    const sourceType = String(dataForm.get("sourceType") ?? "");
    const template = templates.find((task) => task.id === taskId);
    try {
      const result = await api<AnyRecord>("/api/points/manual", {
        method: "POST",
        body: JSON.stringify({
          date,
          sourceType,
          templateId: taskId && taskId !== "other" ? taskId : undefined,
          title: dataForm.get("title") || template?.title,
          points: dataForm.get("points") || template?.defaultPoints,
          note: dataForm.get("note") || ""
        })
      });
      setBurst(`+${result.points}`);
      if (sourceType === "temporary_task") setMoodBurst("临时奖励到账");
      form.reset();
      setSelectedTemplateId("");
      showToast("任务积分已发放");
      await Promise.all([loadDay(), refresh()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "发放失败");
    } finally {
      window.setTimeout(() => setBurst(""), 1200);
      window.setTimeout(() => setMoodBurst(""), 1700);
      setManualBusy(false);
    }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/weekly-review", {
        method: "POST",
        body: JSON.stringify({
          weekStart: day?.weekStart,
          content: form.get("content"),
          strengths: form.get("strengths"),
          improvements: form.get("improvements"),
          nextActions: form.get("nextActions"),
          recordingUrl: form.get("recordingUrl"),
          completed: form.get("completed") === "on"
        })
      });
      showToast("周复盘已保存");
      await Promise.all([loadDay(), refresh()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  const record = day?.record;

  return (
    <div className="relative space-y-4">
      {burst && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-sunny px-5 py-2 text-2xl font-black text-ink shadow-soft number-pop">
          <EggBuddy mood="excited" size="sm" />
          {burst}
        </div>
      )}
      {moodBurst && <MoodFlipEffect text={moodBurst} />}
      <section className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <label className="text-sm font-bold text-slate-500">选择日期</label>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-mint" />
      </section>

      <nav className="egg-card sticky top-24 z-30 grid grid-cols-3 gap-2 rounded-[24px] bg-white/95 p-2 shadow-soft backdrop-blur">
        {[
          ["settlement", "结算"],
          ["tasks", "任务"],
          ["records", "记录"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => jumpToDateSection(key as "settlement" | "tasks" | "records")}
            className={`rounded-2xl px-3 py-2 text-sm font-black ${dateSection === key ? "bg-ink text-white" : "bg-slate-50 text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <form id="date-settlement" onSubmit={settle} className="scroll-mt-36 egg-card space-y-4 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">{cnDate(date)}</p>
            <h2 className="text-lg font-black">每日结算</h2>
          </div>
          {record && <span className="rounded-full bg-mint px-3 py-1 text-sm font-black">当前 {record.dailyPoints}</span>}
        </div>
        <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
          每日积分是覆盖更新；未完成、1/3、2/3、完成都可用于复盘。
        </p>
        <div className="grid gap-2">
          {(day?.dailyTasks ?? []).map((task: AnyRecord) => {
            const field = statusFieldForTrigger(task.trigger);
            const level = normalizeDailyLevel(field ? record?.[field] : "none");
            return (
              <DailyScoreRow
                key={task.id}
                task={task}
                defaultLevel={level}
                expanded={Boolean(expandedRules[task.id])}
                onToggle={() => setExpandedRules((current) => ({ ...current, [task.id]: !current[task.id] }))}
              />
            );
          })}
        </div>
        <TextArea name="dynamicNote" label="新增胖胖日常动态（可不填）" />
        <TextArea name="parentNote" label="新增父母备注（可不填）" />
        <div>
          <p className="mb-2 text-sm font-bold text-slate-500">本次奖励标签（可多选）</p>
          <div className="grid grid-cols-2 gap-2">
            {settlementTagOptions.map((tag) => {
              const active = selectedSettlementTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleSettlementTag(tag)}
                  className={`rounded-2xl px-3 py-2 text-sm font-black ${active ? "bg-mint text-ink shadow-soft" : "bg-slate-50 text-slate-500"}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <TextArea name="settlementNote" label="本次发放备注（可不填）" />
        <NoteArchive title="已存日常动态" value={record?.dynamicNote} />
        <NoteArchive title="已存父母备注" value={record?.parentNote} />
        <NoteArchive title="已存结算备注" value={record?.settlementNote} />
        <button disabled={busy} className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
          <Sparkles size={18} />
          {busy ? "更新中" : "发放每日积分"}
        </button>
      </form>

      <form id="date-tasks" onSubmit={submitManual} className="scroll-mt-36 egg-card space-y-3 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <h2 className="font-black">临时/周任务提交</h2>
        <div className="grid grid-cols-2 gap-2">
          <select name="sourceType" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint">
            <option value="weekly_task">周任务</option>
            <option value="temporary_task">临时任务</option>
          </select>
          <select name="taskId" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint">
            <option value="">选择模板</option>
            {templates.map((task: AnyRecord) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
            <option value="other">其他</option>
          </select>
        </div>
        {selectedTemplate && (
          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
            本周该模板已发放 {selectedTemplate.weekAwardedPoints ?? 0} / {selectedTemplate.weeklyCapPoints ?? selectedTemplate.defaultPoints} 分
          </p>
        )}
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input name="title" placeholder={selectedTemplate ? selectedTemplate.title : "任务名称"} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
          <input name="points" type="number" min="1" placeholder={selectedTemplate ? String(selectedTemplate.defaultPoints) : "积分"} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        </div>
        <input name="note" placeholder="说明" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <button disabled={manualBusy} className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-sunny px-4 py-3 font-bold">
          <Plus size={18} />
          {manualBusy ? "发放中" : "发放任务积分"}
        </button>
      </form>

      {day?.showWeeklyReview && (
        <form onSubmit={saveReview} className="space-y-3 rounded-[24px] bg-orange-50 p-4 shadow-soft slide-up">
          <div>
            <p className="text-sm font-bold text-orange-700">周六结算日</p>
            <h2 className="text-lg font-black">今天适合做周复盘</h2>
          </div>
          <TextArea name="content" label="这周发生了什么" defaultValue={day.weeklyReview?.content} />
          <TextArea name="strengths" label="做得好的地方" defaultValue={day.weeklyReview?.strengths} />
          <TextArea name="improvements" label="下次可以更好的地方" defaultValue={day.weeklyReview?.improvements} />
          <TextArea name="nextActions" label="下周一个小动作" defaultValue={day.weeklyReview?.nextActions} />
          <input name="recordingUrl" placeholder="录音链接" defaultValue={day.weeklyReview?.recordingUrl ?? ""} className="w-full rounded-2xl border border-orange-200 bg-white px-3 py-3 outline-none focus:border-orange-400" />
          <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm font-bold">
            <input name="completed" type="checkbox" defaultChecked={day.weeklyReview?.completed} />
            已完成复盘并发放周复盘积分
          </label>
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 px-4 py-3 font-bold text-ink">
            <Save size={18} />
            保存周复盘
          </button>
        </form>
      )}

      <div id="date-records" className="scroll-mt-36">
        <LedgerList transactions={day?.transactions ?? []} title="当天记录" refresh={refresh} reload={loadDay} showToast={showToast} />
      </div>
    </div>
  );
}

function RedeemPage({ data, refresh, showToast }: { data: AnyRecord; refresh: () => Promise<void>; showToast: (message: string) => void }) {
  const [burst, setBurst] = useState("");
  const [moodBurst, setMoodBurst] = useState("");

  async function create(body: AnyRecord, message = "已提交，等待父母确认后扣分") {
    try {
      await api("/api/redemptions", { method: "POST", body: JSON.stringify(body) });
      setBurst(body.type === "plan" ? "许愿成功" : "提交成功");
      showToast(message);
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "提交失败");
    } finally {
      window.setTimeout(() => setBurst(""), 1200);
    }
  }

  async function handleRedemption(id: string, action: "confirm" | "cancel", pointsCost = 0) {
    try {
      await api(`/api/redemptions/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      setBurst(action === "confirm" ? "兑换成功" : "");
      if (action === "confirm" && pointsCost >= 3000) setMoodBurst("大件愿望达成");
      showToast(action === "confirm" ? "已确认并扣除积分" : "已取消兑换");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "处理失败");
    } finally {
      window.setTimeout(() => setBurst(""), 1200);
      window.setTimeout(() => setMoodBurst(""), 1700);
    }
  }

  return (
    <div className="relative space-y-4">
      {burst && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-sunny px-5 py-2 text-xl font-black text-ink shadow-soft number-pop">
          <EggBuddy mood={burst.includes("成功") ? "excited" : "expect"} size="sm" />
          {burst}
        </div>
      )}
      {moodBurst && <MoodFlipEffect text={moodBurst} />}
      <section className="park-shop-card egg-card rounded-[30px] bg-white/90 p-5 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-coral">乐园兑换站</p>
            <p className="number-pop mt-2 text-4xl font-black">{data.balance} 分</p>
            <p className="mt-1 text-sm font-bold text-slate-500">本周已花 {data.week.expense} 分</p>
          </div>
          <EggBuddy mood="expect" size="md" />
        </div>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const dataForm = new FormData(form);
          create({ type: "allowance", amountYuan: Number(dataForm.get("amountYuan")) });
          form.reset();
        }}
        className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur"
      >
        <h2 className="font-black">兑换零花钱</h2>
        <p className="mt-1 text-sm text-slate-500">100 积分 = 1 元，确认后父母线下处理。</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input name="amountYuan" type="number" min="1" placeholder="金额" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
          <button className="rounded-2xl bg-mint px-4 py-3 font-bold">提交</button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="px-1 font-black">许愿池 / 可兑换礼品</h2>
        {(data.rewards ?? []).map((reward: AnyRecord) => (
          <div key={reward.id} className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{reward.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{reward.limitNote || "父母确认后兑换"}</p>
                <p className="mt-2 font-black text-coral">{reward.pointsRequired} 分</p>
              </div>
              <button type="button" onClick={() => create({ type: "reward", rewardId: reward.id })} className="egg-button rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white">
                兑换
              </button>
            </div>
          </div>
        ))}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const dataForm = new FormData(form);
          create(
            { type: "plan", title: dataForm.get("title"), pointsCost: Number(dataForm.get("pointsCost")), planText: dataForm.get("planText") },
            "已加入许愿池，后续可兑换"
          );
          form.reset();
        }}
        className="egg-card space-y-3 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur"
      >
        <h2 className="font-black">新增许愿</h2>
        <input name="title" placeholder="想要什么" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <input name="pointsCost" type="number" min="1" placeholder="预计需要积分" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <TextArea name="planText" label="为什么想要 / 什么时候兑换" />
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sunny px-4 py-3 font-bold">
          <Plus size={18} />
          加入许愿池
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="px-1 font-black">待确认兑换</h2>
        {(data.pendingRedemptions ?? []).length === 0 && <EmptyText text="现在没有待确认兑换。" />}
        {(data.pendingRedemptions ?? []).map((item: AnyRecord) => (
          <div key={item.id} className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
            <h3 className="font-black">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-500">需要 {item.pointsCost} 积分</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handleRedemption(item.id, "cancel", item.pointsCost)} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold">取消</button>
              <button type="button" onClick={() => handleRedemption(item.id, "confirm", item.pointsCost)} className="rounded-2xl bg-coral px-3 py-2 text-sm font-bold text-white">确认扣分</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function TasksPage({ data, refresh, showToast }: { data: AnyRecord; refresh: () => Promise<void>; showToast: (message: string) => void }) {
  const [taskTab, setTaskTab] = useState<TaskTab>("daily");
  const visibleTasks = (data.templates ?? [])
    .filter((task: AnyRecord) => task.cycle === taskTab && task.type !== "random_task")
    .sort((a: AnyRecord, b: AnyRecord) => b.defaultPoints - a.defaultPoints);

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dataForm = new FormData(form);
    const cycle = String(dataForm.get("cycle") || taskTab) as TaskTab;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: dataForm.get("title"),
          type: cycle === "active" ? "temporary" : cycle,
          owner: dataForm.get("owner"),
          cycle,
          defaultPoints: dataForm.get("defaultPoints"),
          autoShowOnDatePage: cycle === "daily" || dataForm.get("autoShowOnDatePage") === "on",
          allowAdHocReward: cycle !== "daily" || dataForm.get("allowAdHocReward") === "on",
          notes: dataForm.get("notes")
        })
      });
      form.reset();
      setTaskTab(cycle);
      showToast("任务已保存");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <div className="space-y-4">
      <Segmented
        value={taskTab}
        onChange={(value) => setTaskTab(value as TaskTab)}
        options={[
          ["daily", "日任务"],
          ["weekly", "周任务"],
          ["active", "临时任务"]
        ]}
      />
      <form onSubmit={saveTask} className="egg-card space-y-3 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <h2 className="font-black">新增任务模板</h2>
        <input name="title" required placeholder="任务名称" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <div className="grid grid-cols-2 gap-2">
          <select name="cycle" defaultValue={taskTab} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint">
            <option value="daily">日任务</option>
            <option value="weekly">周任务</option>
            <option value="active">临时任务</option>
          </select>
          <select name="owner" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint">
            <option value="pangpang">胖胖</option>
            <option value="dad">爸爸</option>
            <option value="mom">妈妈</option>
            <option value="family">全家</option>
          </select>
        </div>
        <input name="defaultPoints" type="number" min="0" placeholder="默认积分 / 周上限" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold">
          <input name="autoShowOnDatePage" type="checkbox" />
          日期页自动显示
        </label>
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold">
          <input name="allowAdHocReward" type="checkbox" defaultChecked />
          可用于临时/周任务发放
        </label>
        <TextArea name="notes" label="说明" />
        <button className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
          <Save size={18} />
          保存任务
        </button>
      </form>
      <section className="space-y-3">
        {visibleTasks.map((task: AnyRecord) => (
          <div key={task.id} className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{task.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{cycleText(task.cycle)} · {ownerText(task.owner)}</p>
              </div>
              <span className="rounded-full bg-mint/70 px-2 py-1 text-xs font-black">+{task.defaultPoints}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">
              {task.autoShowOnDatePage ? "日期页显示" : "手动选择"} · {task.allowAdHocReward ? "可发放" : "固定模板"}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function SettingsPage({ data, refresh, showToast }: { data: AnyRecord; refresh: () => Promise<void>; showToast: (message: string) => void }) {
  const [settingTab, setSettingTab] = useState<SettingTab>("daily");
  const filteredRules = (data.rules ?? []).filter((rule: AnyRecord) => {
    if (settingTab === "daily") return rule.category === "daily";
    if (settingTab === "dad") return String(rule.name).includes("爸爸") || String(rule.description ?? "").includes("爸爸");
    return String(rule.name).includes("妈妈") || String(rule.description ?? "").includes("妈妈");
  });

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/settings", { method: "PATCH", body: JSON.stringify(Object.fromEntries(form.entries())) });
      showToast("设置已保存");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function saveRule(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          kind: "rule",
          id,
          name: form.get("name"),
          points: form.get("points"),
          cap: form.get("cap"),
          enabled: form.get("enabled") === "on",
          description: form.get("description")
        })
      });
      showToast("规则已保存");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function saveReward(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const dataForm = new FormData(form);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          kind: "reward",
          id,
          name: dataForm.get("name"),
          priceYuan: dataForm.get("priceYuan"),
          pointsRequired: dataForm.get("pointsRequired"),
          exchangeRate: dataForm.get("exchangeRate"),
          imageUrl: dataForm.get("imageUrl"),
          limitNote: dataForm.get("limitNote"),
          enabled: dataForm.get("enabled") === "on"
        })
      });
      if (!id) form.reset();
      showToast("兑换模板已保存");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function saveRandomTasks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dataForm = new FormData(form);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          kind: "randomTasks",
          names: String(dataForm.get("randomTasks") ?? "")
        })
      });
      showToast("随机任务已保存");
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  const settings = data.settings;
  return (
    <div className="space-y-4">
      <form onSubmit={saveSettings} className="egg-card space-y-3 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
        <h2 className="font-black">家庭基础设置</h2>
        <NumberField name="monthlyBudgetYuan" label="月预算上限" value={settings.monthlyBudgetYuan} />
        <NumberField name="dailyAllowanceYuan" label="每日零花钱" value={settings.dailyAllowanceYuan} />
        <NumberField name="dailyPointFloor" label="每日保底积分" value={settings.dailyPointFloor} />
        <NumberField name="dailyPointCap" label="每日积分上限" value={settings.dailyPointCap} />
        <NumberField name="savingRewardPoints" label="存钱计划奖励" value={settings.savingRewardPoints} />
        <NumberField name="weeklyReviewWeekday" label="周复盘星期" value={settings.weeklyReviewWeekday} />
        <input name="assetImageUrl" defaultValue={settings.assetImageUrl ?? ""} placeholder="授权蛋仔图片 URL" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <div>
          <p className="mb-2 text-sm font-bold text-slate-500">蛋仔背景皮肤</p>
          <div className="grid grid-cols-3 gap-2">
            {skinOptions.map((skin) => (
              <label key={skin.key} className="rounded-2xl bg-slate-50 p-2 text-center text-xs font-black">
                <input className="sr-only" name="skinTheme" type="radio" value={skin.key} defaultChecked={(settings.skinTheme ?? "sunny") === skin.key} />
                <span className={`mx-auto mb-2 block h-10 w-10 rounded-[45%] bg-gradient-to-br ${skin.shell}`} />
                {skin.label}
              </label>
            ))}
          </div>
        </div>
        <button className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
          <Save size={18} />
          保存基础设置
        </button>
      </form>

      <Segmented
        value={settingTab}
        onChange={(value) => setSettingTab(value as SettingTab)}
        options={[
          ["daily", "每日"],
          ["dad", "爸爸任务"],
          ["mom", "妈妈任务"]
        ]}
      />
      <section className="space-y-3">
        <h2 className="px-1 font-black">积分规则</h2>
        {filteredRules.length === 0 && <EmptyText text="这个标签下暂时没有规则，可先在任务页维护模板。" />}
        {filteredRules.map((rule: AnyRecord) => (
          <form key={rule.id} onSubmit={(event) => saveRule(event, rule.id)} className="egg-card space-y-2 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
            <input name="name" defaultValue={rule.name} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none focus:border-mint" />
            <div className="grid grid-cols-2 gap-2">
              <input name="points" type="number" defaultValue={rule.points} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
              <input name="cap" type="number" defaultValue={rule.cap ?? ""} placeholder="上限" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
            </div>
            <textarea name="description" defaultValue={rule.description ?? ""} className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-mint" />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-bold"><input name="enabled" type="checkbox" defaultChecked={rule.enabled} />启用</label>
              <button className="rounded-2xl bg-sunny px-4 py-2 text-sm font-bold">保存</button>
            </div>
          </form>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="px-1 font-black">兑换模板</h2>
        <form onSubmit={(event) => saveReward(event)} className="egg-card space-y-2 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
          <h3 className="font-black">新增兑换模板</h3>
          <input name="name" required placeholder="礼品名称" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none focus:border-mint" />
          <div className="grid grid-cols-2 gap-2">
            <input name="priceYuan" type="number" min="0" placeholder="参考金额" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
            <input name="pointsRequired" required type="number" min="1" placeholder="所需积分" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
          </div>
          <input name="exchangeRate" type="number" min="0" step="0.1" defaultValue="1.5" placeholder="兑换倍率" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
          <input name="imageUrl" placeholder="图片 URL" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
          <TextArea name="limitNote" label="兑换说明" />
          <label className="flex items-center gap-2 text-sm font-bold"><input name="enabled" type="checkbox" defaultChecked />启用</label>
          <button className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
            <Plus size={18} />
            新增模板
          </button>
        </form>
        {(data.allRewards ?? data.rewards ?? []).map((reward: AnyRecord) => (
          <form key={reward.id} onSubmit={(event) => saveReward(event, reward.id)} className="egg-card space-y-2 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
            <input name="name" defaultValue={reward.name} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none focus:border-mint" />
            <div className="grid grid-cols-2 gap-2">
              <input name="priceYuan" type="number" min="0" defaultValue={reward.priceYuan ?? ""} placeholder="参考金额" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
              <input name="pointsRequired" type="number" min="1" defaultValue={reward.pointsRequired} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
            </div>
            <input name="exchangeRate" type="number" min="0" step="0.1" defaultValue={reward.exchangeRate ?? 1.5} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
            <input name="imageUrl" defaultValue={reward.imageUrl ?? ""} placeholder="图片 URL" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
            <textarea name="limitNote" defaultValue={reward.limitNote ?? ""} className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-mint" />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-bold"><input name="enabled" type="checkbox" defaultChecked={reward.enabled} />启用</label>
              <button className="rounded-2xl bg-sunny px-4 py-2 text-sm font-bold">保存</button>
            </div>
          </form>
        ))}
      </section>

      <section className="space-y-3">
        <form onSubmit={saveRandomTasks} className="egg-card space-y-3 rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
          <div>
            <h2 className="font-black">随机任务池</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">每行一个任务名称；首页点击账户侧胖仔每天随机抽 1 次。</p>
          </div>
          <textarea
            name="randomTasks"
            defaultValue={(data.randomTaskPool ?? []).map((task: AnyRecord) => task.title).join("\n")}
            className="min-h-56 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-mint"
          />
          <button className="egg-button flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-bold text-white">
            <Save size={18} />
            保存随机任务
          </button>
        </form>
      </section>
    </div>
  );
}

function FilterableLedger({ transactions, refresh, showToast }: { transactions: AnyRecord[]; refresh: () => Promise<void>; showToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [from, setFrom] = useState(oneYearAgoKey());
  const [to, setTo] = useState(todayKey());
  const filtered = transactions.filter((item) => {
    const date = dateKeyFromValue(item.createdAt);
    const text = `${item.description ?? ""} ${item.sourceType ?? ""} ${item.operator?.nickname ?? ""}`.toLowerCase();
    return date >= from && date <= to && (direction === "all" || item.direction === direction) && text.includes(query.toLowerCase());
  });

  return (
    <section className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Search size={18} />
        <h2 className="font-black">积分明细</h2>
      </div>
      <div className="grid gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索说明/来源/操作者" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
        <div className="grid grid-cols-3 gap-2">
          <select value={direction} onChange={(event) => setDirection(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-sm outline-none focus:border-mint">
            <option value="all">全部</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-sm outline-none focus:border-mint" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-sm outline-none focus:border-mint" />
        </div>
      </div>
      <div className="mt-3">
        <LedgerRows transactions={filtered} refresh={refresh} showToast={showToast} />
      </div>
    </section>
  );
}

function LedgerList({ transactions, title, refresh, reload, showToast }: { transactions: AnyRecord[]; title: string; refresh: () => Promise<void>; reload?: () => Promise<void>; showToast: (message: string) => void }) {
  return (
    <section className="egg-card rounded-[24px] bg-white/90 p-4 shadow-soft backdrop-blur">
      <h2 className="mb-3 font-black">{title}</h2>
      <LedgerRows transactions={transactions} refresh={refresh} reload={reload} showToast={showToast} />
    </section>
  );
}

function LedgerRows({ transactions, refresh, reload, showToast }: { transactions: AnyRecord[]; refresh: () => Promise<void>; reload?: () => Promise<void>; showToast: (message: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  async function remove(id: string) {
    try {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      showToast("记录已删除，积分已取消");
      await Promise.all([refresh(), reload?.()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败");
    }
  }

  if (transactions.length === 0) return <EmptyText text="还没有记录。" />;
  return (
    <div className="space-y-2">
      {transactions.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{item.description}</p>
            {item.note && <p className="mt-1 line-clamp-1 text-xs font-bold text-coral">备注：{item.note}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}
              {item.operator?.nickname ? ` · ${item.operator.nickname}` : ""}
            </p>
            <button type="button" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))} className="mt-2 text-xs font-black text-slate-500">
              {expanded[item.id] ? "收起详情" : "查看详情"}
            </button>
            {expanded[item.id] && (
              <div className="mt-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                <p>入账日期：{dateKeyFromValue(item.createdAt)}</p>
                <p>来源：{sourceTypeText(item.sourceType)}</p>
                <p>操作者：{item.operator?.nickname ?? "未记录"}</p>
                <p className="whitespace-pre-wrap">说明：{item.description}</p>
                {item.note && <p className="whitespace-pre-wrap">备注：{item.note}</p>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`text-sm font-black ${item.direction === "income" ? "text-emerald-600" : "text-coral"}`}>
              {item.direction === "income" ? "+" : "-"}{item.points}
            </span>
            <button type="button" onClick={() => remove(item.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500" aria-label="删除记录">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="egg-card grid grid-cols-3 gap-2 rounded-[24px] bg-white/90 p-2 shadow-soft backdrop-blur">
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={`rounded-2xl px-3 py-2 text-sm font-black ${value === key ? "bg-ink text-white" : "bg-slate-50 text-slate-500"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MoodFlipEffect({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="mood-flip relative flex h-44 w-44 items-center justify-center rounded-full bg-white/82 shadow-soft backdrop-blur">
        <span className="absolute inset-2 rounded-full bg-sunny/70 mood-glow" />
        <EggBuddy mood="expect" size="xl" className="mood-avatar mood-avatar-expect absolute" />
        <EggBuddy mood="excited" size="xl" className="mood-avatar mood-avatar-excited absolute" />
        <span className="absolute -bottom-5 rounded-full bg-ink px-4 py-2 text-sm font-black text-white shadow-soft">{text}</span>
      </div>
    </div>
  );
}

function EggBuddy({
  mood = "happy",
  size = "md",
  className = ""
}: {
  mood?: EggMood;
  skin?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass = size === "xl" ? "h-28 w-28" : size === "lg" ? "h-20 w-20" : size === "sm" ? "h-11 w-11" : "h-16 w-16";
  const moodLabel: Record<EggMood, string> = {
    happy: "开心",
    sad: "悲伤",
    expect: "期待",
    peek: "偷看",
    excited: "兴奋"
  };
  return (
    <img
      src={eggMoodImages[mood]}
      alt={`蛋仔${moodLabel[mood]}头像`}
      className={`egg-wiggle ${sizeClass} shrink-0 object-contain drop-shadow-[0_12px_22px_rgba(36,48,45,0.18)] ${className}`}
      draggable={false}
    />
  );
}

function skinBackground(skin?: string) {
  if (skin === "mint") return "park-skin-mint";
  if (skin === "candy") return "park-skin-candy";
  return "park-skin-sunny";
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="park-mini-stat rounded-2xl px-2 py-3">
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function DailyScoreRow({
  task,
  defaultLevel,
  expanded,
  onToggle
}: {
  task: AnyRecord;
  defaultLevel: DailyLevel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const options: Array<[DailyLevel, string]> = [
    ["none", `未完成 · 0`],
    ["low", `1/3 · ${dailyLevelPoints(task.points, "low")}`],
    ["mid", `2/3 · ${dailyLevelPoints(task.points, "mid")}`],
    ["full", `完成 · ${task.points}`]
  ];
  return (
    <div className="park-check-row rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">{task.name}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">满分 {task.points} 分</p>
        </div>
        <select name={`level-${task.trigger}`} defaultValue={defaultLevel} className="w-32 rounded-2xl border border-slate-200 bg-white px-2 py-2 text-xs font-black outline-none focus:border-mint">
          {options.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {task.description && (
        <div className="mt-2">
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500">
            <Info size={13} />
            标准
          </button>
          {expanded && <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">{task.description}</p>}
        </div>
      )}
    </div>
  );
}

function CheckRow({ name, label, points, defaultChecked }: { name: string; label: string; points: string; defaultChecked?: boolean }) {
  return (
    <label className="park-check-row flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
      <span className="min-w-0 text-sm font-bold">{label}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">{points}<input name={name} type="checkbox" defaultChecked={defaultChecked} /></span>
    </label>
  );
}

function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
    </label>
  );
}

function NumberField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <input name={name} type="number" defaultValue={value} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-mint" />
    </label>
  );
}

function NoteArchive({ title, value }: { title: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm font-bold text-slate-500">
      <EggBuddy mood="sad" size="sm" />
      <span>{text}</span>
    </div>
  );
}

function ownerText(owner: string) {
  return ({ dad: "爸爸", mom: "妈妈", pangpang: "胖胖", family: "全家" }[owner] ?? owner);
}

function cycleText(cycle: string) {
  return ({ daily: "日任务", weekly: "周任务", longTerm: "长期任务", active: "临时任务" }[cycle] ?? cycle);
}

function sourceTypeText(sourceType: string) {
  return ({
    daily_settlement: "每日结算",
    weekly_task: "周任务",
    temporary_task: "临时任务",
    random_task: "随机任务",
    weekly_review: "周复盘",
    redemption: "兑换扣分"
  }[sourceType] ?? sourceType);
}
