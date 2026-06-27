import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export const metadata = {
  title: "Set up your facility — Colaris",
  description: "Tell us about your facility and pick your look. We'll provision your admin and staff workspaces.",
};

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingClient />
    </Suspense>
  );
}
