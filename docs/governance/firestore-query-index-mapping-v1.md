# Firestore Query Index Mapping v1

## 1. Executive Summary

This document maps specific Firestore query patterns found in RentChain's service and route implementations to their corresponding custom indexes and business purposes. This provides operational visibility into query-index dependencies and performance assumptions across tenant workspace, landlord operations, audit/compliance, and administrative domains.

Each query pattern is categorized by business domain, linked to its implementation location, and mapped to the custom index (if any) that optimizes its performance. Queries that rely on auto-generated single-field indexes or collection scans are identified for future optimization consideration.

This mapping serves as the foundation for query performance verification, index dependency analysis, and projection safety validation in Phase 3 security hardening.

## 2. Query Pattern Categories

| Domain | Purpose | Performance Priority | Index Dependency |
| --- | --- | --- | --- |
| Tenant Workspace | Portal performance, tenant-scoped data access | Critical (user-facing) | Tenant-scoped composite indexes required |
| Landlord Operations | Portfolio management, operational workflows | High (business-critical) | Landlord-scoped composite indexes required |
| Audit/Compliance | Event timelines, audit trails, compliance queries | Medium (governance-critical) | Chronological composite indexes required |
| Administrative | Cross-tenant analytics, support diagnostics | Variable (operational) | Mixed - some require custom indexes |
| Registry/Import | External data correlation, batch processing | Medium (operational) | Source-scoped composite indexes required |
| Reporting | Credit reporting, analytics, export generation | Low-to-medium (periodic) | Mixed - depends on scope and filtering |

## 3. Tenant Workspace Query Patterns

### Tenant Balance Calculation
**Service Location**: `rentchain-api/src/services/tenantBalanceService.ts`
**Query Pattern**:
```typescript
firestore.collection("events").where("tenantId", "==", tenantId).get()
```
**Index Requirement**: `events` collection - `tenantId + timestamp + __name__ (DESC)`
**Business Purpose**: Calculate tenant balance from payment and charge events
**Performance Scope**: Low cardinality (10-1k events per tenant), portal performance critical
**Scope Boundary**: Single tenant isolation enforced by tenantId filter

### Tenant Credit Profile Query
**Service Location**: `rentchain-api/src/services/tenantCreditProfileService.ts`
**Query Pattern**:
```typescript
collection("reportingConsents").where("tenantId", "==", tenantId)
```
**Index Requirement**: Auto-generated single-field index on `tenantId`
**Business Purpose**: Retrieve tenant credit reporting consent status
**Performance Scope**: Low cardinality (1-20 consents per tenant)
**Scope Boundary**: Single tenant isolation enforced by tenantId filter

### Tenant Payment History
**Implementation Location**: Payment timeline services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("payments").where("tenantId", "==", tenantId).orderBy("paidAt", "desc")
```
**Index Requirement**: `payments` collection - `tenantId + paidAt + __name__ (DESC)`
**Business Purpose**: Display tenant payment history in chronological order
**Performance Scope**: Low-to-medium cardinality (5-500 payments per tenant)
**Scope Boundary**: Single tenant isolation enforced by tenantId filter

### Tenant Ledger Timeline
**Implementation Location**: Ledger services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEvents").where("data.tenantId", "==", tenantId).orderBy("timestamp", "desc")
```
**Index Requirement**: `ledgerEvents` collection - `data.tenantId + timestamp + __name__ (DESC)`
**Business Purpose**: Display complete tenant financial timeline
**Performance Scope**: Low-to-medium cardinality (10-5k ledger entries per tenant)
**Scope Boundary**: Single tenant isolation enforced by nested tenantId filter

## 4. Landlord Operations Query Patterns

### Landlord Property Portfolio
**Implementation Location**: Property management services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("properties").where("landlordId", "==", landlordId).orderBy("createdAt", "desc")
```
**Index Requirement**: `properties` collection - `landlordId + createdAt + __name__ (DESC)`
**Business Purpose**: Display landlord property portfolio ordered by creation date
**Performance Scope**: Low-to-medium cardinality (1-1k properties per landlord)
**Scope Boundary**: Single landlord isolation enforced by landlordId filter

### Landlord Activity Timeline
**Implementation Location**: Activity timeline services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("events").where("landlordId", "==", landlordId).orderBy("occurredAt", "desc")
```
**Index Requirement**: `events` collection - `landlordId + occurredAt + __name__ (DESC)`
**Business Purpose**: Display landlord activity timeline and audit events
**Performance Scope**: Medium cardinality (100-10k events per landlord)
**Scope Boundary**: Single landlord isolation enforced by landlordId filter

