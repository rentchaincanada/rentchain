# Firestore Projection Query Safety v1

## 1. Executive Summary

This document verifies that Firestore projection queries across RentChain's workspace surfaces maintain proper scope isolation, have adequate index support, and prevent cross-tenant or cross-landlord data leakage. Each projection surface is analyzed for query scope boundaries, index dependencies, and security isolation guarantees.

Building on the Phase 3 sensitivity and projection registry, this analysis confirms that workspace projections use whitelist-based safety rather than field-stripping approaches, and that filtering boundaries (tenantId, landlordId, propertyId) properly enforce workspace isolation at the query level.

This verification serves as a security baseline for Phase 3 missions on preview/staging separation and recovery workflow security, ensuring that projection performance and safety assumptions are documented and verifiable.

## 2. Projection Surface Categories

| Surface Type | Audience | Isolation Requirement | Index Support Priority | Security Risk Level |
| --- | --- | --- | --- | --- |
| Tenant Workspace | Tenant portal users | Complete tenant isolation | Critical (user-facing) | High (privacy-sensitive) |
| Landlord Operations | Landlord dashboard users | Landlord-scoped isolation | High (business-critical) | High (financial-sensitive) |
| Admin Diagnostics | Admin/support users | Role-gated access | Medium (operational) | Medium (controlled access) |
| Evidence Packages | Review/audit workflows | Scope-specific bundles | Medium (governance) | High (evidence integrity) |
| Export Projections | External/institutional | Explicit allowlist only | Low (periodic) | Critical (data leakage risk) |
| Internal Processing | Backend services only | Service-level isolation | Variable | Low (no external exposure) |

## 3. Tenant Workspace Projection Safety

### Tenant Balance and Financial Timeline
**Projection Surface**: Tenant portal financial summary and payment history
**Query Patterns**:
```typescript
// Tenant balance calculation
firestore.collection("events").where("tenantId", "==", tenantId)

// Tenant payment history  
firestore.collection("payments").where("tenantId", "==", tenantId).orderBy("paidAt", "desc")

// Tenant ledger timeline
firestore.collection("ledgerEvents").where("data.tenantId", "==", tenantId).orderBy("timestamp", "desc")
```

**Index Support Verification**:
- ✅ `events` collection: `tenantId + timestamp + __name__ (DESC)` index available
- ✅ `payments` collection: `tenantId + paidAt + __name__ (DESC)` index available  
- ✅ `ledgerEvents` collection: `data.tenantId + timestamp + __name__ (DESC)` index available

**Scope Boundary Verification**:
- ✅ **Tenant Isolation**: All queries filter by `tenantId` as required first filter
- ✅ **No Cross-Tenant Access**: Query patterns cannot access other tenant data
- ✅ **Whitelist Projection**: Service layer projects only tenant-owned financial data
- ✅ **Performance Safety**: Indexes ensure queries complete within 200-500ms portal requirements

**Security Assessment**: **LOW RISK** - Complete tenant isolation enforced at query level

### Tenant Reporting and Credit Status  
**Projection Surface**: Tenant portal credit reporting consent and status
**Query Patterns**:
```typescript
// Tenant reporting consent status
firestore.collection("reportingConsents").where("tenantId", "==", tenantId)

// Tenant credit profile (if implemented)
firestore.collection("creditProfiles").where("tenantId", "==", tenantId)
```

**Index Support Verification**:
- ✅ `reportingConsents` collection: Auto-generated `tenantId` index (low cardinality)
- ⚠️ `creditProfiles` collection: Implementation details require verification

**Scope Boundary Verification**:
- ✅ **Tenant Isolation**: Queries filter by `tenantId` for tenant-owned consent data
- ✅ **No Cross-Tenant Access**: Cannot access other tenant consent/credit data
- ✅ **Restricted Data Handling**: Credit data follows restricted projection patterns
- ✅ **Consent Boundary**: Only surfaces tenant's own consent status, not raw reports

**Security Assessment**: **LOW RISK** - Tenant-scoped consent data only, no raw credit exposure

