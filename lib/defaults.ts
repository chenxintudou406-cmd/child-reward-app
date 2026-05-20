import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const defaultCredentials = [
  { nickname: "爸爸", username: "dad", password: "pangpang123" },
  { nickname: "妈妈", username: "mom", password: "pangpang123" }
];

export const defaultRandomTasks = [
  "对着妈妈笑10秒",
  "比一个帅气造型",
  "做一个鬼脸拍照",
  "说今天自己最帅的事",
  "说今天别人最帅的事",
  "吃完晚饭里的饭",
  "闻爸爸的脚",
  "唱30秒歌曲",
  "大声说我很棒5次",
  "做可爱表情",
  "和爸爸看一个国家",
  "10点半上床睡觉",
  "自己睡觉不要人陪",
  "对同学发一个夸夸语",
  "背一首唐诗",
  "一起读5分钟书"
];

export async function ensureSeedData() {
  const settings = await prisma.familySettings.findUnique({ where: { id: "family" } });
  if (!settings) {
    await prisma.familySettings.create({ data: { id: "family" } });
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.createMany({
      data: defaultCredentials.map((account) => ({
        nickname: account.nickname,
        username: account.username,
        passwordHash: hashPassword(account.password)
      }))
    });
  }

  const ruleCount = await prisma.pointRule.count();
  if (ruleCount === 0) {
    await prisma.pointRule.createMany({
      data: [
        {
          name: "每日保底",
          category: "daily",
          trigger: "daily_floor",
          points: 200,
          cap: 200,
          sortOrder: 10,
          description: "当天参与结算即可保底获得，帮助胖胖先稳定开始。"
        },
        {
          name: "课堂作业",
          category: "daily",
          trigger: "homework",
          points: 300,
          cap: 300,
          sortOrder: 20,
          description: "20:00 前完成、耐心订正、字迹格式好。"
        },
        {
          name: "预习完成",
          category: "daily",
          trigger: "preview",
          points: 200,
          cap: 200,
          sortOrder: 30,
          description: "按老师要求填写，并能用 5 句话概括课文。"
        },
        {
          name: "课外任务",
          category: "daily",
          trigger: "extra_homework",
          points: 200,
          cap: 200,
          sortOrder: 40,
          description: "课外作业或培训班任务耐心完成。"
        },
        {
          name: "积极态度",
          category: "daily",
          trigger: "attitude",
          points: 200,
          cap: 200,
          sortOrder: 50,
          description: "主动学习、分享观点、积极面对生活。"
        },
        {
          name: "周复盘",
          category: "weekly",
          trigger: "weekly_review",
          points: 500,
          sortOrder: 60,
          description: "每周看见优点，也找到下周改进动作。"
        },
        {
          name: "存钱计划",
          category: "weekly",
          trigger: "saving_plan",
          points: 1000,
          sortOrder: 70,
          description: "每周花费少于本周零花钱一半。"
        }
      ]
    });
  }

  const taskCount = await prisma.taskTemplate.count();
  if (taskCount === 0) {
    await prisma.taskTemplate.createMany({
      data: [
        {
          type: "daily_homework",
          title: "课堂作业认真完成",
          owner: "pangpang",
          cycle: "daily",
          defaultPoints: 300,
          autoShowOnDatePage: true,
          allowAdHocReward: false
        },
        {
          type: "daily_preview",
          title: "预习和 5 句话概括",
          owner: "mom",
          cycle: "daily",
          defaultPoints: 200,
          autoShowOnDatePage: true,
          allowAdHocReward: false
        },
        {
          type: "extra_work",
          title: "课外作业耐心完成",
          owner: "pangpang",
          cycle: "daily",
          defaultPoints: 200,
          autoShowOnDatePage: true,
          allowAdHocReward: true
        },
        {
          type: "weekly_review",
          title: "周复盘",
          owner: "family",
          cycle: "weekly",
          defaultPoints: 500,
          autoShowOnDatePage: true,
          allowAdHocReward: true
        },
        {
          type: "dad_task",
          title: "爸爸任务",
          owner: "dad",
          cycle: "weekly",
          defaultPoints: 500,
          autoShowOnDatePage: false,
          allowAdHocReward: true
        },
        {
          type: "mom_task",
          title: "妈妈任务",
          owner: "mom",
          cycle: "weekly",
          defaultPoints: 1000,
          autoShowOnDatePage: false,
          allowAdHocReward: true
        },
        {
          type: "self_value",
          title: "自主提供价值",
          owner: "pangpang",
          cycle: "active",
          defaultPoints: 1000,
          autoShowOnDatePage: false,
          allowAdHocReward: true
        },
        ...defaultRandomTasks.map((title) => ({
          type: "random_task",
          title,
          owner: "pangpang" as const,
          cycle: "active" as const,
          defaultPoints: 100,
          autoShowOnDatePage: false,
          allowAdHocReward: false
        }))
      ]
    });
  }

  const randomTaskCount = await prisma.taskTemplate.count({ where: { type: "random_task" } });
  if (randomTaskCount === 0) {
    await prisma.taskTemplate.createMany({
      data: defaultRandomTasks.map((title) => ({
        type: "random_task",
        title,
        owner: "pangpang",
        cycle: "active",
        defaultPoints: 100,
        autoShowOnDatePage: false,
        allowAdHocReward: false
      }))
    });
  } else {
    await prisma.taskTemplate.updateMany({
      where: { type: "random_task" },
      data: { defaultPoints: 100, cycle: "active", owner: "pangpang" }
    });
  }

  const rewardCount = await prisma.reward.count();
  if (rewardCount === 0) {
    await prisma.reward.createMany({
      data: [
        {
          name: "周末小计划",
          priceYuan: 30,
          pointsRequired: 2000,
          exchangeRate: 1.5,
          limitNote: "提前提交计划，父母确认后执行。"
        },
        {
          name: "大玩具基金",
          priceYuan: 90,
          pointsRequired: 6000,
          exchangeRate: 1.5,
          limitNote: "胖胖主动提前计划时使用。"
        },
        {
          name: "父母惊喜礼物",
          priceYuan: 100,
          pointsRequired: 4000,
          exchangeRate: 2.5,
          limitNote: "父母提前说好的礼物，倍率更高。"
        }
      ]
    });
  }
}
