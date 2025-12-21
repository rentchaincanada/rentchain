export type PropertyLedgerEntry = {
  id: string;
  propertyId: string;
  tenantId?: string | null;
  date: string;
  label: string;
  type: "charge" | "payment" | "adjustment";
  amount: number;
  runningBalance: number;
};
