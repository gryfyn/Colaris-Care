import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata = {
  title: "Reset password — Colaris Care",
  description: "Reset your Colaris Care password.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  );
}
