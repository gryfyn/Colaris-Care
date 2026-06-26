export function mapAdmission(row) {
  if (!row) return null;
  const firstName = row.first_name || row.candidate_first_name || "";
  const lastName = row.last_name || row.candidate_last_name || "";
  return {
    id: row.id,
    residentId: row.resident_id,
    admissionCaseId: row.admission_case_id,
    status: row.status,
    candidateFirstName: row.candidate_first_name || firstName,
    candidateLastName: row.candidate_last_name || lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: row.email,
    room: row.room,
    careLevel: row.care_level,
    admittedAt: row.admitted_at,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    answers: row.answers || {},
  };
}

export function mapAdmissions(rows) {
  return Array.isArray(rows) ? rows.map(mapAdmission) : [];
}
