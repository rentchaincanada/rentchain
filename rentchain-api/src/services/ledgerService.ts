import { db } from "../config/firebase";
import { buildBlockchainFromLedgerEvents } from "../blockchain";
import { saveChainHeadSnapshot } from "../services/chainHeadService";
import { getTenantDetailBundle } from "../services/tenantDetailsService";


interface LedgerEventInput {
  tenantId: string;
  type: string;
  amount: number;
  date: string;
  method: string;
  notes: string;
}

export async function writeLedgerEvent(input: LedgerEventInput) {
  const ref = db.collection("ledgerEvents").doc();

  const data = {
    id: ref.id,
    tenantId: input.tenantId,
    type: input.type,
    amount: input.amount,
    date: input.date,
    method: input.method,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  
const bundle = await getTenantDetailBundle(tenantId);
const allLedger = bundle.ledger || [];
const chain = buildBlockchainFromLedgerEvents(allLedger);
const last = chain[chain.length - 1];

  await ref.set(data);
await saveChainHeadSnapshot({
  blockHeight: last.index,
  rootHash: last.hash,
  eventId: last.eventId,
});

  return data;
}
