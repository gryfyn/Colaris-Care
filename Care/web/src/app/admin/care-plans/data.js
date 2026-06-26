export const CARE_PLANS = [];

export function getCarePlan(id) {
  return CARE_PLANS.find((plan) => plan.id === id);
}
