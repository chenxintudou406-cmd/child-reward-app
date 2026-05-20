const state = {
  token: localStorage.getItem("pangpang_token"),
  role: localStorage.getItem("pangpang_role"),
  data: null,
  tab: "overview",
  toast: ""
};

const tabs = [
  ["overview", "总览"],
  ["daily", "每日"],
  ["tasks", "任务"],
  ["rewards", "兑换"],
  ["weekend", "周末"],
  ["exam", "考试"]
];

const taskTypes = {
  school: "学校作业",
  training: "摩森/培训班",
  mom: "妈妈任务",
  dad: "爸爸任务",
  preview: "预习/专项",
  exam_review: "考试复盘"
};

const sourceNames = {
  core_homework: "核心作业",
  early_finish: "提前完成",
  quality: "质量奖励",
  gap_task: "插缝任务",
  weekend_plan: "周末计划",
  exam_review: "考试复盘",
  delayed_gratification: "延迟满足",
  redemption: "兑换消耗"
};

const app = document.querySelector("#app");

init();

async function init() {
  if (state.token) {
    try {
      await loadState();
    } catch {
      localStorage.removeItem("pangpang_token");
      localStorage.removeItem("pangpang_role");
      state.token = null;
    }
  }
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

async function loadState() {
  state.data = await api("/api/state");
  state.role = state.data.role;
  localStorage.setItem("pangpang_role", state.role);
}

function render() {
  app.innerHTML = state.token && state.data ? appTemplate() : loginTemplate();
  bindEvents();
}

function loginTemplate() {
  return `
    <section class="login-screen">
      <form class="login-panel" data-form="login">
        <div class="login-copy">
          <div class="brand-mark">胖</div>
          <h1>胖胖学习时间与激励管理</h1>
          <p>家庭口令 + PIN 进入对应视图。</p>
        </div>
        <div class="form-grid">
          <label class="wide">家庭口令
            <input name="familyCode" value="pangpang" autocomplete="username" />
          </label>
          <label class="wide">PIN
            <input name="pin" type="password" autocomplete="current-password" placeholder="家长或胖胖 PIN" />
          </label>
          <button class="wide" type="submit">进入</button>
        </div>
      </form>
    </section>
  `;
}

function appTemplate() {
  const roleText = isParent() ? "家长管理" : "胖胖视图";
  return `
    <section class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">胖</div>
          <div>
            <h1>${state.data.family.name}</h1>
            <p>${state.data.family.examMode ? "考试期模式已开启" : "两周试用规则运行中"}</p>
          </div>
        </div>
        <div class="item-row">
          <span class="role-pill">${roleText}</span>
          <button class="secondary icon" title="退出登录" data-action="logout">×</button>
        </div>
      </header>
      <div class="content">
        <nav class="nav-tabs">
          ${visibleTabs().map(([id, label]) => `<button data-tab="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`).join("")}
        </nav>
        ${tabTemplate()}
      </div>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </section>
  `;
}

function visibleTabs() {
  if (isParent()) return tabs;
  return tabs.filter(([id]) => ["overview", "rewards", "weekend", "exam"].includes(id));
}

function tabTemplate() {
  if (state.tab === "daily") return dailyTemplate();
  if (state.tab === "tasks") return tasksTemplate();
  if (state.tab === "rewards") return rewardsTemplate();
  if (state.tab === "weekend") return weekendTemplate();
  if (state.tab === "exam") return examTemplate();
  return overviewTemplate();
}

function overviewTemplate() {
  const data = state.data;
  return `
    <section class="hero-band">
      <div class="score-panel">
        <div class="score-ring"><div class="score-inner"><strong>${data.balance}</strong><span>当前积分</span></div></div>
        <div class="summary-stack">
          <h2>今天 ${data.todayLog ? "已经记录" : "还未记录"}</h2>
          <p class="muted">${todayLine(data.todayLog)}</p>
          <div class="kpis">
            <div class="kpi"><strong>${data.weeklyStats.completionRate}%</strong><span>本周任务完成率</span></div>
            <div class="kpi"><strong>${data.weeklyStats.averageFinishTime ?? "暂无"}</strong><span>平均完成时间</span></div>
            <div class="kpi"><strong>${data.weeklyStats.averageWrongCount ?? "暂无"}</strong><span>平均错题数</span></div>
          </div>
          ${data.family.examMode ? `<div class="exam-mode"><strong>考试期模式</strong><p class="muted">复盘优先，大奖兑换需要家长确认节奏。</p></div>` : ""}
        </div>
      </div>
      <div class="panel">
        <div class="section-title">
          <div>
            <h2>本周积分来源</h2>
            <p>用于两周试用后的复盘。</p>
          </div>
        </div>
        <div class="list">
          ${Object.entries(data.weeklyStats.sourceTotals).length ? Object.entries(data.weeklyStats.sourceTotals).map(([source, points]) => `
            <div class="item-row">
              <span>${sourceNames[source] ?? source}</span>
              <strong>${points > 0 ? "+" : ""}${points}</strong>
            </div>
          `).join("") : `<div class="empty">本周还没有积分流水</div>`}
        </div>
      </div>
    </section>
    <section class="two-col">
      <div class="panel">
        <div class="section-title"><h2>待完成任务</h2></div>
        <div class="list">${taskList(data.tasks.filter((task) => task.status === "open").slice(0, 5))}</div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>最近积分流水</h2></div>
        <div class="list">${pointList(data.points.slice(0, 8))}</div>
      </div>
    </section>
  `;
}

function dailyTemplate() {
  assertParentTab();
  return `
    <section class="two-col">
      <form class="panel" data-form="daily">
        <div class="section-title">
          <div>
            <h2>每日记录</h2>
            <p>填完成时间和错题数，系统自动算分。</p>
          </div>
        </div>
        <div class="form-grid">
          <label>日期<input type="date" name="date" value="${state.data.today}" /></label>
          <label>完成时间<input type="time" name="completedTime" value="19:20" /></label>
          <label>错题数<input type="number" min="0" name="wrongCount" value="2" /></label>
          ${checkbox("schoolDone", "学校作业完成", true)}
          ${checkbox("trainingDone", "培训作业完成", false)}
          ${checkbox("momDone", "妈妈任务完成", false)}
          ${checkbox("dadDone", "爸爸任务完成", false)}
          ${checkbox("previewDone", "预习/专项完成", false)}
          <label class="wide">备注<textarea name="notes" placeholder="今天有什么需要复盘或表扬的点"></textarea></label>
          <button class="wide" type="submit">保存每日记录</button>
        </div>
      </form>
      <div class="panel">
        <div class="section-title"><h2>最近每日记录</h2></div>
        <div class="list">${dailyLogList(state.data.dailyLogs)}</div>
      </div>
    </section>
  `;
}

function tasksTemplate() {
  assertParentTab();
  return `
    <section class="two-col">
      <form class="panel" data-form="task">
        <div class="section-title">
          <div>
            <h2>任务管理</h2>
            <p>只记录影响时间和积分的关键任务。</p>
          </div>
        </div>
        <div class="form-grid">
          <label class="wide">任务标题<input name="title" placeholder="例如：摩森本周作业提前消化" required /></label>
          <label>类型
            <select name="type">${Object.entries(taskTypes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          </label>
          <label>预计分钟<input type="number" name="estimatedMinutes" value="30" min="5" /></label>
          <label>截止日期<input type="date" name="dueDate" value="${state.data.today}" /></label>
          <label>状态
            <select name="status">
              <option value="open">待完成</option>
              <option value="done">已完成</option>
            </select>
          </label>
          ${checkbox("isGapTask", "插缝任务", true)}
          <button class="wide" type="submit">添加任务</button>
        </div>
      </form>
      <div class="panel">
        <div class="section-title">
          <h2>任务列表</h2>
          <button class="secondary" data-action="delayed-bonus">延迟满足 +5</button>
        </div>
        <div class="list">${taskList(state.data.tasks, true)}</div>
      </div>
    </section>
  `;
}

function rewardsTemplate() {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2>兑换中心</h2>
          <p>当前积分 ${state.data.balance}，申请后由家长确认。</p>
        </div>
      </div>
      <div class="reward-grid">
        ${state.data.rewards.map((reward) => `
          <article class="reward-card">
            <div>
              <strong>${escapeHtml(reward.name)}</strong>
              <p class="muted">${rewardType(reward.type)} · ${escapeHtml(reward.limit_text || "需家长确认")}</p>
            </div>
            <div class="reward-cost"><strong>${reward.cost}</strong><span>积分</span></div>
            <button data-action="request-redemption" data-id="${reward.id}" ${state.data.balance < reward.cost ? "disabled" : ""}>申请兑换</button>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="panel">
      <div class="section-title"><h2>兑换申请</h2></div>
      <div class="list">${redemptionList(state.data.redemptions)}</div>
    </section>
  `;
}

function weekendTemplate() {
  return `
    <section class="two-col">
      ${isParent() ? `
        <form class="panel" data-form="weekend">
          <div class="section-title">
            <div>
              <h2>周末计划</h2>
              <p>提前确认计划可获得 +5。</p>
            </div>
          </div>
          <div class="form-grid">
            <label>日期<input type="date" name="planDate" value="${state.data.today}" /></label>
            <label>活动对象<input name="activityWith" placeholder="同学/家人/自己" /></label>
            <label>活动类型<input name="activityType" placeholder="出去玩/运动/活动" /></label>
            ${checkbox("confirmed", "已确认计划", true)}
            <label class="wide">安排<textarea name="details" placeholder="几点到几点，在哪里，完成哪些前置事项"></textarea></label>
            <button class="wide" type="submit">保存周末计划</button>
          </div>
        </form>
      ` : `<div class="panel"><div class="section-title"><h2>周末安排</h2><p>这里只显示已记录的计划。</p></div></div>`}
      <div class="panel">
        <div class="section-title"><h2>计划列表</h2></div>
        <div class="list">${weekendList(state.data.weekendPlans)}</div>
      </div>
    </section>
  `;
}

function examTemplate() {
  return `
    <section class="two-col">
      ${isParent() ? `
        <div class="panel">
          <div class="section-title">
            <div>
              <h2>考试期模式</h2>
              <p>开启后强调复盘，兑换节奏更谨慎。</p>
            </div>
            <button data-action="toggle-exam">${state.data.family.examMode ? "关闭" : "开启"}</button>
          </div>
          <form data-form="exam">
            <div class="form-grid">
              <label>科目<input name="subject" placeholder="数学/英语/语文" required /></label>
              <label>考试日期<input type="date" name="examDate" value="${state.data.today}" /></label>
              <label class="wide">参照/结果<input name="referenceResult" placeholder="参照同学、老师评价或排名区间" /></label>
              <label class="wide">问题归因<textarea name="problems" placeholder="读题、计算、时间、知识点"></textarea></label>
              <label class="wide">复盘动作<textarea name="actions" placeholder="下一步要怎么改"></textarea></label>
              ${checkbox("completed", "已完成复盘", true)}
              <button class="wide" type="submit">保存复盘</button>
            </div>
          </form>
        </div>
      ` : `<div class="panel"><div class="section-title"><h2>考试复盘</h2><p>考得好不好，都看有没有复盘出下一步。</p></div></div>`}
      <div class="panel">
        <div class="section-title"><h2>复盘记录</h2></div>
        <div class="list">${examList(state.data.examReviews)}</div>
      </div>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", () => {
    localStorage.removeItem("pangpang_token");
    localStorage.removeItem("pangpang_role");
    state.token = null;
    state.data = null;
    render();
  });

  document.querySelector("[data-form='login']")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData(event.currentTarget);
    try {
      const result = await api("/api/login", { method: "POST", body: JSON.stringify(payload) });
      state.token = result.token;
      state.role = result.role;
      localStorage.setItem("pangpang_token", state.token);
      localStorage.setItem("pangpang_role", state.role);
      await loadState();
      state.tab = "overview";
      showToast("登录成功");
    } catch (error) {
      showToast(error.message);
    }
  });

  bindForm("daily", "/api/daily-logs");
  bindForm("task", "/api/tasks");
  bindForm("weekend", "/api/weekend-plans");
  bindForm("exam", "/api/exam-reviews");

  document.querySelectorAll("[data-action='complete-task']").forEach((button) => {
    button.addEventListener("click", () => patch(`/api/tasks/${button.dataset.id}`, { status: "done" }, "任务已完成"));
  });

  document.querySelector("[data-action='delayed-bonus']")?.addEventListener("click", () => {
    post("/api/bonus/delayed", { label: "延迟即时想买/想玩的需求" }, "已记录延迟满足 +5");
  });

  document.querySelectorAll("[data-action='request-redemption']").forEach((button) => {
    button.addEventListener("click", () => post("/api/redemptions", { rewardId: button.dataset.id }, "兑换申请已提交"));
  });

  document.querySelectorAll("[data-action='confirm-redemption']").forEach((button) => {
    button.addEventListener("click", () => patch(`/api/redemptions/${button.dataset.id}`, { action: "confirm" }, "兑换已确认"));
  });

  document.querySelectorAll("[data-action='cancel-redemption']").forEach((button) => {
    button.addEventListener("click", () => patch(`/api/redemptions/${button.dataset.id}`, { action: "cancel" }, "兑换已取消"));
  });

  document.querySelector("[data-action='toggle-exam']")?.addEventListener("click", () => {
    patch("/api/settings/exam-mode", { examMode: !state.data.family.examMode }, "考试期模式已更新");
  });
}