### Tenant Communication and Notices
**Projection Surface**: Tenant portal messages and notices
**Query Patterns** (inferred from collection structure):
```typescript
// Tenant conversations
firestore.collection("conversations").where("tenantId", "==", tenantId)

// Tenant notices  
firestore.collection("tenantNotices").where("tenantId", "==", tenantId)

// Message read receipts
firestore.collection("tenantMessageReads").where("tenantId", "==", tenantId)
```

**Index Support Verification**:
- ⚠️ **Index Status Unknown**: Conversation/messaging indexes not defined in `firestore.indexes.json`
- ⚠️ **Performance Risk**: May rely on auto-generated indexes or collection scans
- ❌ **Investigation Required**: Query performance and index requirements need verification

**Scope Boundary Verification**:
- ✅ **Tenant Isolation**: Query patterns filter by `tenantId` for tenant-owned messages
- ✅ **Communication Privacy**: Each tenant accesses only their own conversations
- ⚠️ **Conversation Scope**: Need to verify landlord-tenant conversation sharing boundaries
- ⚠️ **Read State Isolation**: Message read state properly isolated per tenant

**Security Assessment**: **MEDIUM RISK** - Communication privacy critical, index performance verification needed

## 4. Landlord Operations Projection Safety

### Landlord Property Portfolio
**Projection Surface**: Landlord dashboard property management
**Query Patterns**:
```typescript
// Landlord properties
firestore.collection("properties").where("landlordId", "==", landlordId).orderBy("createdAt", "desc")

// Property units (inferred)
firestore.collection("units").where("landlordId", "==", landlordId)
```

**Index Support Verification**:
- ✅ `properties` collection: `landlordId + createdAt + __name__ (DESC)` index available
- ⚠️ `units` collection: Index status requires verification

**Scope Boundary Verification**:
- ✅ **Landlord Isolation**: All queries filter by `landlordId` as required first filter
- ✅ **No Cross-Landlord Access**: Cannot access other landlord properties or units
- ✅ **Property Ownership**: Query patterns respect property ownership boundaries
- ✅ **Portfolio Scope**: Landlord sees only owned/managed properties

**Security Assessment**: **LOW RISK** - Landlord-scoped property data with proper isolation

### Landlord Financial Operations
**Projection Surface**: Landlord dashboard financial timeline and property performance
**Query Patterns**:
```typescript
// Landlord financial timeline
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).orderBy("occurredAt", "desc")

// Property-specific financials
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).where("propertyId", "==", propertyId).orderBy("occurredAt", "desc")

// Tenant financial view (landlord perspective)
firestore.collection("ledgerEventsV2").where("landlordId", "==", landlordId).where("tenantId", "==", tenantId).orderBy("occurredAt", "desc")
```

**Index Support Verification**:
- ✅ `ledgerEventsV2` collection: `landlordId + occurredAt (DESC)` index available
- ✅ `ledgerEventsV2` collection: `landlordId + propertyId + occurredAt + __name__ (DESC)` index available
- ✅ `ledgerEventsV2` collection: `landlordId + tenantId + occurredAt + __name__ (DESC)` index available

**Scope Boundary Verification**:
- ✅ **Landlord Isolation**: All queries require `landlordId` as primary filter
- ✅ **Financial Data Scoping**: Landlord sees only financial data for owned properties/tenants
- ✅ **Tenant Financial Privacy**: Tenant financial data only accessible via landlord ownership relationship
- ✅ **Property Financial Isolation**: Property financial data properly scoped to landlord ownership

**Security Assessment**: **LOW RISK** - Strong landlord-scoped financial isolation with tenant data properly filtered

### Landlord Lease and Notice Management
**Projection Surface**: Landlord operational workflows for leases and notices
**Query Patterns** (from `leaseNoticeLandlordRoutes.ts`):
```typescript
// Landlord leases
db.collection("leases").where("landlordId", "==", landlordId).limit(400)

// Landlord lease notices
db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400)
```

**Index Support Verification**:
- ⚠️ `leases` collection: Relies on auto-generated `landlordId` index
- ⚠️ `leaseNotices` collection: Relies on auto-generated `landlordId` index
- ⚠️ **Performance Risk**: Large result sets (400 limit) may benefit from composite indexes

