import {
	VercelIcon,
	SupabaseIcon,
	OpenAIIcon,
	DubIcon,
	TursoIcon,
	GitHubIcon,
	ClaudeIcon,
	NvidiaIcon,
	ClerkIcon,
	BoltIcon,
	StripeIcon,
} from "./brand-icons";

export function LogoCloud() {
	return (
		<div className="relative flex flex-wrap items-center justify-center gap-x-10 gap-y-8 py-6 sm:gap-x-12 sm:gap-y-12">
			{logos.map((logo) => (
				<div key={logo.alt} className="flex items-center gap-2 text-muted-foreground">
					<logo.icon className="h-6 w-6" />
					<span className="font-semibold">{logo.label}</span>
				</div>
			))}
		</div>
	);
}

const logos = [
	{ icon: VercelIcon, label: "Vercel", alt: "Vercel Logo" },
	{ icon: SupabaseIcon, label: "Supabase", alt: "Supabase Logo" },
	{ icon: OpenAIIcon, label: "OpenAI", alt: "OpenAI Logo" },
	{ icon: DubIcon, label: "Dub", alt: "Dub Logo" },
	{ icon: TursoIcon, label: "Turso", alt: "Turso Logo" },
	{ icon: GitHubIcon, label: "GitHub", alt: "GitHub Logo" },
	{ icon: ClaudeIcon, label: "Claude AI", alt: "Claude AI Logo" },
	{ icon: NvidiaIcon, label: "Nvidia", alt: "Nvidia Logo" },
	{ icon: ClerkIcon, label: "Clerk", alt: "Clerk Logo" },
	{ icon: BoltIcon, label: "Bolt", alt: "Bolt Logo" },
	{ icon: StripeIcon, label: "Stripe", alt: "Stripe Logo" },
];
