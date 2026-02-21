import { LandingTitle } from "./title";

const useCases = [
  {
    title: "个人深度工作规划",
    detail:
      "用 Focus Block、提醒和周视图管理整块时间，把真正重要的事情提前锁定，减少被临时会议打断的概率。",
  },
  {
    title: "小团队协作排期",
    detail:
      "用共享日历做版本发布、设计评审、复盘节奏管理，所有关键节点都能在同一个时间轴上清晰可见。",
  },
  {
    title: "学习与考试管理",
    detail:
      "把课程、作业、考试、复习计划拆分成可执行事件，支持跨月追踪，让长期目标变成每天可完成的小步骤。",
  },
  {
    title: "跨时区远程协作",
    detail:
      "统一查看不同时区的可用时间，减少来回沟通成本，快速找到双方都能接受的会议窗口。",
  },
  {
    title: "内容创作发布流水线",
    detail:
      "把选题、写作、设计、审核、发布和复盘做成连续时间链路，避免任务堆积和发布冲突。",
  },
  {
    title: "家庭事务与生活安排",
    detail:
      "把家庭活动、就医预约、孩子课程、旅行计划同步在一个视图中，减少遗漏和时间冲突。",
  },
];

const principles = [
  "默认简洁：首屏信息克制，核心操作不被干扰。",
  "默认可迁移：始终支持导入导出，不将用户锁在单一平台。",
  "默认可审计：开源实现可被社区验证。",
  "默认尊重隐私：以隐私优先作为产品前提，而不是付费附加项。",
  "默认高效率：键盘快捷键、快速编辑、低阻力交互贯穿全流程。",
  "默认可扩展：从个人安排到团队协作都能平滑演进。",
];

const roadmap = [
  {
    phase: "阶段 01",
    title: "核心体验稳定化",
    items: ["周/月/年视图精细优化", "交互延迟持续降低", "移动端排版完善"],
  },
  {
    phase: "阶段 02",
    title: "协作能力增强",
    items: ["共享权限粒度增强", "多人编辑冲突提示", "团队模板预设"],
  },
  {
    phase: "阶段 03",
    title: "自动化与智能建议",
    items: ["重复任务智能生成", "空闲时段推荐", "提醒策略自动化"],
  },
  {
    phase: "阶段 04",
    title: "生态整合扩展",
    items: ["更多第三方同步入口", "企业身份体系接入", "开放 API 稳定发布"],
  },
];

export function LandingDeepDive() {
  return (
    <section id="deep-dive" className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-3xl font-semibold leading-tight text-white md:text-5xl">
        更完整的落地场景
        <br />
        和产品路线
      </LandingTitle>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        不只是“一个能记日程的日历”，而是从个人效率到团队协作都能长期使用的时间操作系统。
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {useCases.map((item) => (
          <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.015] p-5">
            <LandingTitle as="h3" className="text-lg font-medium text-white">{item.title}</LandingTitle>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <LandingTitle as="h3" className="text-2xl font-semibold text-white md:text-3xl">产品原则</LandingTitle>
          <ul className="mt-5 space-y-3">
            {principles.map((item) => (
              <li key={item} className="rounded-lg border border-white/10 px-4 py-3 text-sm text-[var(--landing-muted)] md:text-base">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <LandingTitle as="h3" className="text-2xl font-semibold text-white md:text-3xl">路线图</LandingTitle>
          <div className="mt-5 space-y-4">
            {roadmap.map((step) => (
              <article key={step.phase} className="rounded-lg border border-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">{step.phase}</p>
                <p className="mt-2 text-lg font-medium text-white">{step.title}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--landing-muted)]">
                  {step.items.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
