import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

export function CallToAction() {
	return (
		<div className="relative mx-auto flex w-full max-w-4xl flex-col justify-between gap-y-10 rounded-[2.5rem] border border-foreground/10 bg-background/5 p-[0.375rem] shadow-sm inset-shadow-2xs">
			<div className="relative flex flex-col justify-center items-center h-full w-full rounded-[calc(2.5rem-0.375rem)] border border-foreground/10 bg-background/80 backdrop-blur-2xl px-6 py-20 md:py-24 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
				<div className="space-y-4">
					<h2 className="text-center font-semibold text-3xl tracking-tight leading-none md:text-5xl">
						Ready to take control of your time?
					</h2>
				<p className="text-balance text-center text-muted-foreground text-sm md:text-base">
					One Calendar helps you keep every event, reminder, and schedule in sync. Free forever.
				</p>
			</div>
			<div className="flex items-center justify-center gap-4 mt-6">
			<Link href="/sign-up">
              <Button className="rounded-full pl-4 pr-1 py-2 text-sm active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)] group">
                <span className="mr-3">Get started</span>
                <div className="flex size-6 items-center justify-center rounded-full bg-background/20 transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                  <ArrowRightIcon data-icon="inline-end" />
                </div>
              </Button>
            </Link>
			</div>
			</div>
		</div>
	);
}
