import { faceSheetAutofill } from '@/app/components/faceSheetConfig';

describe('faceSheetAutofill', () => {
  it('pulls admission-chain fields into the face sheet autofill snapshot', () => {
    const result = faceSheetAutofill([{
      form_data: {
        dateOfBirth: '1990-01-02',
        primaryDiagnosis: 'Schizoaffective Disorder',
        secondaryDiagnoses: 'PTSD',
        preferredName: 'Alex',
        pronouns: 'they/them',
        legalStatus: 'Voluntary',
        currentLivingSituation: 'Apartment with support',
        primarySubstance: 'Cannabis/Marijuana',
      },
      nursing_assessment_data: {
        emergencyName: 'Jordan Smith',
        emergencyPhone: '555-111-2222',
        emergencyRelationship: 'Sister',
        height: `5'8"`,
      },
      advance_directive_data: {
        healthcare_agent_name: 'Jordan Smith',
        healthcare_agent_phone: '555-111-2222',
        resident_signature_date: '2024-04-30',
        cpr_preference: 'full',
      },
      full_name: 'Jamie Doe',
      intake_date: '2024-05-01T14:22:00.000Z',
    }]);

    expect(result.legal_name).toBe('Jamie Doe');
    expect(result.preferred_name).toBe('Alex');
    expect(result.pronouns).toBe('they/them');
    expect(result.date_of_birth).toBe('1990-01-02');
    expect(result.dsm_primary).toBe('Schizoaffective Disorder');
    expect(result.dsm_secondary).toBe('PTSD');
    expect(result.legal_status).toBe('Voluntary');
    expect(result.admitted_from).toBe('Apartment with support');
    expect(result.primary_name).toBe('Jordan Smith');
    expect(result.primary_phone_cell).toBe('555-111-2222');
    expect(result.legal_rep_name).toBe('Jordan Smith');
    expect(result.date_of_admission).toBe('2024-05-01');
    expect(result.polst_dnr_date).toBe('2024-04-30');
  });

  it('reads the resident API face_sheet_autofill snapshot when present', () => {
    const result = faceSheetAutofill([{
      face_sheet_autofill: {
        insurance_type: 'Medicaid',
        otherInsuranceId: 'M-12345',
        medical_conditions: 'Asthma',
        mobility_aids: 'Walker',
      },
    }]);

    expect(result.primary_insurance).toBe('Medicaid');
    expect(result.primary_policy_id).toBe('M-12345');
    expect(result.additional_medical).toBe('Asthma');
    expect(result.mobility_aids).toBe('Walker');
  });
});
