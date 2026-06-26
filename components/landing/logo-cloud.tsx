import {
	SupabaseIcon,
	GitHubIcon,
} from "./brand-icons";
import { SiVercel, SiDrizzle, SiBetterauth } from "react-icons/si";
import { BiLogoTypescript } from "react-icons/bi";
import { RiNextjsFill, RiTailwindCssFill } from "react-icons/ri";
import { FaReact } from "react-icons/fa";

export function LogoCloud() {
	return (
		<div className="relative flex flex-wrap items-center justify-center gap-x-10 gap-y-8 py-6 sm:gap-x-12 sm:gap-y-12">
			{logos.map((logo) => (
				<div key={logo.alt} className="flex items-center gap-2 text-muted-foreground">
					<logo.icon className="h-6 w-6 ${logo.color}" />
					<span className="font-semibold">{logo.label}</span>
				</div>
			))}
		</div>
	);
}

const logos = [
	{ icon: SiVercel, label: "Vercel", alt: "Vercel Logo", color: "text-[#ffffff ]" },
	{ icon: SupabaseIcon, label: "Supabase", alt: "Supabase Logo" },
	{ icon: GitHubIcon, label: "GitHub", alt: "GitHub Logo", color: "text-[#ffffff]" },
	{ icon: BiLogoTypescript, label: "TypeScript", alt: "TS Logo", color: "text-[#3178C6]" },
	{ icon: RiNextjsFill, label: "Next.js", alt: "Nextjs Logo", color: "text-[#ffffff]" },
	{ icon: FaReact, label: "React", alt: "React Logo", color: "text-[#61DAFB]" },
	{ icon: RiTailwindCssFill, label: "TailwindCSS", alt: "TailwindCSS Logo", color: "text-[#06B6D4]" },
	{ icon: SiDrizzle, label: "Drizzle", alt: "Drizzle Logo", color: "text-[#C5F74F]" },
	{ icon: SiBetterauth, label: "Better Auth", alt: "Better Auth Logo", color: "text-[#ffffff]" },
];
