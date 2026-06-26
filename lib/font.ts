// lib/font.ts
import localFont from "next/font/local";

export const generalSansBold = localFont({
  src: "../public/GeneralSans-Bold.ttf",
  display: "swap",
  variable: "--font-general-sans-bold",
});