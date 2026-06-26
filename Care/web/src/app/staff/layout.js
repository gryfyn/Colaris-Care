import { PrefsProvider } from "@/components/app/prefs";
import QueryProvider from "@/components/app/QueryProvider";
import StaffShell from "@/components/app/StaffShell";

export default function StaffLayout({ children }) {
  return <QueryProvider><PrefsProvider><StaffShell>{children}</StaffShell></PrefsProvider></QueryProvider>;
}
