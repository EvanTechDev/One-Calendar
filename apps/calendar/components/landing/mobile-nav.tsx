import { cn } from "@/lib/utils";
import React from "react";
import { Portal, PortalBackdrop } from "@one-calendar/ui/portal";
import { Button } from "@one-calendar/ui/button";
import { XIcon, MenuIcon } from "lucide-react";

const links = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Company", href: "#company" },
  { label: "Blog", href: "#blog" },
];

export function MobileNav() {
	const [open, setOpen] = React.useState(false);

	return (
		<div className="md:hidden">
			<Button
				aria-controls="mobile-menu"
				aria-expanded={open}
				aria-label="Toggle menu"
				className="md:hidden"
				onClick={() => setOpen(!open)}
				size="icon"
				variant="outline"
			>
				<div
					className={cn(
						"transition-all",
						open ? "scale-100 opacity-100" : "scale-0 opacity-0"
					)}
				>
					<XIcon
					/>
				</div>
				<div
					className={cn(
						"absolute transition-all",
						open ? "scale-0 opacity-0" : "scale-100 opacity-100"
					)}
				>
					<MenuIcon
					/>
				</div>
			</Button>
			{open && (
				<Portal className="top-14">
					<PortalBackdrop />
					<div
						className={cn(
							"size-full overflow-y-auto p-6",
							"data-[slot=open]:zoom-in-97 ease-out data-[slot=open]:animate-in"
						)}
						data-slot={open ? "open" : "closed"}
					>
						<div className="flex w-full flex-col gap-y-4">
							{links.map((link) => (
								<a
									key={link.label}
									href={link.href}
									className="text-lg font-medium text-foreground py-2 border-b border-border/50 active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)]"
								>
									{link.label}
								</a>
							))}
						</div>
						<div className="mt-8 flex flex-col gap-3">
							<Button className="w-full h-12 text-base active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)]" variant="outline">
								Sign In
							</Button>
							<Button className="w-full h-12 text-base active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)]">Get Started</Button>
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