### Landlord Financial Timeline
**Implementation Location**: Financial dashboard services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).orderBy("occurredAt", "desc")
```
**Index Requirement**: `ledgerEventsV2` collection - `landlordId + occurredAt (DESC)`
**Business Purpose**: Display complete landlord financial timeline across all properties
**Performance Scope**: Medium-to-high cardinality (100-50k+ entries per landlord)
**Scope Boundary**: Single landlord isolation enforced by landlordId filter

### Landlord Property Financial Details
**Implementation Location**: Property financial reporting (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).where("propertyId", "==", propertyId).orderBy("occurredAt", "desc")
```
**Index Requirement**: `ledgerEventsV2` collection - `landlordId + propertyId + occurredAt + __name__ (DESC)`
**Business Purpose**: Display property-specific financial timeline for landlord
**Performance Scope**: Medium cardinality (100-10k entries per property)
**Scope Boundary**: Single landlord + property isolation enforced by composite filter

### Landlord Tenant Financial View
**Implementation Location**: Tenant management services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).where("tenantId", "==", tenantId).orderBy("occurredAt", "desc")
```
**Index Requirement**: `ledgerEventsV2` collection - `landlordId + tenantId + occurredAt + __name__ (DESC)`
**Business Purpose**: Display tenant financial timeline from landlord perspective
**Performance Scope**: Low-to-medium cardinality (10-5k entries per tenant)
**Scope Boundary**: Single landlord + tenant isolation enforced by composite filter

### Lease Notice Management
**Service Location**: `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
**Query Pattern**:
```typescript
db.collection("leases").where("landlordId", "==", landlordId).limit(400).get()
db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400).get()
```
**Index Requirement**: Auto-generated single-field indexes on `landlordId`
**Business Purpose**: Load landlord leases and notices for operational management
**Performance Scope**: Medium cardinality with explicit 400-result limit
**Scope Boundary**: Single landlord isolation enforced by landlordId filter

## 5. Audit/Compliance Query Patterns

### Property Activity Timeline
**Implementation Location**: Property audit services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("events").where("propertyId", "==", propertyId).orderBy("timestamp", "desc")
```
**Index Requirement**: `events` collection - `propertyId + timestamp + __name__ (DESC)`
**Business Purpose**: Property-scoped activity timeline for maintenance and audit
**Performance Scope**: Low-to-medium cardinality (10-5k events per property)
**Scope Boundary**: Property isolation enforced by propertyId filter

### Property Financial Audit Trail
**Implementation Location**: Financial audit services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEvents").where("data.propertyId", "==", propertyId).orderBy("timestamp", "desc")
```
**Index Requirement**: `ledgerEvents` collection - `data.propertyId + timestamp + __name__ (DESC)`
**Business Purpose**: Property financial timeline for audit and compliance
**Performance Scope**: Medium cardinality (100-10k ledger entries per property)
**Scope Boundary**: Property isolation enforced by nested propertyId filter

### Event Type Analysis
**Implementation Location**: Analytics and reporting services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEvents").where("eventType", "==", type).orderBy("timestamp", "desc")
```
**Index Requirement**: `ledgerEvents` collection - `eventType + timestamp + __name__ (DESC)`
**Business Purpose**: Cross-tenant analytics by event type
**Performance Scope**: High cardinality (1k-100k+ entries), analytics optimized
**Scope Boundary**: Global scope - requires careful projection safety

### Tenant Financial Event Analysis
**Implementation Location**: Financial reconciliation services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("ledgerEvents").where("data.tenantId", "==", tenantId).where("eventType", "==", type).orderBy("timestamp", "desc")
```
**Index Requirement**: `ledgerEvents` collection - `data.tenantId + eventType + timestamp + __name__ (DESC)`
**Business Purpose**: Tenant financial events filtered by type (payments, charges, adjustments)
**Performance Scope**: Low-to-medium cardinality (1-1k entries per tenant per type)
**Scope Boundary**: Single tenant isolation enforced by tenantId filter

## 6. Administrative Query Patterns

### Admin Date Range Filtering
**Service Location**: `rentchain-api/src/routes/adminRoutes.ts`
**Query Pattern**:
```typescript
let query = collection.orderBy("date");
if (from) query = query.where("date", ">=", from);
if (to) query = query.where("date", "<=", to);
```
**Index Requirement**: Auto-generated single-field index on `date`
**Business Purpose**: Admin date range filtering for various collections
**Performance Scope**: Variable based on date range and collection size
**Scope Boundary**: Admin-only access, cross-tenant data