function bindForm(name, path) {
  document.querySelector(`[data-form='${name}']`)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await post(path, formData(event.currentTarget), "保存成功");
    event.currentTarget.reset();
  });
}

async function post(path, payload, message) {
  try {
    const result = await api(path, { method: "POST", body: JSON.stringify(payload) });
    state.data = result.state ?? state.data;
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

async function patch(path, payload, message) {
  try {
    const result = await api(path, { method: "PATCH", body: JSON.stringify(payload) });
    state.data = result.state ?? state.data;
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll("input[type='checkbox']").forEach((input) => {
    data[input.name] = input.checked;
  });
  return data;
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2200);
}

function isParent() {
  return state.role === "parent";
}

function assertParentTab() {
  if (!isParent()) {
    state.tab = "overview";
    return "";
  }
}

function checkbox(name, label, checked) {
  return `<label class="check-row"><input type="checkbox" name="${name}" ${checked ? "checked" : ""} /> ${label}</label>`;
}

function todayLine(log) {
  if (!log) return "家长记录后，胖胖就能看到今日状态和积分变化。";
  const parts = [
    log.completed_time ? `${log.completed_time} 完成` : "未填完成时间",
    Number.isFinite(Number(log.wrong_count)) ? `错 ${log.wrong_count} 题` : "未填错题"
  ];
  return parts.join(" · ");
}

function taskList(tasks, withActions = false) {
  if (!tasks.length) return `<div class="empty">暂无任务</div>`;
  return tasks.map((task) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p class="muted">${taskTypes[task.type] ?? task.type}</p>
        </div>
        ${withActions && task.status !== "done" ? `<button class="icon" title="标记完成" data-action="complete-task" data-id="${task.id}">✓</button>` : ""}
      </div>
      <div class="item-meta">
        <span class="tag ${task.status === "done" ? "good" : "info"}">${task.status === "done" ? "已完成" : "待完成"}</span>
        <span class="tag">${task.estimated_minutes} 分钟</span>
        ${task.due_date ? `<span class="tag">截止 ${task.due_date}</span>` : ""}
        ${task.is_gap_task ? `<span class="tag hot">插缝</span>` : ""}
      </div>
    </article>
  `).join("");
}

function pointList(points) {
  if (!points.length) return `<div class="empty">暂无积分流水</div>`;
  return points.map((point) => `
    <article class="item">
      <div class="item-row">
        <span>${escapeHtml(point.label)}</span>
        <strong class="${point.points < 0 ? "danger-text" : ""}">${point.points > 0 ? "+" : ""}${point.points}</strong>
      </div>
      <div class="item-meta"><span class="tag">${sourceNames[point.source] ?? point.source}</span><span class="tag">${formatDateTime(point.created_at)}</span></div>
    </article>
  `).join("");
}

function dailyLogList(logs) {
  if (!logs.length) return `<div class="empty">暂无每日记录</div>`;
  return logs.map((log) => `
    <article class="item">
      <div class="item-row"><strong>${log.date}</strong><span>${log.completed_time ?? "未填时间"}</span></div>
      <div class="item-meta">
        <span class="tag">错 ${log.wrong_count ?? "-"} 题</span>
        ${log.school_done ? `<span class="tag good">学校</span>` : ""}
        ${log.training_done ? `<span class="tag good">培训</span>` : ""}
        ${log.mom_done ? `<span class="tag good">妈妈</span>` : ""}
        ${log.dad_done ? `<span class="tag good">爸爸</span>` : ""}
      </div>
      ${log.notes ? `<p class="muted">${escapeHtml(log.notes)}</p>` : ""}
    </article>
  `).join("");
}

function redemptionList(redemptions) {
  if (!redemptions.length) return `<div class="empty">暂无兑换申请</div>`;
  return redemptions.map((item) => `
    <article class="item">
      <div class="item-row">
        <div>
          <h3>${escapeHtml(item.reward_name)}</h3>
          <p class="muted">${item.requested_by === "child" ? "胖胖申请" : "家长登记"} · ${item.cost} 积分</p>
        </div>
        <span class="tag ${item.status === "confirmed" ? "good" : item.status === "pending" ? "info" : "hot"}">${redemptionStatus(item.status)}</span>
      </div>
      ${isParent() && item.status === "pending" ? `
        <div class="item-row">
          <button data-action="confirm-redemption" data-id="${item.id}">确认</button>
          <button class="secondary" data-action="cancel-redemption" data-id="${item.id}">取消</button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function weekendList(plans) {
  if (!plans.length) return `<div class="empty">暂无周末计划</div>`;
  return plans.map((plan) => `
    <article class="item">
      <div class="item-row"><strong>${plan.plan_date}</strong><span class="tag ${plan.confirmed ? "good" : "info"}">${plan.confirmed ? "已确认" : "待确认"}</span></div>
      <p>${escapeHtml([plan.activity_type, plan.activity_with].filter(Boolean).join(" · ") || "周末安排")}</p>
      ${plan.details ? `<p class="muted">${escapeHtml(plan.details)}</p>` : ""}
    </article>
  `).join("");
}

function examList(reviews) {
  if (!reviews.length) return `<div class="empty">暂无考试复盘</div>`;
  return reviews.map((review) => `
    <article class="item">
      <div class="item-row"><strong>${escapeHtml(review.subject)} · ${review.exam_date}</strong><span class="tag ${review.completed ? "good" : "info"}">${review.completed ? "已复盘" : "待复盘"}</span></div>
      ${review.reference_result ? `<p class="muted">参照：${escapeHtml(review.reference_result)}</p>` : ""}
      ${review.problems ? `<p>问题：${escapeHtml(review.problems)}</p>` : ""}
      ${review.actions ? `<p>动作：${escapeHtml(review.actions)}</p>` : ""}
    </article>
  `).join("");
}

function rewardType(type) {
  return {
    time: "时间",
    activity: "活动",
    draw: "抽奖",
    big_wish: "大额愿望"
  }[type] ?? type;
}

function redemptionStatus(status) {
  return {
    pending: "待确认",
    confirmed: "已确认",
    cancelled: "已取消"
  }[status] ?? status;
}

function formatDateTime(value) {
  return value?.replace("T", " ").slice(0, 16) ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
