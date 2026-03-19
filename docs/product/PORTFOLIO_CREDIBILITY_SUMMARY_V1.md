# Portfolio Credibility Summary v1

## Purpose
Add a compact landlord-facing portfolio rollup so operators can see overall credibility health without drilling into each property.

## Surface
- Landlord dashboard
- One compact portfolio credibility summary card below the KPI strip

## Metrics
- portfolio tenant score average
- portfolio lease risk average
- active lease count
- property count represented
- tenants with score count
- leases with risk count
- low-confidence count
- missing credibility count
- overall health status

## Health logic
- `unknown`: no active lease evidence
- `limited-data`: no usable score/risk evidence or missing credibility is 40%+ of evidence slots
- `strong`: average credibility is healthy with limited missing and low-confidence records
- `watch`: everything else

Low-confidence records use the shared threshold of `< 0.65`.

## v1 scope
- uses only active leases
- deduplicates tenant IDs across linked leases
- does not expose timelines or heavy analytics
- does not add alerts, filters, or trend charts

## Follow-up ideas
- drill-down by property
- trend over time
- confidence filtering
- credibility alerts for watch/limited-data portfolios
