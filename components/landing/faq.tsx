import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LandingTitle } from "./title";

const faqItems = [
  {
    q: "One Calendar 的核心定位是什么？",
    a: "One Calendar 是一个以隐私为优先、以规划效率为核心的开源日历产品，强调简洁交互、稳定性能与可迁移数据。",
  },
  {
    q: "支持哪些导入导出格式？",
    a: "目前支持 iCalendar（.ics）、JSON 与 CSV 的导入导出，方便你从其他平台迁移并保留历史数据。",
  },
  {
    q: "是否支持端到端加密？",
    a: "支持可选的端到端加密（E2EE）能力，适合处理更敏感的排程信息。",
  },
  {
    q: "云同步和登录使用什么技术栈？",
    a: "云同步可选并基于 PostgreSQL，认证流程由 Clerk 提供，兼顾稳定性与维护效率。",
  },
  {
    q: "我能离开这个平台吗？",
    a: "可以。产品设计强调数据可迁移性，导出格式对主流日历工具友好，避免平台锁定。",
  },
  {
    q: "适合团队使用吗？",
    a: "适合。你可以用它管理项目排期、团队例会、版本节奏、复盘节点，也适合跨时区协作。",
  },
  {
    q: "移动端体验如何？",
    a: "Landing 与核心功能在响应式布局下均可访问，移动端聚焦关键任务与快速查看，桌面端提供更强的编辑效率。",
  },
  {
    q: "有快捷键和快速编辑能力吗？",
    a: "有。产品强调高频操作效率，包含快捷键操作和低阻力编辑流程。",
  },
  {
    q: "是否开源、能否自托管？",
    a: "项目是开源的，代码可审计。你可以基于自身需求进行部署、扩展和二次开发。",
  },
  {
    q: "如果我只是个人用户，值得用吗？",
    a: "非常适合。无论是学习计划、健身安排、家庭事务还是创作发布流程，都能用统一时间视图管理。",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="border-b border-white/10 py-24 md:py-28">
      <div className="grid w-full gap-8 md:grid-cols-[300px_1fr]">
        <LandingTitle as="h2" className="text-3xl font-semibold text-white md:text-5xl">FAQ</LandingTitle>
        <div className="px-0 md:px-2">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`} className="border-white/10">
                <AccordionTrigger className="py-5 text-left text-base font-medium text-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm text-[var(--landing-muted)] md:text-base">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