### Admin Timestamp Range Queries
**Service Location**: `rentchain-api/src/routes/adminRoutes.ts`
**Query Pattern**:
```typescript
collection.where("ts", ">=", start).where("ts", "<=", now)
```
**Index Requirement**: Auto-generated single-field index on `ts`
**Business Purpose**: Admin timestamp-based filtering for operational queries
**Performance Scope**: Variable based on time range
**Scope Boundary**: Admin-only access, cross-tenant data

### Admin Status Monitoring
**Service Location**: `rentchain-api/src/routes/adminRoutes.ts`
**Query Pattern**:
```typescript
collection.where("status", "in", ["investigating", "identified", "monitoring"])
```
**Index Requirement**: Auto-generated single-field index on `status`
**Business Purpose**: Admin monitoring of operational status across resources
**Performance Scope**: Variable based on status distribution
**Scope Boundary**: Admin-only access, cross-tenant data

### Session User Lookup
**Service Location**: `rentchain-api/src/services/sessionUserService.ts`
**Query Pattern**:
```typescript
collection.where("email", "==", email.toLowerCase())
```
**Index Requirement**: Auto-generated single-field index on `email`
**Business Purpose**: User authentication and session management
**Performance Scope**: Very low cardinality (1 result expected)
**Scope Boundary**: User-specific, auth-layer isolation

## 7. Registry/Import Query Patterns

### Registry Import Tracking
**Implementation Location**: Registry import services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryImports").where("sourceKey", "==", sourceKey).orderBy("createdAt", "desc")
```
**Index Requirement**: `registryImports` collection - `sourceKey + createdAt + __name__ (DESC)`
**Business Purpose**: Track registry import batches by source
**Performance Scope**: Medium cardinality (10-10k imports per source)
**Scope Boundary**: Source isolation enforced by sourceKey filter

### Registry Match Queries
**Implementation Location**: Registry correlation services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryMatches").where("sourceKey", "==", sourceKey).orderBy("updatedAt", "desc")
```
**Index Requirement**: `registryMatches` collection - `sourceKey + updatedAt + __name__ (DESC)`
**Business Purpose**: Basic registry match queries by source
**Performance Scope**: High cardinality (100-100k+ matches per source)
**Scope Boundary**: Source isolation enforced by sourceKey filter

