import { PrefsProvider } from "@/components/app/prefs";
import QueryProvider from "@/components/app/QueryProvider";
import Shell from "@/components/app/Shell";
import { cookies } from "next/headers";
import { THEME_COOKIE, normalizeTheme } from "@/lib/themes";

export default async function AppLayout({ children }) {
  // null when absent (not DEFAULT_THEME): PrefsProvider then falls back to the
  // pre-hydration script's localStorage value instead of overriding it.
  const initialTheme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <QueryProvider>
      <PrefsProvider initialTheme={initialTheme}>
        <Shell>{children}</Shell>
      </PrefsProvider>
    </QueryProvider>
  );
}
