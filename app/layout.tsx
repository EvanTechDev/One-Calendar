import "./globals.css";
import { Instrument_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const instrumentSans = Instrument_Sans({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL("https://ui.abdulrahmanasif.dev"),
  title: "Efferd - Modern Landing Page",
  description: "A beautiful, modern landing page template.",
};

export default function EfferdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground antialiased min-h-screen",
          instrumentSans.className,
        )}
      >
        {children}
      </body>
    </html>
  );
}