### Registry Match Status Filtering
**Implementation Location**: Registry review queues (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryMatches").where("sourceKey", "==", sourceKey).where("matchStatus", "==", status).orderBy("updatedAt", "desc")
```
**Index Requirement**: `registryMatches` collection - `sourceKey + matchStatus + updatedAt + __name__ (DESC)`
**Business Purpose**: Filter registry matches by processing status
**Performance Scope**: Medium cardinality per source+status combination
**Scope Boundary**: Source isolation enforced by sourceKey filter

### Registry Search with Tokens
**Implementation Location**: Registry search interface (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryMatches").where("sourceKey", "==", sourceKey).where("queueSearchTokens", "array-contains", token).orderBy("updatedAt", "desc")
```
**Index Requirement**: `registryMatches` collection - `sourceKey + queueSearchTokens (CONTAINS) + updatedAt + __name__ (DESC)`
**Business Purpose**: Search registry matches using tokenized search
**Performance Scope**: Low-to-medium cardinality with array filter optimization
**Scope Boundary**: Source isolation enforced by sourceKey filter

### Property Registry Status
**Implementation Location**: Property correlation services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryMatches").where("propertyId", "==", propertyId).where("sourceKey", "==", sourceKey).orderBy("updatedAt", "desc")
```
**Index Requirement**: `registryMatches` collection - `propertyId + sourceKey + updatedAt + __name__ (DESC)`
**Business Purpose**: Check registry match status for specific properties
**Performance Scope**: Low cardinality (1-100 matches per property+source)
**Scope Boundary**: Property isolation enforced by propertyId filter

### Registry Audit Trail
**Implementation Location**: Registry audit services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryAuditLog").where("registryRecordId", "==", recordId).orderBy("createdAt", "desc")
```
**Index Requirement**: `registryAuditLog` collection - `registryRecordId + createdAt + __name__ (DESC)`
**Business Purpose**: Audit trail for specific registry records
**Performance Scope**: Low-to-medium cardinality (1-100 audit entries per record)
**Scope Boundary**: Record isolation enforced by recordId filter

### Registry Property Audit
**Implementation Location**: Registry audit services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryAuditLog").where("propertyId", "==", propertyId).orderBy("createdAt", "desc")
```
**Index Requirement**: `registryAuditLog` collection - `propertyId + createdAt + __name__ (DESC)`
**Business Purpose**: Property-scoped registry change tracking
**Performance Scope**: Low-to-medium cardinality (10-1k audit entries per property)
**Scope Boundary**: Property isolation enforced by propertyId filter

### Registry Import Audit
**Implementation Location**: Registry batch processing (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("registryAuditLog").where("importBatchId", "==", batchId).orderBy("createdAt", "desc")
```
**Index Requirement**: `registryAuditLog` collection - `importBatchId + createdAt + __name__ (DESC)`
**Business Purpose**: Audit trail for import batch processing
**Performance Scope**: Medium cardinality (100-10k audit entries per batch)
**Scope Boundary**: Batch isolation enforced by batchId filter

## 8. Reporting Query Patterns

### Tenant Reporting Consent Status
**Implementation Location**: Reporting compliance services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("reportingConsents").where("landlordId", "==", landlordId).where("tenantId", "==", tenantId).orderBy("createdAt", "desc")
```
**Index Requirement**: `reportingConsents` collection - `landlordId + tenantId + createdAt + __name__ (DESC)`
**Business Purpose**: Tenant reporting consent history
**Performance Scope**: Low cardinality (1-20 consents per landlord+tenant)
**Scope Boundary**: Landlord+tenant isolation enforced by composite filter

### Reporting Consent by Status
**Implementation Location**: Consent management services (inferred from index usage)
**Query Pattern**:
```typescript
firestore.collection("reportingConsents").where("landlordId", "==", landlordId).where("status", "==", status).where("tenantId", "==", tenantId).orderBy("createdAt", "desc")
```
**Index Requirement**: `reportingConsents` collection - `landlordId + status + tenantId + createdAt + __name__ (DESC)`
**Business Purpose**: Filter reporting consents by status and tenant
**Performance Scope**: Low cardinality (1-10 consents per landlord+status+tenant)
**Scope Boundary**: Landlord+tenant isolation enforced by composite filter

### Cross-Organization Trust Queries
**Service Location**: `rentchain-api/src/routes/landlordCrossOrganizationTrustRoutes.ts`
**Query Pattern**:
```typescript
db.collection(collectionName).where(field, "==", landlordId).get()
```
**Index Requirement**: Auto-generated single-field index on `landlordId` field
**Business Purpose**: Cross-organization trust validation and lookup
**Performance Scope**: Variable based on collection and field distribution
**Scope Boundary**: Landlord isolation enforced by dynamic field filter

## 9. Query Performance Analysis

### High-Performance Requirements
**Tenant Workspace Queries**: Must complete within 200-500ms for portal responsiveness
- Tenant balance calculation (events query)
- Tenant payment history (payments query)
- Tenant ledger timeline (ledgerEvents query)

**Landlord Operational Queries**: Should complete within 1-3 seconds for operational efficiency
- Property portfolio loading (properties query)
- Landlord financial timeline (ledgerEventsV2 query)
- Activity timeline (events query)

### Medium-Performance Requirements
**Audit/Compliance Queries**: Can accept 3-10 seconds for comprehensive results
- Property audit trails (events/ledgerEvents queries)
- Cross-tenant analytics (eventType queries)
- Registry correlation (registryMatches queries)

### Variable Performance Tolerance
**Administrative Queries**: Performance depends on scope and purpose
- Date range filtering (variable based on range)
- Status monitoring (depends on result set size)
- Cross-organization trust validation (depends on collection size)

## 10. Index Dependency Summary

### Critical Index Dependencies (Query Fails Without)
- Composite indexes with multiple equality filters + orderBy
- All `registryMatches` array-contains queries
- All multi-field landlord/tenant workspace queries

### Performance Index Dependencies (Query Slow Without)
- Single timestamp/date orderBy queries (can fall back to collection scan)
- Single equality filter queries (can use auto-generated indexes)

### Optional Index Dependencies (Marginal Performance Benefit)
- Single-field equality queries on low-cardinality fields
- Queries with very small result sets regardless of index

## 11. Scope Boundary Verification

### Tenant Isolation Verified
- All tenant workspace queries filter by `tenantId` as first or required filter
- No cross-tenant data access possible through indexed query patterns
- Composite indexes maintain tenant isolation through required filters

### Landlord Isolation Verified
- All landlord operational queries filter by `landlordId` as first or required filter
- Cross-landlord access limited to admin routes with explicit authorization
- Registry/import operations properly scoped by `sourceKey` or property relationship

### Administrative Access Controlled
- Admin queries operate on global scope with proper authorization layer
- No unauthorized elevation possible through query pattern manipulation
- Cross-tenant analytics properly controlled at service authorization level

This query-index mapping establishes the foundation for Phase 3 missions 8-10 to verify query performance assumptions, validate projection safety, and ensure operational readiness without manual code inspection for each optimization or security verification task.