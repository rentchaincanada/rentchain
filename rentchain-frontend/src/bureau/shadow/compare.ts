type Comparable = {
  provider?: string;
  ok: boolean;
  totalAmountCents?: number;
  currency?: string;
  eligible?: boolean;
  checkoutUrlPresent?: boolean;
  orderIdPresent?: boolean;
  errorCode?: string;
};

const isEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
};

export function comparePrimaryVsShadow(primary: Comparable, shadow: Comparable): {
  isMatch: boolean;
  fields: string[];
} {
  const checkedFields: Array<keyof Comparable> = [
    "provider",
    "ok",
    "totalAmountCents",
    "currency",
    "eligible",
    "checkoutUrlPresent",
    "orderIdPresent",
    "errorCode",
  ];

  const fields = checkedFields.filter((field) => !isEqual(primary[field], shadow[field]));
  return {
    isMatch: fields.length === 0,
    fields,
  };
}
