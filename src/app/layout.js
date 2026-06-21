import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata = {
  title: "Colaris — Digital products built for care",
  description:
    "Colaris creates healthcare software and independent websites for care organizations. A company by Glass Inc Technologies.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
