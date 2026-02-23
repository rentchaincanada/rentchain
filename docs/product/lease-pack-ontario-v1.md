# Ontario Lease Pack v1

## Scope
- Province scope: Ontario only for this pack.
- Flow consistency: same Lease Pack UX pattern as other provinces.
- Liability posture: generated outputs are draft/supporting documents; landlord explicitly sends any legally binding notice.

## Pack Composition
The v1 Ontario Lease Pack contains:

1. Ontario lease data summary page (`PDF`)
2. Schedule addendum template populated from lease inputs (`PDF`, `DOCX`)
3. Payment terms summary (`PDF`)
4. Utilities and inclusions summary (`PDF`)
5. Additional clauses attachment (`PDF`, `DOCX`)
6. Compliance summary page (`PDF`)

## Included Compliance Summary Content
- Province: Ontario
- Template version
- Key timing guardrails used by automation checks
- Reminder that users must review and send notices explicitly

## Not Included In v1
- Automatic sending of legally binding notices
- Province-specific government base form generation
- Legal advice language

## Output Formats
- Bundle download (zip): mixed `PDF` and `DOCX` files where listed above
- Individual document download: each file available separately

## Versioning
- Pack identifier: `ontario-lease-pack-v1`
- Each generated artifact should include a template version marker in metadata.

## QA Checklist
- Ontario property shows Ontario pack contents.
- Pack includes expected files and formats.
- Compliance summary page is included in the generated bundle.
- Legally binding notice actions remain explicit user actions.

## Rollback Note
- If generation issues occur, disable Ontario bundle entry point and retain per-document downloads until fixed.