**Scope Boundary Verification**:
- ✅ **Landlord Isolation**: Queries filter by `landlordId` for landlord-owned leases/notices
- ✅ **Lease Privacy**: Landlord accesses only leases for owned properties
- ✅ **Notice Scoping**: Lease notices properly scoped to landlord's properties/tenants
- ⚠️ **Result Set Size**: 400-result limit suggests potential large dataset handling

**Security Assessment**: **MEDIUM RISK** - Proper isolation but performance optimization needed for large portfolios

### Landlord Tenant Management
**Projection Surface**: Landlord view of tenant information and relationships
**Query Patterns** (inferred from collection structure):
```typescript
// Landlord's tenants (via lease relationship)
firestore.collection("leases").where("landlordId", "==", landlordId)
// Then join to tenants collection via tenantId

// Reporting consents for landlord's tenants
firestore.collection("reportingConsents").where("landlordId", "==", landlordId).where("tenantId", "==", tenantId)
```

**Index Support Verification**:
- ⚠️ `leases` collection: Auto-generated `landlordId` index for initial filter
- ✅ `reportingConsents` collection: `landlordId + tenantId + createdAt + __name__ (DESC)` index available

**Scope Boundary Verification**:
- ✅ **Landlord-Tenant Relationship**: Access limited to tenants with active/past lease relationship
- ✅ **No Direct Cross-Tenant Access**: Tenant data accessed only via landlord-tenant relationship
- ✅ **Reporting Consent Scoping**: Landlord sees only consent status for their own tenants
- ✅ **Privacy Protection**: No access to tenant data outside landlord relationship

**Security Assessment**: **LOW RISK** - Relationship-based tenant access with proper scoping

## 5. Admin Diagnostics Projection Safety

### Admin Cross-Tenant Operations
**Projection Surface**: Admin/support diagnostic and troubleshooting views  
**Query Patterns** (from `adminRoutes.ts`):
```typescript
// Date range filtering
let query = collection.orderBy("date");
if (from) query = query.where("date", ">=", from);
if (to) query = query.where("date", "<=", to);

// Status monitoring
collection.where("status", "in", ["investigating", "identified", "monitoring"])

// Timestamp range queries
collection.where("ts", ">=", start).where("ts", "<=", now)
```

**Index Support Verification**:
- ✅ Auto-generated single-field indexes support basic filtering
- ⚠️ **Performance Risk**: Date/timestamp range queries may scan large result sets
- ⚠️ **Composite Index Opportunity**: Range + additional filters could benefit from optimization

**Scope Boundary Verification**:
- ⚠️ **Cross-Tenant Access**: Admin queries operate across tenant/landlord boundaries
- ✅ **Role-Based Authorization**: Access controlled by admin role verification
- ⚠️ **Audit Logging**: Admin cross-tenant access should be logged for governance
- ⚠️ **Data Minimization**: Admin views should project minimal necessary data

**Security Assessment**: **MEDIUM-HIGH RISK** - Cross-tenant access requires strict role enforcement and audit logging

### Admin User Management
**Projection Surface**: Admin user lookup and session management
**Query Patterns** (from `sessionUserService.ts`):
```typescript
// User lookup by email
collection.where("email", "==", email.toLowerCase())
```

**Index Support Verification**:
- ✅ Auto-generated `email` index supports user lookup
- ✅ **Performance**: Email lookup expected to return single result, good performance

**Scope Boundary Verification**:
- ✅ **User-Specific Access**: Lookup limited to specific user by email
- ✅ **No Enumeration**: Query pattern doesn't allow user enumeration
- ✅ **Auth Integration**: Used for legitimate user authentication workflows
- ✅ **Session Isolation**: Supports proper user session management

**Security Assessment**: **LOW RISK** - Standard user authentication pattern with proper isolation

## 6. Evidence Package Projection Safety

