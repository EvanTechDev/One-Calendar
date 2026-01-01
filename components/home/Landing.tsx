
import Link from "next/link";

// ------------------------------
// Tiny inline SVG icons (no deps)
// ------------------------------
function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2l1.2 5.2L18 8.5l-4.8 1.3L12 15l-1.2-5.2L6 8.5l4.8-1.3L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 14l.7 3L8 18l-3.3 1-.7 3-.7-3L0 18l3.3-1L4 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".75"
      />
      <path
        d="M20 12l.6 2.4L23 15l-2.4.6L20 18l-.6-2.4L17 15l2.4-.6L20 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity=".75"
      />
    </svg>
  );
}

function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 12h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 3v3M17 3v3M4 8h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 12h3M13 12h3M8 16h3M13 16h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity=".8"
      />
    </svg>
  );
}

function IconZap(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M13 2L3 14h8l-1 8 11-14h-8l0-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2l8 4v6c0 6-4 10-8 10S4 18 4 12V6l8-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12l1.8 1.8L15.8 9.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".9"
      />
    </svg>
  );
}

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M11 19a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M21 21l-3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ------------------------------
// Page
// ------------------------------
export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white antialiased">
      {/* Single-file "global" styles */}
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }
        /* subtle grid background */
        .bg-grid {
          background-image: linear-gradient(
              to right,
              rgba(255, 255, 255, 0.06) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.06) 1px,
              transparent 1px
            );
          background-size: 48px 48px;
        }
        /* noise overlay */
        .noise {
          position: relative;
        }
        .noise::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
          opacity: 0.35;
        }
        /* gradient border */
        .gradient-border {
          position: relative;
        }
        .gradient-border::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.35),
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.25)
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        /* soft glow */
        .glow {
          filter: drop-shadow(0 0 24px rgba(255, 255, 255, 0.12));
        }
        /* floaty */
        @keyframes floaty {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .floaty {
          animation: floaty 6s ease-in-out infinite;
        }
      `}</style>

      {/* Background layers */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 noise" />
        {/* light blobs */}
        <div className="pointer-events-none absolute -top-24 right-[-180px] h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-[-200px] h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <Navbar />
          <Hero />
          <Logos />
          <Bento />
          <Pricing />
          <FAQ />
          <Footer />
        </div>
      </div>
    </main>
  );
}

// ------------------------------
// Components (same file)
// ------------------------------
function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        /
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black font-semibold">
            1
          </span>
          <span className="text-sm tracking-wide text-white/90 group-hover:text-white">
            One Calendar
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex text-sm text-white/70">
          #features
            Features
          </a>
          #pricing
            Pricing
          </a>
          #faq
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          #pricing
            Sign in
          </a>
          #
            Get Early Access
          </a>
        </div>
      </div>
      <div className="mx-auto h-px max-w-6xl bg-white/10" />
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
          <IconSparkles className="h-4 w-4" />
          <span>Minimal. Fast. Focused.</span>
          <span className="text-white/40">•</span>
          <span className="text-white/60">One Calendar v1</span>
        </div>

        <h1 className="mt-8 text-4xl font-semibold tracking-tight md:text-6xl">
          One calendar for{" "}
          <span className="text-white/70">planning</span>,{" "}
          <span className="text-white/70">focus</span> and{" "}
          <span className="text-white/70">shipping</span>.
        </h1>

        <p className="mt-6 text-base leading-relaxed text-white/70 md:text-lg">
          把日程、任务、专注时段整合到一条优雅的时间线上。更少切换，更清晰的今天。
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          #
            Start free
            <IconArrowRight className="ml-2 h-4 w-4" />
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-xlame (replace with real screenshot later) */}
      <div className="mt-14">
        <div className="gradient-border mx-auto max-w-5xl rounded-2xl bg-white/5 p-2">
          <div className="rounded-xl bg-black/60 p-6 md:p-10">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-3 text-xs text-white/50">
                onecalendar.app
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 floaty">
                <p className="text-xs text-white/50">Today</p>
                <p className="mt-2 text-lg font-medium">Deep work</p>
                <p className="mt-1 text-sm text-white/60">09:30 – 11:00</p>
                <div className="mt-4 h-px bg-white/10" />
                <p className="mt-3 text-xs text-white/45">
                  Keyboard-first schedule
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 md:col-span-2">
                <p className="text-xs text-white/50">Timeline</p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 rounded-lg bg-white/5 border border-white/10" />
                    <div className="h-10 flex-1 rounded-lg bg-white/5 border border-white/10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 rounded-lg bg-white/5 border border-white/10" />
                    <div className="h-10 flex-1 rounded-lg bg-white/5 border border-white/10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 rounded-lg bg-white/5 border border-white/10" />
                    <div className="h-10 flex-1 rounded-lg bg-white/5 border border-white/10" />
                  </div>
                </div>

                <p className="mt-4 text-xs text-white/50">
                  （这里可替换为你真实的产品截图：放一张 png / webp 进来就很高级）
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/45">
          Crisp. Monochrome. Confident.
        </p>
      </div>
    </section>
  );
}

function Logos() {
  const items = ["Google Calendar", "Notion", "Slack", "Zoom", "GitHub", "Linear"];

  return (
    <section className="mx-auto max-w-6xl px-6 pb-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-xs text-white/50">
          Works with the tools you already use
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          {items.map((name) => (
            <div
              key={name}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/70"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bento() {
  const features = [
    {
      title: "Unified timeline",
      desc: "日程 + 任务 + 专注时段，统一在一条时间线上。",
      icon: IconCalendar,
      wide: true,
    },
    {
      title: "Lightning fast",
      desc: "键盘优先、瞬时搜索、零等待切换。",
      icon: IconZap,
    },
    {
      title: "Time blocking",
      desc: "把计划变成可执行的时间块。",
      icon: IconClock,
    },
    {
      title: "Privacy first",
      desc: "默认安全，数据最小化与可控导出。",
      icon: IconShield,
    },
    {
      title: "Instant search",
      desc: "跨日程、事件、备注的全局搜索。",
      icon: IconSearch,
      wide: true,
    },
    {
      title: "Delightful details",
      desc: "细节决定体验：留白、对齐、微交互。",
      icon: IconSparkles,
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Built for calm productivity
        </h2>
        <p className="mt-4 text-white/70">
          更少噪音、更清晰节奏。把每一天变成可控、可复盘的系统。
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className={[
              "gradient-border rounded-2xl bg-white/5 p-6 hover:bg-white/10 transition-colors",
              f.wide ? "md:col-span-2" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <f.icon className="h-5 w-5 text-white/80" />
              </span>
              <h3 className="text-base font-medium">{f.title}</h3>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {f.desc}
            </p>

            <div className="mt-6 h-px w-full bg-white/10" />
            <p className="mt-3 text-xs text-white/45">Designed to feel inevitable.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "¥0",
      desc: "适合个人尝鲜",
      features: ["基础日历", "时间块", "跨设备同步", "基础搜索"],
      cta: "Get started",
      highlight: false,
    },
    {
      name: "Pro",
      price: "¥28",
      desc: "适合高频使用者",
      features: [
        "所有 Free",
        "高级搜索",
        "多日视图",
        "模板与重复规则",
        "快捷键增强",
      ],
      cta: "Go Pro",
      highlight: true,
    },
    {
      name: "Team",
      price: "¥68",
      desc: "适合小团队协作",
      features: ["所有 Pro", "共享日历", "权限控制", "团队分析", "优先支持"],
      cta: "Contact sales",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Simple pricing
        </h2>
        <p className="mt-4 text-white/70">
          透明、克制、不玩套路。你随时可以升级或取消。
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={[
              "rounded-2xl p-6",
              p.highlight
                ? "gradient-border bg-white/10 glow"
                : "border border-white/10 bg-white/5",
            ].join(" ")}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-medium">{p.name}</h3>
              <span className="text-sm text-white/60">/ month</span>
            </div>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-semibold">{p.price}</span>
              <span className="text-sm text-white/60">起</span>
            </div>

            <p className="mt-3 text-sm text-white/70">{p.desc}</p>

            <ul className="mt-6 space-y-3">
              {p.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-white/75"
                >
                  <IconCheck className="mt-0.5 h-4 w-4 text-white/70" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="#"
              class      </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-white/45">
        * 价格仅为示例，你可以替换成订阅/买断/教育优惠等。
      </p>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "One Calendar 和传统日历有什么不同？",
      a: "它把日程、任务、专注时段统一到时间线上，让“计划”自然变成“执行”。",
    },
    {
      q: "支持哪些平台？",
      a: "Web 优先，同时可扩展到桌面/移动端（PWA 或原生封装）。",
    },
    {
      q: "我的数据安全吗？",
      a: "默认最小化采集，支持导出，未来可加端到端加密选项。",
    },
    {
      q: "可以和 Google Calendar 同步吗？",
      a: "可以。也可扩展到 CalDAV、ICS 订阅、多账户等。",
    },
  ];

  return (
    <section id="faq" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          FAQ
        </h2>
        <p className="mt-4 text-white/70">常见问题，快速解答。</p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 open:bg-white/10 transition-colors"
          >
            <summary className="cursor-pointer list-none text-sm font-medium">
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h3 className="text-base font-medium">Ready to own your day?</h3>
        <p className="mt-2 text-sm text-white/70">
          现在就开始使用 One Calendar，建立更清晰的节奏。
        </p>

        <a
          href="#"
Access
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">One Calendar</p>
            <p className="mt-2 text-xs text-white/50">
              © {new Date().getFullYear()} One Calendar. All rights reserved.
            </p>
          </div>

          <div className="flex gap-6 text-xs text-white/60">
            #
              Privacy
            </a>
            #
              Terms
            </a>
            #
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
