import { displayDate, statusTone } from "@/lib/client-api";
import { MASKED } from "@/app/admin/face-sheets/data";

function statusLabel(resident) {
  if (resident?.status === "active") return "Current";
  if (resident?.status === "discharged") return "Discharged";
  return "Review due";
}

function documentSummary(documents, residentId) {
  const residentDocs = documents.filter((doc) => doc.residentId === residentId);
  const faceSheetDoc = residentDocs.find((doc) => String(doc.documentType || "").toLowerCase().includes("face"));
  return {
    count: residentDocs.length,
    latest: faceSheetDoc || residentDocs[0] || null,
  };
}

export function buildFaceSheetFromResident(resident, documents = []) {
  const name = resident?.name || [resident?.firstName, resident?.lastName].filter(Boolean).join(" ") || "Resident";
  const status = statusLabel(resident);
  const docInfo = documentSummary(documents, resident?.id);
  const lastUpdated = displayDate(resident?.updatedAt || docInfo.latest?.createdAt, "Review needed");
  const admitted = displayDate(resident?.admittedAt, "Not recorded");
  const careLevel = resident?.careLevel || "Care level on file";

  return {
    id: resident.id,
    name,
    room: resident.room || "Unassigned",
    wing: careLevel,
    careLevel,
    status,
    tone: statusTone(status),
    sex: "Information on file",
    admitted,
    lastReviewed: docInfo.latest ? displayDate(docInfo.latest.createdAt) : "Review needed",
    lastUpdated,
    primaryContact: { name: "Primary contact on file", relationship: "Responsible party", phone: MASKED },
    emergencyContact: { name: "Emergency contact on file", relationship: "Emergency contact", phone: MASKED },
    physician: { name: "Primary physician on file", phone: MASKED },
    careManager: { name: "Care manager on file", phone: MASKED },
    allergies: { present: false, note: "See medication administration record and clinical documents." },
    codeStatus: "Information on file",
    diet: "Diet order on file",
    mobility: "Mobility support on file",
    supportLevel: careLevel,
    communication: "Communication preferences on file",
    documentCount: docInfo.count,
    faceSheet: {
      legal_name: name,
      preferred_name: resident?.firstName || "Information on file",
      pronouns: "Information on file",
      gender_identity: "Information on file",
      date_of_birth: MASKED,
      age: "Information on file",
      marital_status: "Information on file",
      religious_preference: "Information on file",
      ssn: MASKED,
      resident_id: resident.id,
      previous_address: MASKED,
      date_of_admission: admitted,
      admitted_from: "Information on file",
      legal_status: "Information on file",
      capability: "Information on file",
      advance_directive_status: "Information on file",
      polst_dnr: "Information on file",
      polst_dnr_date: MASKED,
      evacuation_capability: "See evacuation plan",
      mobility_aids: "See care plan",
      primary_insurance: "Insurance on file",
      primary_policy_id: MASKED,
      primary_group: MASKED,
      primary_effective_date: MASKED,
      secondary_insurance: "Information on file",
      secondary_policy_id: MASKED,
      medicare_number: MASKED,
      medicaid_number: MASKED,
      insurance_phone: MASKED,
      subscriber: "Information on file",
      dsm_primary: "See clinical record",
      dsm_secondary: "See clinical record",
      additional_behavioral_dx: "See clinical record",
      physical_dx: "See clinical record",
      additional_medical: "See clinical record",
      allergies_medication: "See MAR and allergy documentation",
      allergies_food_env: "Information on file",
      allergy_severity: "Information on file",
      pcp_name: "Primary physician on file",
      pcp_clinic: MASKED,
      pcp_phone: MASKED,
      psychiatrist_name: "Behavioral health provider on file",
      psychiatrist_clinic: MASKED,
      psychiatrist_phone: MASKED,
      therapist_name: "Therapist on file",
      therapist_phone: MASKED,
      dentist_name: "Dental provider on file",
      dentist_phone: MASKED,
      specialist_type: "Information on file",
      specialist_name: "Information on file",
      specialist_phone: MASKED,
      specialist_address: MASKED,
      additional_specialist: "See provider records on file.",
      preferred_pharmacy: "Preferred pharmacy on file",
      pharmacy_address: MASKED,
      pharmacy_phone: MASKED,
      pharmacy_fax: MASKED,
      backup_pharmacy: "Backup pharmacy on file",
      primary_name: "Primary contact on file",
      primary_relationship: "Responsible party",
      primary_phone_home: MASKED,
      primary_phone_cell: MASKED,
      primary_address: MASKED,
      primary_email: MASKED,
      secondary_name: "Emergency contact on file",
      secondary_relationship: "Emergency contact",
      secondary_phone: MASKED,
      secondary_email: MASKED,
      legal_rep_name: "Information on file",
      legal_rep_authority: "Information on file",
      legal_rep_phone: MASKED,
      legal_rep_email: MASKED,
      legal_rep_address: MASKED,
      guardian_name: "Information on file",
      guardian_phone: MASKED,
      guardian_address: MASKED,
      conservator_name: "Information on file",
      conservator_phone: MASKED,
      conservator_address: MASKED,
      nok_name: "Information on file",
      nok_relationship: "Information on file",
      nok_phone: MASKED,
      nok_email: MASKED,
      nok_address: MASKED,
      case_manager: "Care manager on file",
      agency: "Colaris Care coordination",
      case_manager_phone: MASKED,
      case_manager_email: MASKED,
      therapist_primary: "Therapist on file",
      therapist_contact: MASKED,
      additional_therapist: "Information on file",
      day_program: "Activities program",
      day_program_phone: MASKED,
      day_program_address: MASKED,
      day_program_schedule: "Schedule on file",
      transportation_provider: "Facility transportation",
      transportation_phone: MASKED,
      form_completed_date: admitted,
      form_updated_date: lastUpdated,
      resident_signature: MASKED,
      resident_signature_date: MASKED,
      staff_name_title: "Colaris care team",
      staff_signature_date: lastUpdated,
    },
  };
}

export function buildFaceSheets(residents = [], documents = []) {
  return residents.map((resident) => buildFaceSheetFromResident(resident, documents));
}