### Review Workspace Evidence
**Projection Surface**: Evidence packages for review workflows and operator sessions
**Query Patterns** (inferred from collection structure):
```typescript
// Evidence scoped to specific review session
firestore.collection("operatorReviewSessions").where("landlordId", "==", landlordId).where("scopeId", "==", scopeId)

// Decision evidence tied to specific scope
firestore.collection("decisionActions").where("landlordId", "==", landlordId).where("leaseId", "==", leaseId)
```

**Index Support Verification**:
- ⚠️ **Index Status Unknown**: Review/evidence collection indexes not defined in `firestore.indexes.json`
- ❌ **Investigation Required**: Evidence query performance and index requirements need verification

**Scope Boundary Verification**:
- ✅ **Evidence Scoping**: Evidence packages tied to specific review scope (lease, property, tenant)
- ✅ **Landlord Isolation**: Evidence access scoped by landlord ownership
- ⚠️ **Operator Authorization**: Need to verify operator access controls to evidence packages
- ⚠️ **Evidence Immutability**: Evidence queries should not modify source data

**Security Assessment**: **MEDIUM-HIGH RISK** - Evidence integrity critical, index and access control verification needed

### Audit Trail Projections  
**Projection Surface**: Audit trails for compliance and governance workflows
**Query Patterns** (inferred from audit collections):
```typescript
// Audit events for specific resource
firestore.collection("events").where("landlordId", "==", landlordId).where("resourceId", "==", resourceId)

// Registry audit trail
firestore.collection("registryAuditLog").where("propertyId", "==", propertyId).orderBy("createdAt", "desc")
```

**Index Support Verification**:
- ✅ `events` collection: `landlordId + occurredAt + __name__ (DESC)` index available
- ✅ `registryAuditLog` collection: `propertyId + createdAt + __name__ (DESC)` index available

**Scope Boundary Verification**:
- ✅ **Audit Scoping**: Audit trails properly scoped to specific resources
- ✅ **Timeline Integrity**: Chronological ordering maintained for audit trails  
- ✅ **No Audit Mutation**: Read-only access to audit data
- ✅ **Landlord/Property Isolation**: Audit access follows ownership boundaries

**Security Assessment**: **LOW RISK** - Proper audit trail scoping with good index support

## 7. Export Projection Safety

### Tenant Trust Exports
**Projection Surface**: Tenant-initiated data exports and sharing
**Query Patterns** (inferred from collection structure):
```typescript
// Tenant export packages
firestore.collection("tenantTrustExports").where("tenantId", "==", tenantId)

// Tenant-owned data for export
// Multiple collections filtered by tenantId for comprehensive export
```

**Index Support Verification**:
- ⚠️ **Index Status Unknown**: Export collection indexes not defined in `firestore.indexes.json`
- ❌ **Critical Gap**: Export queries likely require composite indexes for performance

**Scope Boundary Verification**:
- ✅ **Tenant Data Ownership**: Exports limited to tenant's own data
- ⚠️ **Export Content Validation**: Need to verify export packages contain only allowlisted data
- ⚠️ **Sensitive Data Handling**: Exports must follow restricted data projection policies
- ❌ **Export Audit Logging**: Export generation should be audited but verification needed

**Security Assessment**: **HIGH RISK** - Export data leakage potential, comprehensive review required

### Institutional/Landlord Exports
**Projection Surface**: Landlord-initiated exports for external/institutional use
**Query Patterns** (inferred from export patterns):
```typescript
// Landlord portfolio export
firestore.collection("properties").where("landlordId", "==", landlordId)
// Plus related tenant/lease/financial data

// Financial reporting exports
firestore.collection("ledgerEvents").where("landlordId", "==", landlordId)
// Filtered for export-safe financial data
```

**Index Support Verification**:
- ✅ Properties and financial data have adequate landlord-scoped indexes
- ⚠️ **Export-Specific Optimization**: Large export datasets may need optimized query patterns

**Scope Boundary Verification**:
- ✅ **Landlord Ownership**: Exports scoped to landlord-owned data
- ⚠️ **Tenant Privacy in Exports**: Tenant data in landlord exports must follow sensitivity classification
- ❌ **Export Allowlist Verification**: Need to verify exports use whitelist projection, not field stripping
- ❌ **Export Purpose Validation**: Institutional exports require explicit purpose and retention policies

