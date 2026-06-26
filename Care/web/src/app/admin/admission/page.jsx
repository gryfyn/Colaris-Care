import AdmissionForm from "@/components/admission/AdmissionForm";

export const metadata = {
  title: "Admission — Colaris Care",
  description: "Capture the Colaris admission wizard details for a new resident.",
};

export default function AdmissionPage() {
  return <AdmissionForm />;
}
