import { Inter, Marcellus, Marcellus_SC } from "next/font/google";

// DESIGN.md §3 type: Marcellus SC (titles, brand, map labels), Marcellus (character names, big numbers), Inter (all
// data). Self-hosted at build by next/font; each sets a --font-*-face variable that tokens.css builds the families on.

const marcellusSc = Marcellus_SC({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-marcellus-sc-face",
});
const marcellus = Marcellus({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-marcellus-face" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter-face" });

/** Class names for <html>: they define the font variables. */
export const fontVariables = [marcellusSc.variable, marcellus.variable, inter.variable].join(" ");
