export type TenantView = {
  id: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  propertyId?: string;
  propertyName?: string;
  unit?: string;
  leaseStart?: string;
  leaseEnd?: string;
  status?: string;
  riskLevel?: string;

  lease: {
    monthlyRent: number;
    unitLabel?: string;
    startDate?: string;
    endDate?: string;
  };

  balance: {
    current: number;
    pastDue: number;
  };

  ledgerSummary: {
    lastPaymentAmount?: number;
    lastPaymentDate?: string;
    totalPaidThisYear?: number;
    ledgerEventCount?: number;
  };

  payments: Array<{
    id: string;
    amount: number;
    paidAt?: string;
    method?: string;
    notes?: string | null;
  }>;
};
