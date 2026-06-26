import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login — Colaris Care",
  description: "Role-aware login for Colaris Care admin and staff workspaces.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
