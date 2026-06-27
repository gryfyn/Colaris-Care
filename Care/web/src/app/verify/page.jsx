import { Suspense } from "react";
import VerifyClient from "./VerifyClient";

export const metadata = {
  title: "Verify your email — Colaris",
  description: "Confirm your email to continue setting up your Colaris facility.",
};

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyClient />
    </Suspense>
  );
}
