import { cn } from "@/lib/utils";
import {
	NotionIcon,
	CursorIcon,
	VercelIcon,
	PlanetscaleIcon,
	GmailIcon,
	SupabaseIcon,
	CanvaIcon,
	AdobeIcon,
	PolarIcon,
} from "./brand-icons";

type LogoType = {
	icon: React.ComponentType<{ className?: string }>;
	alt: string;
	className?: string;
};

type TileData = {
	row: number;
	col: number;
	logo?: LogoType;
};

export function Integrations() {
	return (
		<div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 p-4 md:grid-cols-2 md:items-center">
			{/* Left Content */}
			<div className="max-w-xl space-y-5">
				<h2 className="font-medium text-3xl text-foreground tracking-tight sm:text-4xl md:text-5xl">
					Seamless Integration
				</h2>
				<p className="text-lg text-muted-foreground leading-8">
					Integrate with over 100+ tools and platforms to streamline your
					workflow and boost productivity.
				</p>
			</div>

			{/* Right Content - Visual */}
			<div className="place-items-end">
				<div className="mask-[radial-gradient(ellipse_at_center,black,black,transparent)] relative size-90">
					{tiles.map((tile) => (
						<IntegrationCard key={`${tile.row}_${tile.col}`} {...tile} />
					))}
				</div>
			</div>
		</div>
	);
}

function IntegrationCard({ row, col, logo }: TileData) {
	return (
		<div
			className={cn(
				"absolute flex size-18 items-center justify-center rounded-md border",
				logo
					? "bg-card shadow-xs dark:bg-card/60"
					: "bg-secondary/30 dark:bg-background"
			)}
			style={{
				left: col * 72,
				top: row * 72,
			}}
		>
			{logo && (
				<logo.icon
					className={cn(
						"pointer-events-none size-8 select-none",
						logo.className
					)}
				/>
			)}
		</div>
	);
}

const tiles: TileData[] = [
	// Row 0
	{ row: 0, col: 1 },
	{ row: 0, col: 3, logo: { icon: NotionIcon, alt: "Notion" } },

	// Row 1
	{ row: 1, col: 0 },
	{ row: 1, col: 2, logo: { icon: CursorIcon, alt: "Cursor" } },
	{ row: 1, col: 4, logo: { icon: VercelIcon, alt: "Vercel" } },

	// Row 2
	{ row: 2, col: 1, logo: { icon: PlanetscaleIcon, alt: "Planetscale" } },
	{ row: 2, col: 3, logo: { icon: GmailIcon, alt: "Gmail" } },

	// Row 3
	{ row: 3, col: 0 },
	{ row: 3, col: 2, logo: { icon: SupabaseIcon, alt: "Supabase" } },
	{ row: 3, col: 4, logo: { icon: CanvaIcon, alt: "Canva" } },

	// Row 4
	{ row: 4, col: 1, logo: { icon: AdobeIcon, alt: "Adobe" } },
	{ row: 4, col: 3, logo: { icon: PolarIcon, alt: "Polar" } },
];
