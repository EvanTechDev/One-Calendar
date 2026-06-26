// lib/font.ts
import localFont from "next/font/local";
import type { NextFontWithVariable } from "next/dist/compiled/@next/font";

export const generalSansBold: NextFontWithVariable = localFont({
  src: "../app/GeneralSans-Bold.ttf",
  display: "swap",
  variable: "--font-general-sans-bold",
});