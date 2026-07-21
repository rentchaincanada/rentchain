# Phase B B0 Synthetic Data and Privacy Policy

## Mandatory classification

All Phase B data is synthetic, fictional, visibly labelled `qaFixture=true`, namespaced by run, deterministically owned, resettable, auditable, and time-bounded. Realistic fictional data is allowed only when generated without a real-person source, uses clearly fictional labels/test aliases, and cannot reasonably be mistaken for a customer.

No production copy, credentials, real landlord/tenant identity, banking/payment method, credit/screening report, signed lease, government ID, contact information, provider payload, private message, or production Storage object is permitted.

| Domain | Allowed synthetic fixture | Prohibited |
| --- | --- | --- |
| Firebase Auth | dedicated role aliases, random short-lived credentials | real email/phone/customer UID |
| Firestore | fictional landlords, tenants, properties, units, leases, messages, maintenance, contractors, audit states | production export/snapshot |
| Storage/documents | generated placeholder documents | real signed document/ID |
| Screening/payment | state-only facsimiles with no financial/provider authority | reports, instruments, bank/credit data |
| Audit records | synthetic actor/action metadata | raw tokens, payloads, internal production IDs |

```mermaid
flowchart LR
  SC[Fixture schema] -->|privacy and QA approval| MF[Versioned manifest]
  MF --> SD[Synthetic generation]
  SD --> NS[Run namespace and test aliases]
  NS --> QA[Controlled QA]
  QA --> EV[Redacted evidence]
  EV --> CL[Manifest cleanup]
  CL --> VR[Deletion verification and audit record]
```

Fixture manifests carry owner, schema/seed version, run ID, expected counts, created/expiry timestamps, and cleanup authority. Normal retention is seven days; a defect hold may extend to 30 days with privacy/QA approval. Reset deletes only manifest-owned namespaces/accounts/objects and reseeds; collection-wide deletion is forbidden.

Founder — Paul currently owns fixture operations, privacy/data governance, schema approval, security review, and incident response. This is founder-approved and not independently reviewed. Any exception involving real personal information requires separate written authorization and appropriate legal/privacy review; B0 grants none. Any real-data discovery stops QA, revokes access, preserves minimum evidence, deletes/quarantines under privacy direction, and triggers incident review.

Status: **founder-approved and internally accepted under solo-founder governance**. Actual Firebase/data resources, fixtures, reset/deletion, and retention enforcement remain unimplemented.
