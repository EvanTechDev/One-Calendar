import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { generalSansBold } from "@/lib/font";

type FooterLink = {
  title: string;
  href: string;
  icon?: ReactNode;
};

type FooterSection = {
  label: string;
  links: FooterLink[];
};

const footerLinks: FooterSection[] = [
  {
    label: "Company",
    links: [
      { title: "FAQs", href: "#" },
      { title: "About Us", href: "#" },
      { title: "Privacy Policy", href: "/privacy" },
      { title: "TOS", href: "/terms" },
    ],
  },
  {
    label: "Resources",
    links: [
      { title: "Docs", href: "#" },
      { title: "Changelog", href: "/changelog" },
      { title: "Brand", href: "#" },
      { title: "Help", href: "mailto:evan.huang000@proton.me" },
      { title: "Status", href: "https://calendarstatus.xyehr.cn" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className={cn(
        "md:rounded-t-6xl relative mx-auto flex w-full mt-20 pt-10 max-w-5xl flex-col items-center justify-center rounded-t-4xl border-t px-6 md:px-8",
        "dark:bg-[radial-gradient(35%_128px_at_50%_0%,--theme(--color-foreground/.1),transparent)]",
      )}
    >
      <div className="bg-foreground/20 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

      <div className="grid gap-8 py-6 md:py-8 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4">
          <svg
          version="1.0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          aria-label="One Calendar"
          role="img"
          className="text-white h-9 w-9"
        >
          <g
            transform="translate(0,1000) scale(0.1,-0.1)"
            fill="currentColor"
            stroke="none"
          >
            <path d="M4960 8206 c-87 -24 -164 -70 -231 -136 -101 -101 -149 -217 -149 -360 0 -144 48 -259 150 -360 102 -102 218 -150 360 -150 140 0 264 53 365 156 194 198 194 508 0 709 -67 69 -165 125 -253 144 -68 14 -184 13 -242 -3z" />
            <path d="M3616 6859 c-109 -26 -239 -117 -307 -215 -97 -141 -111 -350 -34 -510 61 -126 166 -217 305 -264 55 -19 82 -21 175 -18 102 3 115 6 185 39 147 70 239 172 281 311 17 57 21 88 18 182 -4 109 -5 115 -46 198 -68 136 -202 245 -343 277 -54 13 -180 12 -234 0z" />
            <path d="M4963 6855 c-228 -64 -383 -263 -383 -493 0 -149 45 -259 149 -363 105 -105 212 -149 362 -149 188 0 345 90 443 254 70 117 85 297 35 434 -48 130 -170 250 -306 302 -75 29 -225 37 -300 15z" />
            <path d="M4940 5491 c-91 -29 -142 -61 -211 -130 -103 -103 -149 -214 -149 -361 0 -328 308 -570 629 -495 279 66 450 358 373 636 -46 164 -177 299 -340 349 -83 26 -224 26 -302 1z" />
            <path d="M4980 4149 c-81 -16 -188 -76 -255 -145 -97 -100 -145 -215 -145 -354 0 -147 46 -258 149 -361 105 -105 212 -149 362 -149 455 0 680 547 358 869 -121 122 -296 174 -469 140z" />
            <path d="M3601 2784 c-116 -31 -242 -125 -306 -229 -65 -105 -87 -283 -50 -410 61 -215 263 -365 490 -365 134 0 244 43 343 135 118 109 162 211 162 376 0 160 -46 267 -159 371 -103 96 -213 139 -351 137 -41 0 -99 -7 -129 -15z" />
            <path d="M4959 2785 c-85 -23 -162 -69 -229 -135 -102 -101 -150 -216 -150 -360 0 -147 57 -278 162 -374 205 -187 515 -181 709 13 157 157 193 397 91 600 -56 112 -196 223 -326 257 -63 17 -195 17 -257 -1z" />
            <path d="M6311 2784 c-76 -20 -146 -60 -212 -122 -113 -104 -159 -211 -159 -371 0 -189 74 -329 228 -431 103 -68 259 -97 385 -71 130 28 271 129 336 245 86 151 86 361 1 512 -38 65 -141 164 -208 198 -109 55 -256 71 -371 40z" />
          </g>
        </svg>
          <p className="text-muted-foreground mt-8 text-sm md:mt-0">
            Schedule everything. Own your time.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 lg:col-span-2 lg:mt-0">
          {footerLinks.map((section, index) => (
            <div className="mb-10 md:mb-0" key={section.label}>
              <h3 className="text-xs">{section.label}</h3>
              <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <a
                      className="hover:text-foreground inline-flex items-center duration-250 [&_svg]:me-1 [&_svg]:size-4"
                      href={link.href}
                      key={`${section.label}-${link.title}`}
                    >
                      {link.icon}
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="via-border h-px w-full bg-linear-to-r" />
      <div className="overflow-hidden pt-8">
        <h2 className={`${generalSansBold.className} text-center text-8xl tracking-tight text-foreground/10 md:text-[10rem] lg:text-[14rem] text-white`}>
          ZENTRA
        </h2>
      </div>
    </footer>
  );
}
