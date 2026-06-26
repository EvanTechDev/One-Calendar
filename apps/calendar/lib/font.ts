// lib/font.ts
import localFont from "next/font/local";

export const generalSansBold = localFont({
  src: "../app/GeneralSans-Bold.ttf",
  display: "swap",
  variable: "--font-general-sans-bold",
});