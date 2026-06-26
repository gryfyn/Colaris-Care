export const MEDICATIONS = [
  { id: 1, resident: "Eleanor Whitfield", drug: "Sertraline", strength: "50 mg", dosage: "1 tablet", route: "Oral", frequency: "Every morning", prescriber: "Dr. Maya Chen", active: true, prn: false, controlled: false, instruction: "Give with breakfast." },
  { id: 2, resident: "Rosa Iniguez", drug: "Metformin", strength: "500 mg", dosage: "1 tablet", route: "Oral", frequency: "Twice daily", prescriber: "Dr. Oliver Grant", active: true, prn: false, controlled: false, instruction: "Give with food." },
  { id: 3, resident: "Marcus Bell", drug: "Lorazepam", strength: "0.5 mg", dosage: "1 tablet", route: "Oral", frequency: "As needed", prescriber: "Dr. Maya Chen", active: true, prn: true, controlled: true, instruction: "For acute anxiety; document observed symptoms." },
  { id: 4, resident: "Grace Tan", drug: "Lisinopril", strength: "10 mg", dosage: "1 tablet", route: "Oral", frequency: "Once daily", prescriber: "Dr. Oliver Grant", active: true, prn: false, controlled: false, instruction: "Check blood pressure before administration." },
  { id: 5, resident: "Lillian Park", drug: "Donepezil", strength: "5 mg", dosage: "1 tablet", route: "Oral", frequency: "At bedtime", prescriber: "Dr. Priya Shah", active: true, prn: false, controlled: false, instruction: "Administer at the same time each evening." },
  { id: 6, resident: "Eleanor Whitfield", drug: "Acetaminophen", strength: "325 mg", dosage: "2 tablets", route: "Oral", frequency: "As needed", prescriber: "Dr. Maya Chen", active: true, prn: true, controlled: false, instruction: "For pain; do not exceed ordered daily maximum." },
  { id: 7, resident: "Rosa Iniguez", drug: "Atorvastatin", strength: "20 mg", dosage: "1 tablet", route: "Oral", frequency: "Every evening", prescriber: "Dr. Oliver Grant", active: false, prn: false, controlled: false, instruction: "Discontinued after medication review." },
  { id: 8, resident: "Marcus Bell", drug: "Prazosin", strength: "1 mg", dosage: "1 capsule", route: "Oral", frequency: "At bedtime", prescriber: "Dr. Priya Shah", active: true, prn: false, controlled: false, instruction: "Monitor for dizziness when standing." },
];

export const ADMIN_HISTORY = [
  { id: 1, when: "Today · 9:02 AM", resident: "Grace Tan", drug: "Lisinopril", dose: "10 mg", staff: "Priya Nair", status: "Given", notes: "Blood pressure checked before dose." },
  { id: 2, when: "Today · 8:14 AM", resident: "Rosa Iniguez", drug: "Metformin", dose: "500 mg", staff: "Dauda Okafor", status: "Given", notes: "Given with breakfast." },
  { id: 3, when: "Today · 8:07 AM", resident: "Eleanor Whitfield", drug: "Sertraline", dose: "50 mg", staff: "Dauda Okafor", status: "Given", notes: "No side effects observed." },
  { id: 4, when: "Yesterday · 8:41 PM", resident: "Marcus Bell", drug: "Prazosin", dose: "1 mg", staff: "Amara Koch", status: "Refused", notes: "Resident declined after two offers." },
];
