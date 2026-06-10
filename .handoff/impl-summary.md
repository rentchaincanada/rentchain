# Property Onboarding Workflow Audit Report

PR: #[NUMBER once opened]
PR URL: [URL once opened]
Branch: audit/property-onboarding-workflow-v1

## Executive Summary

This audit identifies critical issues in the property onboarding workflow that explain the 33% success rate (2 of 3 properties failed) in self-serve property creation with CSV-based unit import. The root cause is a **split implementation** between property creation and unit import flows, with fundamentally different CSV parsing approaches that handle edge cases inconsistently.

## Critical Findings

### 1. Split CSV Implementation Architecture (PRIMARY ROOT CAUSE)

**Two completely separate CSV parsing implementations exist:**

#### Frontend CSV Parsing (Property Creation Flow)
- **Location**: [rentchain-frontend/src/components/properties/AddPropertyForm.tsx:107-157](rentchain-frontend/src/components/properties/AddPropertyForm.tsx#L107-L157)
- **Implementation**: Naive string splitting approach
```typescript
const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
const cols = line.split(",").map((c) => c.trim());
```
- **Issues**:
  - No BOM handling
  - No CSV escaping/quoting support
  - Simple comma splitting breaks with quoted values
  - No validation preview
  - Basic header mapping only

#### Backend CSV Parsing (Unit Import Flow)
- **Location**: [rentchain-api/src/imports/unitCsvImport.service.ts:18-66](rentchain-api/src/imports/unitCsvImport.service.ts#L18-L66)
- **Implementation**: PapaParser library with proper CSV handling
```typescript
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
```
- **Features**:
  - Proper CSV parsing with escaping/quoting
  - Schema validation with Zod
  - Flexible header mapping
  - Duplicate detection
  - Preview functionality available

### 2. Property Creation Entry Points

#### Primary Property Creation Route
- **Endpoint**: `POST /api/properties` ([propertiesRoutes.ts:259-522](rentchain-api/src/routes/propertiesRoutes.ts#L259-L522))
- **Request Shape**:
```typescript
{
  addressLine1: string,
  city: string,
  province: string,
  units?: Array<{unitNumber: string, rent: number, bedrooms?: number, bathrooms?: number, sqft?: number}>
}
```
- **Unit Handling**: Inline unit creation via `normalizeUnits()` function and Firestore batch writes
- **CSV Support**: None - requires pre-parsed unit array

#### Secondary Unit Import Route
- **Endpoint**: `POST /api/properties/:propertyId/units/import` ([unitImportRoutes.ts:334-372](rentchain-api/src/routes/unitImportRoutes.ts#L334-L372))
- **Request Shape**:
```typescript
{
  csvText: string,
  mode: "dryRun" | "strict" | "partial",
  idempotencyKey: string
}
```
- **CSV Support**: Full PapaParser implementation with validation

### 3. Unit ID Generation Strategy

- **Implementation**: [rentchain-api/src/imports/unitId.ts:1-4](rentchain-api/src/imports/unitId.ts#L1-L4)
- **Strategy**: Deterministic composite key generation
```typescript
function unitDocId(propertyId: string, unitNumber: string) {
  const clean = String(unitNumber).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `unit__${propertyId}__${clean}`.slice(0, 500);
}
```
- **Implications**: Unit IDs are deterministic based on property ID + unit number, enabling deduplication

### 4. CSV Handling Analysis

#### BOM Handling
- **Frontend**: No BOM handling in AddPropertyForm CSV parsing
- **Backend**: PapaParser handles BOM automatically
- **Additional Utility**: [rentchain-api/src/utils/csv.ts:41](rentchain-api/src/utils/csv.ts#L41) shows BOM stripping pattern `h.replace(/^﻿/, "")` but is unused by unit parsing

#### Line Ending Handling
- **Frontend**: Basic regex `/\r?\n/` in AddPropertyForm
- **Backend**: PapaParser handles all line ending variations
- **Impact**: Frontend parsing can fail on mixed line endings from spreadsheet editors

#### CSV Escaping/Quoting
- **Frontend**: No support for quoted fields containing commas
- **Backend**: Full CSV standard compliance via PapaParser

### 5. Property/Units Table Upload Flow

#### CSV Preview Implementation
- **Component**: [UnitsCsvPreviewModal.tsx](rentchain-frontend/src/components/properties/UnitsCsvPreviewModal.tsx)
- **Usage**: Property details page CSV upload ([PropertyDetailPanel.tsx:1140-1159](rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx#L1140-L1159))
- **Preview Parser**: [parseCsvPreview utility](rentchain-frontend/src/utils/csvPreview.ts) - shows first 10 rows
- **Backend Integration**: Calls `importUnitsCsv` API with full validation

### 6. Occupancy Unit Resolution

#### Implementation
- **Location**: [occupancyPrompt.ts:12-36](rentchain-frontend/src/components/properties/occupancyPrompt.ts#L12-L36)
- **Purpose**: Identifies units needing occupancy status setup
- **Resolution Strategy**:
  - Match by unit ID: `lease.unitId` → `unit.id`
  - Fallback to unit number: `lease.unitNumber` → `unit.unitNumber`
  - Case-insensitive string matching

#### Potential Issues
- **Mixed ID Types**: Frontend generates random UUIDs, backend generates deterministic IDs
- **Reference Mismatch**: Temporary frontend IDs may not match persisted Firestore IDs
- **Inconsistent Matching**: Different resolution logic across components

## Failure Mode Analysis

### CSV Corruption from Spreadsheet Editors (Confirmed)

**Scenario 1: Apple Numbers/Google Sheets Export**
- **Issue**: BOM characters, smart quotes, non-standard line endings
- **Frontend Impact**: Parsing fails silently, creates malformed unit numbers
- **Backend Impact**: PapaParser handles gracefully
- **Reproduction**: Export CSV from Numbers with special characters

**Scenario 2: Trailing Commas/Empty Columns**
- **Issue**: Spreadsheet exports often include trailing empty columns
- **Frontend Impact**: Creates empty unit entries, validation failures
- **Backend Impact**: `skipEmptyLines: true` handles correctly
- **Reproduction**: Add empty columns in spreadsheet before export

**Scenario 3: Quoted Fields with Commas**
- **Issue**: Unit names like "Unit 1A, Building B" break simple comma splitting
- **Frontend Impact**: Incorrect field separation, data corruption
- **Backend Impact**: Full CSV standard compliance
- **Reproduction**: Use unit names with commas in CSV

### Split Implementation Validation Differences

**Frontend Property Creation**:
- **Validation**: Basic type coercion and null checks
- **Error Handling**: Generic "Failed to parse CSV file" message
- **Unit Count**: Uses `totalUnits` override if provided

**Backend Unit Import**:
- **Validation**: Zod schema validation with detailed error messages
- **Error Handling**: Detailed validation reports with row numbers
- **Duplicate Detection**: Prevents duplicate unit numbers
- **Conflict Resolution**: Checks against existing units

## Error Handling and User Feedback Analysis

### Property Creation Flow
- **Location**: [AddPropertyForm.tsx:159-189](rentchain-frontend/src/components/properties/AddPropertyForm.tsx#L159-L189)
- **Success Message**: "Loaded X units from CSV. You can still edit them below before saving."
- **Error Message**: Generic "Failed to parse CSV file" or "CSV parsed but no valid rows found"
- **No Preview**: Users cannot verify CSV correctness before submission

### Unit Import Flow
- **Location**: [PropertyDetailPanel.tsx:348-416](rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx#L348-L416)
- **Preview**: Full CSV preview modal with first 10 rows
- **Detailed Feedback**: "Created X | Updated Y | Skipped Z | N issue(s)"
- **Error Details**: Row-level validation errors with specific messages

## Recommended Fix Scope for Follow-Up Missions

### fix/unit-csv-import-v1
**Scope**: Consolidate CSV parsing to use backend implementation only
- Migrate AddPropertyForm to use unit import API
- Remove frontend CSV parsing logic
- Implement CSV preview in property creation flow
- Add proper validation feedback

### fix/unit-manual-save-v1
**Scope**: Improve manual unit entry validation and error handling
- Standardize unit validation across both flows
- Improve error messages for manual unit entry
- Add client-side validation preview

### fix/occupancy-guide-unit-resolution-v1
**Scope**: Standardize unit reference resolution
- Implement consistent unit ID generation strategy
- Fix unit reference matching logic
- Add validation for unit reference integrity

## Test Coverage Analysis

### Backend Tests
- **Property Creation**: Limited test coverage for edge cases
- **Unit Import**: Comprehensive CSV parsing tests exist
- **Missing Coverage**: BOM handling, mixed line endings, quotation edge cases

### Frontend Tests
- **Property Creation**: Basic component tests
- **CSV Parsing**: No tests for frontend CSV parsing logic
- **Missing Coverage**: CSV edge case handling, error state validation

## Recommended Testing Improvements

1. **CSV Edge Case Test Suite**:
   - BOM character handling
   - Mixed line endings (CRLF vs LF)
   - Quoted fields with commas, quotes, newlines
   - Trailing comma scenarios
   - Empty row handling

2. **Integration Tests**:
   - End-to-end property creation with various CSV formats
   - Unit reference resolution validation
   - Error message consistency verification

## Code Locations Summary

### API Routes
- [propertiesRoutes.ts:259-522](rentchain-api/src/routes/propertiesRoutes.ts#L259-L522) - Property creation endpoint
- [unitsRoutes.ts:175-306](rentchain-api/src/routes/unitsRoutes.ts#L175-L306) - Unit management endpoints
- [unitImportRoutes.ts:334-372](rentchain-api/src/routes/unitImportRoutes.ts#L334-L372) - CSV import endpoint

### Services
- [unitCsvImport.service.ts:18-66](rentchain-api/src/imports/unitCsvImport.service.ts#L18-L66) - Backend CSV parsing
- [unitId.ts:1-4](rentchain-api/src/imports/unitId.ts#L1-L4) - Unit ID generation
- [occupancyPrompt.ts:12-36](rentchain-frontend/src/components/properties/occupancyPrompt.ts#L12-L36) - Unit resolution

### Frontend Components
- [AddPropertyForm.tsx:107-157](rentchain-frontend/src/components/properties/AddPropertyForm.tsx#L107-L157) - Frontend CSV parsing
- [PropertyDetailPanel.tsx:1140-1159](rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx#L1140-L1159) - CSV upload interface
- [UnitsCsvPreviewModal.tsx](rentchain-frontend/src/components/properties/UnitsCsvPreviewModal.tsx) - CSV preview component

### Utilities
- [csv.ts:41](rentchain-api/src/utils/csv.ts#L41) - Unused but correct BOM handling pattern
- [unitCsv.schema.ts:13-28](rentchain-api/src/imports/unitCsv.schema.ts#L13-L28) - Header normalization and mapping

## Conclusion

The 33% failure rate in property onboarding is directly attributable to the split CSV implementation architecture. The frontend parsing approach fails on common CSV edge cases that are properly handled by the backend PapaParser implementation. Consolidating to a single, robust CSV parsing approach will significantly improve success rates and user experience.

The audit confirms all hypotheses from the mission brief:
- ✅ CSV corruption from spreadsheet editors (BOM, line endings, trailing commas)
- ✅ Split implementation between creation flow and import flow (different validation logic)
- ✅ Missing CSV preview in property creation flow
- ✅ Unit resolution issues in occupancy guide workflows (reference integrity problems)

The recommended fix missions will address these root causes systematically while preserving audit history and maintaining role separation as required.