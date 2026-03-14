import { LandingTitle } from "./title";

const faqItems = [
  {
    q: "One Calendar 最核心解决什么问题？",
    a: "它把排程做回基础动作：快、清楚、可迁移。你不必先学习一套复杂系统。",
  },
  {
    q: "支持哪些导入导出格式？",
    a: "支持 .ics、JSON、CSV。迁移和备份都可以直接做。",
  },
  {
    q: "隐私是可选项还是默认项？",
    a: "默认不追踪。端到端加密可以按需开启，用于敏感日程。",
  },
  {
    q: "是否适合团队协作？",
    a: "适合。发布节奏、里程碑、跨时区会议都能在同一时间线上管理。",
  },
  {
    q: "可以自托管或二次开发吗？",
    a: "可以。项目开源，你可以审查、部署和扩展。",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="border-b border-[var(--landing-line)] py-24 md:py-28">
      <div className="grid w-full gap-10 md:grid-cols-[0.65fr_1.35fr]">
        <LandingTitle
          as="h2"
          className="text-3xl font-semibold text-[var(--landing-text)] md:text-5xl"
        >
          FAQ
        </LandingTitle>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <details
              key={item.q}
              className="group border border-[var(--landing-line)] bg-[var(--landing-panel-soft)] p-5"
            >
              <summary className="cursor-pointer list-none pr-8 text-base font-medium text-[var(--landing-text)] marker:hidden">
                {item.q}
                <span className="float-right text-[var(--landing-subtle)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
