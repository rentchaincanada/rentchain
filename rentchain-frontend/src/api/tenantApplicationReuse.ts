import { tenantApiFetch } from "./tenantApiFetch";

export type TenantApplicationReuseData = {
  applicant: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  currentAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  timeAtCurrentAddressMonths: number | null;
  currentRentAmountCents: number | null;
  employment: {
    employerName: string | null;
    jobTitle: string | null;
    incomeAmountCents: number | null;
    incomeFrequency: "monthly" | "annual" | null;
    monthsAtJob: number | null;
  } | null;
  workReference: {
    name: string | null;
    phone: string | null;
  } | null;
  nextOfKin: {
    name: string | null;
    relationship: string | null;
    phone: string | null;
    address: string | null;
  } | null;
};

export async function fetchTenantApplicationReuse(): Promise<TenantApplicationReuseData> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantApplicationReuseData }>("/tenant/application-reuse");
  return res.data;
}