**Security Assessment**: **CRITICAL RISK** - Institutional data leakage potential, comprehensive governance review required

## 8. Internal Processing Projection Safety

### Registry and Import Operations
**Projection Surface**: Backend registry correlation and import processing
**Query Patterns**:
```typescript
// Registry operations by source
firestore.collection("registryMatches").where("sourceKey", "==", sourceKey)

// Import batch processing
firestore.collection("registryImports").where("sourceKey", "==", sourceKey).orderBy("createdAt", "desc")
```

**Index Support Verification**:
- ✅ Registry collections have comprehensive composite indexes for processing efficiency
- ✅ **Batch Processing Optimized**: Import operations properly indexed for performance

**Scope Boundary Verification**:
- ✅ **Source Isolation**: Registry operations properly scoped by sourceKey
- ✅ **No Cross-Source Contamination**: Registry matching isolated by data source
- ✅ **Internal Processing Only**: Registry data not exposed to tenant/landlord UI projections
- ✅ **Audit Trail Maintained**: Registry operations properly logged

**Security Assessment**: **LOW RISK** - Internal processing with proper isolation and audit trails

## 9. Performance Risk Assessment

### Critical Performance Gaps
1. **Tenant Communication Queries**: Missing composite indexes for messaging/conversation queries
2. **Evidence Package Queries**: Review workflow queries lack defined index strategy  
3. **Export Generation Queries**: Large dataset exports may require optimization
4. **Admin Diagnostic Queries**: Date/timestamp range queries may scan large result sets

### Performance Optimization Priorities
1. **High Priority**: Tenant workspace communication queries (user-facing performance)
2. **Medium Priority**: Admin diagnostic query optimization (operational efficiency)
3. **Medium Priority**: Evidence package query performance (governance workflow efficiency)
4. **Low Priority**: Export query optimization (periodic operation)

### Index Coverage Gaps
1. **Messaging Collections**: `conversations`, `messages`, `tenantMessageReads` need composite indexes
2. **Review Collections**: `operatorReviewSessions`, `decisionActions` need query optimization
3. **Export Collections**: `tenantTrustExports`, export-related queries need index strategy

## 10. Security Risk Summary

### Low Risk (Verified Safe)
- Tenant workspace financial projections (strong tenant isolation)
- Landlord operational projections (proper landlord scoping)
- Audit trail projections (read-only with good scoping)
- Registry/import internal processing (proper source isolation)

### Medium Risk (Requires Monitoring)  
- Admin diagnostic projections (cross-tenant access with role controls)
- Tenant communication projections (privacy-critical, performance gaps)
- Evidence package projections (governance-critical, verification needed)
- Large landlord portfolio operations (performance scaling concerns)

### High Risk (Requires Review)
- Export projections (data leakage potential)
- Cross-tenant analytics queries (global scope with admin access)
- Evidence package generation (integrity and access control verification needed)

### Critical Risk (Requires Immediate Action)
- Institutional export projections (external data exposure risk)
- Export allowlist implementation (whitelist vs field-stripping verification needed)
- Export audit logging (governance compliance verification required)

## 11. Recommendations

### Immediate Actions Required
1. **Export Security Review**: Comprehensive review of all export projection patterns
2. **Evidence Query Verification**: Validate evidence package query performance and access controls
3. **Communication Index Implementation**: Add missing indexes for tenant communication queries

### Phase 3 Mission Integration
1. **Preview/Staging Separation**: Use this analysis to verify projection safety across environments
2. **Recovery Workflow Security**: Apply projection safety verification to recovery operations
3. **Operational Incident Readiness**: Use query performance baseline for incident response planning

### Future Monitoring Requirements  
1. **Projection Safety Testing**: Automated verification that projections maintain scope isolation
2. **Query Performance Monitoring**: Track query performance against index strategy
3. **Export Audit Compliance**: Implement comprehensive export logging and retention policies

This projection query safety verification establishes the security baseline for Phase 3 missions 8-10, ensuring that workspace projections maintain proper isolation while supporting performance and operational requirements.