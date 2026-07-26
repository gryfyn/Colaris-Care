import "./globals.css";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_THEME, THEME_COOKIE, THEME_IDS, normalizeTheme } from "@/lib/themes";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Colaris — Care",
  description:
    "Colaris Care — healthcare software for care organizations. A company by Glass Inc Technologies.",
};

function ThemeInitScript() {
  const source = `(function(){try{var ids=${JSON.stringify(THEME_IDS)};var raw=localStorage.getItem("colaris.prefs.v1");var t=raw&&JSON.parse(raw).theme;if(ids.indexOf(t)>-1)document.documentElement.setAttribute("data-cx-theme",t)}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}

export default async function RootLayout({ children }) {
  const theme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value) || DEFAULT_THEME;
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} data-cx-theme={theme} suppressHydrationWarning>
      <body><ThemeInitScript />{children}</body>
    </html>
  );
}
