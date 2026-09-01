# Domain authority ADR index

| ADR | Status | Decision scope |
| --- | --- | --- |
| [ADR-001](adr-001-authority-classification.md) | Accepted | Six classifications used by this inventory |
| [ADR-002](adr-002-canonical-state-and-projections.md) | Accepted | Current canonical state and projection precedence |
| [ADR-003](adr-003-legacy-and-external-input-precedence.md) | Accepted | Current legacy and provider-input precedence |
| [ADR-004](adr-004-current-correction-semantics.md) | Current state recorded; open decisions remain | Existing correction mechanisms without imposing future event semantics |

The status “Accepted” means accepted as documentation of current source
behavior. It does not authorize a runtime migration or declare Phase 0
certified.

Related architecture documents remain useful domain references, but are not
automatically authoritative merely because they exist. Runtime code and tests
take precedence where documents have drifted.
