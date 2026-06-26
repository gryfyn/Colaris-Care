import { PrefsProvider } from "@/components/app/prefs";
import QueryProvider from "@/components/app/QueryProvider";
import Shell from "@/components/app/Shell";

export default function AppLayout({ children }) {
  return (
    <QueryProvider>
      <PrefsProvider>
        <Shell>{children}</Shell>
      </PrefsProvider>
    </QueryProvider>
  );
}
