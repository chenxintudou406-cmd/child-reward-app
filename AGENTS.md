# AGENTS.md

## 项目概述

这是一个手机优先的家庭积分与奖励管理应用，项目名为 `pangpang-reward-app`。应用用于记录“胖胖”的每日任务、周任务、周六复盘、积分收支、零花钱兑换、礼品兑换和许愿计划。产品风格是“蛋仔乐园”式的亲子、轻量、鼓励型 UI。

技术栈：

- Next.js 15 App Router + React 19 + TypeScript。
- Tailwind CSS 3，少量全局 CSS 动画和主题变量。
- Prisma 6 + PostgreSQL 作为生产持久化。
- 无 `DATABASE_URL` 时自动走本地预览存储 `.local-preview.json`，便于不用数据库也能打开和试功能。
- Docker Compose 用于本地 PostgreSQL 和生产部署。

## 关键目录

- `app/`：Next App Router 页面和 API 路由。`app/page.tsx` 只挂载主客户端应用，接口集中在 `app/api/**/route.ts`。
- `components/reward-app.tsx`：主客户端应用，包含登录、首页、日期页、兑换页、任务页、设置页等大部分 UI 和交互。
- `lib/service.ts`：核心业务服务层。所有积分结算、手动发放、周复盘、兑换、设置和模板写入都应优先通过这里。
- `lib/preview-store.ts`：无数据库时的本地预览数据实现，行为应尽量和 `lib/service.ts` 的数据库路径保持一致。
- `lib/auth.ts`：登录、密码哈希、会话 cookie、当前用户读取。
- `lib/defaults.ts`：默认账号、积分规则、任务模板和奖励数据。
- `lib/date.ts`：日期 key、本地日界、周起止等工具。涉及日期逻辑时优先复用。
- `prisma/schema.prisma`：数据库模型。修改模型后需要生成迁移。
- `prisma/migrations/`：已提交的数据库迁移。
- `public/egg-moods/`：蛋仔表情图片资源。
- `deploy/tencent-cloud.md`、`docker-compose.prod.yml`、`Dockerfile`：生产部署资料。
- `public/index.html`、`public/app.js`、`public/styles.css`：较早的静态原型/遗留资源，通常不要作为当前主应用入口修改。

## 业务模型速记

主要实体：

- `User` / `Session`：目前只有父母账号，默认 `dad`、`mom`，写操作记录操作者。
- `FamilySettings`：家庭预算、每日保底/上限、兑换倍率、周复盘星期、皮肤等全局设置。
- `PointRule`：积分规则，例如每日保底、课堂作业、预习、课外任务、积极态度、周复盘、存钱计划。
- `TaskTemplate`：每日任务、周任务、临时/主动任务模板。
- `DailyRecord`：某天的结算状态、动态记录、父母备注、结算备注和每日积分。
- `WeeklyReview`：周复盘内容、优点、改进、下周动作、录音链接和奖励分。
- `PointTransaction`：积分流水。收入/支出统一从这里计算余额。
- `Reward` / `Redemption` / `AllowanceLedger`：礼品、兑换申请、零花钱台账。

重要规则：

- 余额不是单独字段，通过 `PointTransaction` 按 `income - expense` 汇总。
- 每日结算是覆盖式：同一天重新结算时，会删除该日旧的 `daily_settlement` 流水并新建一条。
- 删除每日结算流水时，会把关联 `DailyRecord.dailyPoints` 置为 `0`。
- 兑换申请创建后是 `pending`，父母确认时才生成支出流水并扣分。
- 周复盘完成时按 `weekly_review` 规则发分，重复保存会覆盖旧周复盘奖励流水。

## 本地开发

常用命令：

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

带 PostgreSQL 的完整本地流程：

```bash
copy .env.example .env
docker compose up -d postgres
npm run prisma:deploy
npm run seed
npm run dev
```

默认访问 `http://localhost:3000`。默认账号：

- `dad` / `pangpang123`
- `mom` / `pangpang123`

如果没有配置 `DATABASE_URL`，应用仍可运行，会读写根目录下的 `.local-preview.json`。这对 UI 调试很方便，但不要把预览数据当作正式数据迁移来源。

## 修改原则

- 优先保持 `lib/service.ts` 和 `lib/preview-store.ts` 行为一致。新增或修改业务动作时，两条路径都要考虑。
- API 路由应尽量薄：鉴权、解析输入、调用 service、返回 JSON。复杂业务不要写在 route 里。
- 写操作需要通过 `requireUser()` 或等价方式拿到当前用户，便于流水或记录保存操作者。
- 涉及日期时使用 `lib/date.ts`，避免直接拼 UTC 日期导致跨时区偏移。
- 涉及金额和积分时注意单位：零花钱兑换当前是 `1 元 = 100 积分` 的扣分计算，普通奖励看 `pointsRequired`。
- 修改 Prisma schema 后，生成并提交迁移；不要只改 generated client 或数据库。
- 不要编辑 `.next/`、`node_modules/`、`tsconfig.tsbuildinfo`。除非任务明确要求，也不要随手改 `.local-preview.json`。
- 保持源码和文档为 UTF-8。项目中有大量中文文案，读取 PowerShell 文件时可使用 `Get-Content -Encoding utf8`。

## 前端约定

- 主界面是移动端优先，最大宽度约 `max-w-md`，底部 tab 导航固定。
- UI 风格偏温暖、亲子、奖励反馈明确，主要颜色来自 Tailwind 扩展和 `app/globals.css` 的 park/egg 主题。
- 图标使用 `lucide-react`，已有按钮和导航图标应延续这个库。
- 主组件目前较大，做小改动时尽量局部修改；做较大 UI 重构时再考虑拆分组件。
- 交互请求统一走 `components/reward-app.tsx` 内的 `api()` helper，错误通过 toast 或登录错误展示。
- 不要把功能说明文字塞进界面。用户第一屏应继续是可用的应用，而不是营销页。

## 数据库与部署

- 生产使用 `docker-compose.prod.yml`，应用监听容器内 `3000`，宿主机映射为 `127.0.0.1:3100`。
- 容器启动命令会执行 `npx prisma migrate deploy && npm run seed && npm run start`。
- 当前部署说明在 `deploy/tencent-cloud.md`，线上域名记录为 `https://pp.herotop.cn/`。
- 生产 `POSTGRES_PASSWORD` 来自环境变量，不要把真实密码提交进仓库。

## 提交前检查

至少运行：

```bash
npm run typecheck
npm run build
```

注意：`npm run lint` 当前脚本是 `next lint`，Next 15 中该命令可能不可用或需要额外迁移；如果 lint 失败，先判断是工具链问题还是代码问题，并在交付说明里写清楚。

改动涉及数据库时，额外检查：

```bash
npm run prisma:generate
npm run prisma:deploy
```

改动涉及关键业务流时，手动走一遍：

- 登录。
- 每日结算并查看首页余额/月历/流水。
- 发放周任务或临时任务积分。
- 创建兑换申请并确认扣分。
- 保存周复盘。
- 无 `DATABASE_URL` 的预览模式和 PostgreSQL 模式行为是否一致。
