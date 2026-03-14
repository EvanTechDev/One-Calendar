import { LandingTitle } from "./title";

const features = [
  {
    title: "抓取和拖动足够顺手",
    description: "直接拖拽、拉伸、改名。信息就在原位，不把你赶进弹窗迷宫。",
    icon: <path d="M4 10h24M8 4v8m16-8v8M5 18h22M5 24h12" />,
    shape: "md:translate-y-8",
  },
  {
    title: "默认安静，不偷看你",
    description: "不开追踪脚本，隐私策略写在前面，不藏在设置角落。",
    icon: (
      <path d="M16 4 6 9v7c0 6 4 9 10 12 6-3 10-6 10-12V9L16 4Zm0 8v7m-3-4h6" />
    ),
    shape: "md:-translate-y-6",
  },
  {
    title: "导入导出不设门槛",
    description: "ics、json、csv 都能进出。换工具时，不需要先求人。",
    icon: <path d="M16 4v16m0 0-5-5m5 5 5-5M5 26h22" />,
    shape: "",
  },
  {
    title: "视图切换不会断片",
    description: "日、周、月、年快速跳转，思路连着走，不会每次重建上下文。",
    icon: <path d="M5 8h22M5 16h22M5 24h22M10 4v24M22 4v24" />,
    shape: "md:translate-y-5",
  },
  {
    title: "键盘友好",
    description: "高频编辑靠快捷键完成，手不用离开键盘太久。",
    icon: <path d="M4 9h24v14H4zM8 13h4m4 0h8m-14 4h12" />,
    shape: "md:-translate-y-10",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-y border-[var(--landing-line)] py-24 md:py-28">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <LandingTitle
          as="h2"
          className="text-3xl font-semibold leading-tight text-[var(--landing-text)] md:text-5xl"
        >
          快，不浮夸。
          <br />
          够用，也够狠。
        </LandingTitle>
        <p className="max-w-2xl text-base text-[var(--landing-muted)] md:pl-10 md:text-lg">
          我们拒绝模板味的“效率仪式感”。每个模块都围绕真实动作：打开、修改、收工。
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        {features.map((feature) => (
          <article
            key={feature.title}
            className={`landing-scratch-card p-6 ${feature.shape}`}
          >
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="mb-5 h-9 w-9 stroke-[var(--landing-text)]"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {feature.icon}
            </svg>
            <LandingTitle
              as="h3"
              className="text-xl font-medium text-[var(--landing-text)]"
            >
              {feature.title}
            </LandingTitle>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-subtle)]">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
