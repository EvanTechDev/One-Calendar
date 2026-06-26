import { LogoCloud } from "./logo-cloud";

export function LogosSection() {
	return (
		<section className="mx-auto h-full max-w-3xl space-y-4 px-4 py-10 md:px-8">
			<h2 className="text-center font-medium text-lg text-muted-foreground tracking-tight md:text-xl">
				Trusted by <span className="text-foreground">experts</span>
			</h2>
			<LogoCloud />
		</section>
	);
}
