# RentChain domain authority index

Status: current-state inventory

Mission: P0-01

Exact source baseline: `569d5b5aded36a6a7f34695a211bf1c43f1a15cc`

This directory records which current RentChain models own domain truth and which
models are derived, projected, cached, legacy, or external. It is documentation
and future certification input; it is not runtime configuration.

The inventory describes repository behavior at the baseline above. It does not
certify the complete canonical-domain foundation and does not authorize later
implementation.

## Documents

- [`authority-inventory.json`](authority-inventory.json): machine-readable domain,
  state, writer, frontend, provider, administration, event, and decision records.
- [`writer-census.md`](writer-census.md): human-readable writer census and core
  invariants.
- [`adr-index.md`](adr-index.md): decisions adopted for documenting current state
  and decisions intentionally left open.
- [`adr-001-authority-classification.md`](adr-001-authority-classification.md)
- [`adr-002-canonical-state-and-projections.md`](adr-002-canonical-state-and-projections.md)
- [`adr-003-legacy-and-external-input-precedence.md`](adr-003-legacy-and-external-input-precedence.md)
- [`adr-004-current-correction-semantics.md`](adr-004-current-correction-semantics.md)
- [`open-decisions.md`](open-decisions.md)

## Permanent direction

External input is validated and normalized before it may influence governed
facts. Canonical state owns product truth. Projections serve consumers and do
not become alternate authority. Ambiguity fails closed. Corrections use the
domain's demonstrated governed mechanism and preserve its audit evidence.

## Phase 0 boundary

This inventory is sufficient to bound P0-02, the Frontend Canonical Signing
Consumer mission. Remaining Phase 0 work includes frontend correction,
mandatory canonical CI, emulator-backed transaction testing, alternate-writer
certification, and the final machine-readable foundation certificate.
