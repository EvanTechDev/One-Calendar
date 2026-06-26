import { Button } from "@/components/ui/button";
import { CreditCardIcon, ArrowRightIcon } from "lucide-react";

export function CallToAction() {
	return (
		<div className="relative mx-auto flex w-full max-w-4xl flex-col justify-between gap-y-10 rounded-[2.5rem] border border-foreground/10 bg-background/5 p-[0.375rem] shadow-sm inset-shadow-2xs">
			<div className="relative flex flex-col justify-center items-center h-full w-full rounded-[calc(2.5rem-0.375rem)] border border-foreground/10 bg-background/80 backdrop-blur-2xl px-6 py-20 md:py-24 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
				<div className="space-y-4">
					<h2 className="text-center font-semibold text-3xl tracking-tight leading-none md:text-5xl">
						Ready to transform your workflow?
					</h2>
				<p className="text-balance text-center text-muted-foreground text-sm md:text-base">
					Join thousands of teams already using Orbit. Start your free trial today. No credit card{" "}
					<CreditCardIcon className="inline-block size-4" />{" "}
					required.
				</p>
			</div>
			<div className="flex items-center justify-center gap-4 mt-6">
				<Button className="rounded-full px-6 py-4 active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)]" variant="secondary">
					View Pricing
				</Button>
				<Button className="rounded-full pl-6 pr-1.5 py-4 active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)] group">
					<span className="mr-4">Get Started</span>
					<div className="flex size-8 items-center justify-center rounded-full bg-background/20 transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-1 group-hover:scale-105">
						<ArrowRightIcon data-icon="inline-end" />
					</div>
				</Button>
			</div>
			</div>
		</div>
	);
}
