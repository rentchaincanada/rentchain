# Firestore Audit Query Dependencies v1

## 1. Executive Summary

This document identifies audit event queries, compliance query patterns, and their Firestore index requirements across RentChain's audit and governance infrastructure. Building on the Phase 3 audit immutability verification, this analysis documents append-safety assumptions, query dependencies for audit trail completeness, and index requirements for compliance and delinquency workflows.

Each audit query pattern is analyzed for its immutability assumptions, chronological ordering requirements, and performance dependencies. This establishes the foundation for audit trail integrity verification and compliance query optimization in Phase 3 operational hardening.

This dependency analysis ensures that audit queries remain performant, complete, and properly scoped while maintaining append-safe operational history and supporting evidence-based governance workflows.

## 2. Audit Query Categories

| Category | Purpose | Immutability Requirement | Performance Priority | Compliance Impact |
| --- | --- | --- | --- | --- |
| Operational Audit | Day-to-day activity tracking and timeline | Append-only recommended | High (dashboard queries) | Medium (operational evidence) |
| Financial Audit | Payment, charge, and financial event tracking | Append-only required | High (balance calculations) | Critical (financial compliance) |
| Evidence Audit | Review workflow and decision audit trails | Immutable required | Medium (governance workflows) | Critical (evidence integrity) |
| Registry Audit | External data correlation and import tracking | Append-only required | Medium (batch processing) | High (data lineage compliance) |
| Security Audit | Authentication, authorization, and access tracking | Immutable required | Low (security investigation) | Critical (security compliance) |
| Compliance Audit | Reporting, consent, and regulatory requirement tracking | Immutable required | Medium (periodic reporting) | Critical (regulatory compliance) |

## 3. Operational Audit Query Dependencies

### General Activity Timeline Queries
**Collection**: `events`  
**Primary Index**: `landlordId + occurredAt + __name__ (DESC)`
**Query Pattern**:
```typescript
firestore.collection("events")
  .where("landlordId", "==", landlordId)
  .orderBy("occurredAt", "desc")
  .limit(100)
```

**Audit Assumptions**:
- ✅ **Append-Only Expectation**: Events should not be modified after creation
- ✅ **Chronological Ordering**: `occurredAt` timestamp provides audit trail timeline
- ✅ **Landlord Isolation**: Audit events properly scoped to landlord ownership
- ⚠️ **Immutability Verification**: Current implementation allows updates (not strictly immutable)

**Index Dependency Analysis**:
- **Performance**: Index required for dashboard timeline performance (1-3 second target)
- **Completeness**: Chronological ordering ensures audit trail completeness
- **Scope Safety**: Landlord filter prevents cross-tenant audit data exposure

**Compliance Impact**: **MEDIUM** - Operational evidence for business workflow audit

### Property Activity Timeline Queries
**Collection**: `events`  
**Primary Index**: `propertyId + timestamp + __name__ (DESC)`
**Query Pattern**:
```typescript
firestore.collection("events")
  .where("propertyId", "==", propertyId)
  .orderBy("timestamp", "desc")
  .limit(200)
```

**Audit Assumptions**:
- ✅ **Property-Scoped Audit**: Events tied to specific property for maintenance/operational audit
- ✅ **Timeline Integrity**: Property activity timeline supports operational audit needs
- ✅ **Evidence Linkage**: Property events can be correlated with maintenance/lease events
- ⚠️ **Cross-Reference Integrity**: Property events should correlate with other audit collections

**Index Dependency Analysis**:
- **Performance**: Index ensures property audit queries complete within operational timeframes
- **Completeness**: Property timeline supports comprehensive operational audit
- **Evidence Integration**: Property events serve as evidence for operational decisions

**Compliance Impact**: **MEDIUM** - Property operational evidence for maintenance and occupancy audit

### Tenant Activity Timeline Queries  
**Collection**: `events`
**Primary Index**: `tenantId + timestamp + __name__ (DESC)`
**Query Pattern**:
```typescript
firestore.collection("events")
  .where("tenantId", "==", tenantId)
  .orderBy("timestamp", "desc")
  .limit(100)
```

**Audit Assumptions**:
- ✅ **Tenant Privacy**: Tenant events accessible only through proper authorization
- ✅ **Activity Tracking**: Tenant activity timeline supports operational and evidence needs
- ✅ **Portal Integration**: Tenant events may be surfaced in tenant workspace safely
- ⚠️ **Sensitive Data Handling**: Tenant events must follow sensitivity classification guidelines

**Index Dependency Analysis**:
- **Performance**: Critical for tenant workspace performance (200-500ms requirement)
- **Privacy**: Index supports tenant-scoped queries without cross-tenant exposure
- **Evidence**: Tenant timeline supports evidence packages and review workflows

**Compliance Impact**: **HIGH** - Tenant activity evidence for privacy and operational compliance

## 4. Financial Audit Query Dependencies

### Ledger Event Timeline Queries
**Collection**: `ledgerEvents`
**Primary Indexes**: 
- `data.tenantId + timestamp + __name__ (DESC)`
- `data.propertyId + timestamp + __name__ (DESC)`
- `eventType + timestamp + __name__ (DESC)`

**Query Patterns**:
```typescript
// Tenant financial audit trail
firestore.collection("ledgerEvents")
  .where("data.tenantId", "==", tenantId)
  .orderBy("timestamp", "desc")

// Property financial audit trail  
firestore.collection("ledgerEvents")
  .where("data.propertyId", "==", propertyId)
  .orderBy("timestamp", "desc")

// Financial event type analysis
firestore.collection("ledgerEvents")
  .where("eventType", "==", "PaymentRecorded")
  .orderBy("timestamp", "desc")
```

**Audit Assumptions**:
- ✅ **Financial Immutability**: Ledger events must be append-only for financial audit integrity
- ✅ **Audit Trail Completeness**: All financial transactions must generate ledger events
- ✅ **Chronological Integrity**: Timestamp ordering critical for financial timeline accuracy
- ✅ **Cross-Reference Capability**: Ledger events must correlate with payment and charge records

**Index Dependency Analysis**:
- **Performance**: Financial queries critical for balance calculations and reporting (1-3 second target)
- **Audit Integrity**: Chronological indexes essential for financial audit trail verification
- **Compliance**: Event type filtering supports financial compliance and reporting requirements

**Compliance Impact**: **CRITICAL** - Financial audit trail required for accounting and regulatory compliance

### Ledger Events V2 Timeline Queries
**Collection**: `ledgerEventsV2`
**Primary Indexes**:
- `landlordId + occurredAt (DESC)`
- `landlordId + propertyId + occurredAt + __name__ (DESC)`
- `landlordId + tenantId + occurredAt + __name__ (DESC)`
- `landlordId + eventType + occurredAt + __name__ (DESC)`

**Query Patterns**:
```typescript
// Landlord financial audit trail
firestore.collection("ledgerEventsV2")
  .where("landlordId", "==", landlordId)
  .orderBy("occurredAt", "desc")

// Property financial audit (landlord perspective)
firestore.collection("ledgerEventsV2")
  .where("landlordId", "==", landlordId)
  .where("propertyId", "==", propertyId)
  .orderBy("occurredAt", "desc")

// Tenant financial audit (landlord perspective)  
firestore.collection("ledgerEventsV2")
  .where("landlordId", "==", landlordId)
  .where("tenantId", "==", tenantId)
  .orderBy("occurredAt", "desc")
```

**Audit Assumptions**:
- ✅ **Enhanced Financial Audit**: V2 events provide improved financial audit capabilities
- ✅ **Landlord-Scoped Audit**: Financial audit properly scoped to landlord ownership
- ✅ **Multi-Dimensional Analysis**: Support for property-specific and tenant-specific financial audit
- ✅ **Backward Compatibility**: V2 events complement but don't replace V1 ledger events

**Index Dependency Analysis**:
- **Performance**: Composite indexes critical for landlord dashboard financial queries
- **Audit Scope**: Landlord-scoped indexes ensure proper audit boundary enforcement
- **Analytics**: Event type filtering enables financial analytics and compliance reporting

**Compliance Impact**: **CRITICAL** - Enhanced financial audit capabilities for compliance and governance

### Payment Audit Trail Queries
**Collection**: `payments`
**Primary Index**: `tenantId + paidAt + __name__ (DESC)`
**Query Pattern**:
```typescript
firestore.collection("payments")
  .where("tenantId", "==", tenantId)
  .orderBy("paidAt", "desc")
```

**Audit Assumptions**:
- ✅ **Payment Record Integrity**: Payment records serve as canonical financial audit evidence
- ✅ **Tenant-Scoped Audit**: Payment audit properly limited to tenant ownership
- ✅ **Correlation with Ledger**: Payments correlate with ledger events for audit completeness
- ✅ **Timeline Accuracy**: Payment timestamps critical for financial chronology

**Index Dependency Analysis**:
- **Performance**: Payment history queries critical for tenant financial summaries
- **Audit Trail**: Payment timeline supports financial audit and balance verification
- **Evidence**: Payment records serve as evidence for financial reconciliation

**Compliance Impact**: **CRITICAL** - Payment records required for financial compliance and audit

## 5. Evidence Audit Query Dependencies

### Canonical Event Audit Queries
**Collection**: `canonicalEvents`
**Query Patterns** (inferred from collection purpose):
```typescript
// Evidence events for specific scope
firestore.collection("canonicalEvents")
  .where("landlordId", "==", landlordId)
  .where("resourceId", "==", resourceId)
  .orderBy("timestamp", "desc")

// Canonical events by event type
firestore.collection("canonicalEvents")
  .where("eventType", "==", eventType)
  .orderBy("timestamp", "desc")
```

**Audit Assumptions**:
- ✅ **Evidence Integrity**: Canonical events must be immutable for evidence packages
- ✅ **Scope Isolation**: Evidence events properly scoped to specific resources/workflows
- ✅ **Analytics Integration**: Canonical events support evidence-based analytics
- ⚠️ **Index Coverage**: Current indexes may not cover all canonical event query patterns

**Index Dependency Analysis**:
- ❌ **Missing Indexes**: No custom indexes defined for `canonicalEvents` collection in current configuration
- ⚠️ **Performance Risk**: Evidence queries may rely on collection scans or auto-generated indexes
- ❌ **Investigation Required**: Canonical event query patterns need index optimization

**Compliance Impact**: **CRITICAL** - Evidence integrity essential for governance and compliance workflows

### Decision Action Audit Queries
**Collection**: `decisionActions`
**Query Patterns** (inferred from collection structure):
```typescript
// Decision audit trail for specific lease
firestore.collection("decisionActions")
  .where("landlordId", "==", landlordId)
  .where("leaseId", "==", leaseId)
  .orderBy("timestamp", "desc")

// Decision audit by decision type
firestore.collection("decisionActions")
  .where("landlordId", "==", landlordId)
  .where("decisionId", "==", decisionId)
  .orderBy("timestamp", "desc")
```

**Audit Assumptions**:
- ✅ **Decision Audit Trail**: Decision actions must be immutable for governance audit
- ✅ **Landlord-Scoped Audit**: Decision audit properly limited to landlord ownership
- ✅ **Lease Correlation**: Decision actions tied to specific leases for audit completeness
- ✅ **Action Timeline**: Chronological decision action timeline supports governance workflows

**Index Dependency Analysis**:
- ❌ **Missing Indexes**: No custom indexes defined for `decisionActions` collection
- ⚠️ **Performance Risk**: Decision audit queries may perform poorly without optimization
- ❌ **Investigation Required**: Decision workflow query patterns need index strategy

**Compliance Impact**: **CRITICAL** - Decision audit trail essential for governance compliance and evidence integrity

### Operator Review Session Audit Queries
**Collection**: `operatorReviewSessions`  
**Query Patterns** (inferred from collection structure):
```typescript
// Review session audit for specific landlord
firestore.collection("operatorReviewSessions")
  .where("landlordId", "==", landlordId)
  .where("scope", "==", scope)
  .orderBy("createdAt", "desc")

// Review session audit by session outcome
firestore.collection("operatorReviewSessions")
  .where("landlordId", "==", landlordId)
  .where("outcome", "==", outcome)
  .orderBy("createdAt", "desc")
```

**Audit Assumptions**:
- ✅ **Review Process Audit**: Review sessions must be immutable for governance audit
- ✅ **Scope-Specific Audit**: Review audit tied to specific scope (lease, property, tenant)
- ✅ **Outcome Tracking**: Review outcomes tracked for governance effectiveness measurement
- ✅ **Operator Accountability**: Review sessions support operator accountability and training

**Index Dependency Analysis**:
- ❌ **Missing Indexes**: No custom indexes defined for `operatorReviewSessions` collection
- ⚠️ **Governance Risk**: Review workflow audit queries may lack adequate performance
- ❌ **Investigation Required**: Review session query optimization needed for governance workflows

**Compliance Impact**: **CRITICAL** - Review process audit essential for governance oversight and compliance

## 6. Registry Audit Query Dependencies

### Registry Audit Log Queries
**Collection**: `registryAuditLog`
**Primary Indexes**:
- `registryRecordId + createdAt + __name__ (DESC)`
- `propertyId + createdAt + __name__ (DESC)`  
- `importBatchId + createdAt + __name__ (DESC)`

**Query Patterns**:
```typescript
// Audit trail for specific registry record
firestore.collection("registryAuditLog")
  .where("registryRecordId", "==", recordId)
  .orderBy("createdAt", "desc")

// Property registry audit trail
firestore.collection("registryAuditLog")
  .where("propertyId", "==", propertyId)
  .orderBy("createdAt", "desc")

// Import batch audit trail
firestore.collection("registryAuditLog")
  .where("importBatchId", "==", batchId)
  .orderBy("createdAt", "desc")
```

**Audit Assumptions**:
- ✅ **Registry Change Tracking**: All registry changes must generate audit log entries
- ✅ **Data Lineage**: Audit log supports data lineage and provenance tracking
- ✅ **Import Traceability**: Import batch correlation enables batch processing audit
- ✅ **Property Correlation**: Property-scoped audit enables property identity audit

**Index Dependency Analysis**:
- ✅ **Comprehensive Index Coverage**: Registry audit log has well-designed composite indexes
- ✅ **Performance**: Audit queries optimized for registry operations and batch processing
- ✅ **Multiple Access Patterns**: Indexes support record-specific, property-specific, and batch-specific audit

**Compliance Impact**: **HIGH** - Registry audit essential for data lineage compliance and external data governance

### Registry Import Audit Queries
**Collection**: `registryImports`
**Primary Index**: `sourceKey + createdAt + __name__ (DESC)`
**Query Pattern**:
```typescript
firestore.collection("registryImports")
  .where("sourceKey", "==", sourceKey)
  .orderBy("createdAt", "desc")
```

**Audit Assumptions**:
- ✅ **Import Batch Tracking**: Registry imports tracked for data lineage and audit
- ✅ **Source Isolation**: Import audit properly scoped by data source
- ✅ **Chronological Tracking**: Import timeline supports batch processing audit
- ✅ **Error Correlation**: Import failures and successes tracked for operational audit

**Index Dependency Analysis**:
- ✅ **Source-Scoped Index**: Import audit index optimized for source-specific queries
- ✅ **Timeline Performance**: Chronological index supports import batch analysis
- ✅ **Operational Efficiency**: Index design supports registry operational workflows

**Compliance Impact**: **HIGH** - Import audit supports external data compliance and operational governance

## 7. Security Audit Query Dependencies

### Authentication and Session Audit
**Query Patterns** (inferred from session management):
```typescript
// User session audit (if implemented)
firestore.collection("sessionAuditLog")
  .where("userId", "==", userId)
  .orderBy("timestamp", "desc")

// Authentication event audit (if implemented)  
firestore.collection("authAuditLog")
  .where("email", "==", email)
  .orderBy("timestamp", "desc")
```

**Audit Assumptions**:
- ⚠️ **Implementation Status Unknown**: Security audit collections may not be fully implemented
- ✅ **User-Scoped Audit**: Security audit should be scoped to specific users
- ✅ **Timeline Integrity**: Authentication audit timeline critical for security investigations
- ⚠️ **Retention Policy**: Security audit data needs retention and privacy policy compliance

**Index Dependency Analysis**:
- ❌ **Missing Implementation**: Security audit query patterns need verification and implementation
- ❌ **Index Strategy Undefined**: Security audit queries lack defined index strategy
- ⚠️ **Performance Requirements**: Security investigation queries need adequate performance for incident response

**Compliance Impact**: **CRITICAL** - Security audit essential for security compliance and incident investigation

### Access Control Audit
**Query Patterns** (inferred from authorization requirements):
```typescript
// Access audit for specific resource (if implemented)
firestore.collection("accessAuditLog")
  .where("resourceId", "==", resourceId)
  .where("action", "==", action)
  .orderBy("timestamp", "desc")

// Cross-tenant access audit (if implemented)
firestore.collection("accessAuditLog")
  .where("actorId", "==", actorId)
  .orderBy("timestamp", "desc")
```

**Audit Assumptions**:
- ❌ **Implementation Gap**: Access control audit may not be comprehensively implemented
- ✅ **Resource-Scoped Audit**: Access audit should track resource-specific access patterns
- ✅ **Action Tracking**: Access audit should track specific actions for security analysis
- ✅ **Cross-Reference Capability**: Access audit should correlate with business operation audit

**Index Dependency Analysis**:
- ❌ **Missing Implementation**: Access audit infrastructure needs development
- ❌ **Index Requirements Undefined**: Access audit query optimization needs planning
- ⚠️ **Security Priority**: Access audit critical for security compliance and governance

**Compliance Impact**: **CRITICAL** - Access control audit essential for privacy and security compliance

## 8. Compliance Audit Query Dependencies

### Reporting Consent Audit Queries
**Collection**: `reportingConsents`
**Primary Indexes**:
- `landlordId + tenantId + createdAt + __name__ (DESC)`
- `landlordId + status + tenantId + createdAt + __name__ (DESC)`

**Query Patterns**:
```typescript
// Tenant consent audit trail
firestore.collection("reportingConsents")
  .where("landlordId", "==", landlordId)
  .where("tenantId", "==", tenantId)
  .orderBy("createdAt", "desc")

// Consent status audit
firestore.collection("reportingConsents")
  .where("landlordId", "==", landlordId)
  .where("status", "==", "active")
  .orderBy("createdAt", "desc")
```

**Audit Assumptions**:
- ✅ **Consent Immutability**: Consent records must be immutable for regulatory compliance
- ✅ **Timeline Tracking**: Consent change timeline critical for compliance audit
- ✅ **Status Transitions**: Consent status changes must be tracked for audit completeness
- ✅ **Regulatory Requirements**: Consent audit must meet credit reporting regulatory requirements

**Index Dependency Analysis**:
- ✅ **Comprehensive Index Coverage**: Consent audit has well-designed composite indexes
- ✅ **Compliance Performance**: Consent queries optimized for regulatory reporting workflows
- ✅ **Multi-Dimensional Access**: Indexes support tenant-specific and status-specific audit

**Compliance Impact**: **CRITICAL** - Consent audit essential for credit reporting regulatory compliance

### Financial Compliance Audit Queries
**Collections**: `ledgerEvents`, `ledgerEventsV2`, `payments`, `paymentReconciliationRecords`
**Query Patterns**:
```typescript
// Financial compliance audit for tenant
firestore.collection("payments")
  .where("tenantId", "==", tenantId)
  .where("amount", ">=", reportingThreshold)
  .orderBy("paidAt", "desc")

// Reconciliation audit trail
firestore.collection("paymentReconciliationRecords")
  .where("leaseId", "==", leaseId)
  .orderBy("createdAt", "desc")
```

**Audit Assumptions**:
- ✅ **Financial Record Immutability**: Financial records must be immutable for compliance audit
- ✅ **Reporting Threshold Tracking**: Financial audit supports regulatory reporting thresholds
- ✅ **Reconciliation Completeness**: Payment reconciliation audit ensures financial accuracy
- ✅ **Cross-Reference Integrity**: Financial audit correlates across multiple collections

**Index Dependency Analysis**:
- ✅ **Payment Index Coverage**: Payment queries have adequate index support
- ⚠️ **Reconciliation Index Gap**: Payment reconciliation records may lack optimized indexes
- ⚠️ **Threshold Query Performance**: Amount-based filtering may require composite index optimization

**Compliance Impact**: **CRITICAL** - Financial compliance audit essential for accounting and regulatory requirements

## 9. Append-Safety and Immutability Verification

### Current Immutability Status by Collection

#### High Immutability Compliance
- ✅ **`registryAuditLog`**: Append-only design, proper audit log semantics
- ✅ **`registryImports`**: Import batch records, append-only operational pattern
- ✅ **`payments`**: Financial records, strong append-only expectation

#### Medium Immutability Compliance  
- ⚠️ **`events`**: Append-oriented but may allow updates in some workflows
- ⚠️ **`ledgerEvents`/`ledgerEventsV2`**: Financial events, append-expected but not enforced
- ⚠️ **`reportingConsents`**: Consent records should be immutable but verification needed

#### Low Immutability Compliance
- ❌ **`canonicalEvents`**: Canonical audit events lack immutability enforcement
- ❌ **`decisionActions`**: Decision audit trail lacks immutability verification
- ❌ **`operatorReviewSessions`**: Review audit lacks immutability enforcement

### Immutability Enforcement Recommendations

#### Immediate Actions Required
1. **Canonical Events Immutability**: Implement append-only enforcement for evidence integrity
2. **Decision Action Immutability**: Enforce immutability for governance audit compliance
3. **Review Session Immutability**: Implement append-only enforcement for review process audit

#### Future Enforcement Considerations
1. **Firestore Rules Integration**: Use Firestore rules to enforce append-only semantics
2. **Service-Layer Enforcement**: Implement application-level immutability checks
3. **Audit Trail Validation**: Add validation to ensure audit trail completeness and integrity

## 10. Query Performance Baseline

### Critical Performance Requirements (< 1 second)
- Financial audit queries for balance calculations and real-time workflows
- Tenant audit queries for portal performance and workspace responsiveness
- Payment audit queries for financial reconciliation and reporting

### Standard Performance Requirements (1-3 seconds)
- Landlord audit queries for operational dashboard and management workflows
- Registry audit queries for import processing and data lineage verification
- Property audit queries for maintenance and operational audit

### Acceptable Performance Requirements (3-10 seconds)
- Compliance audit queries for regulatory reporting and periodic analysis
- Cross-tenant analytics queries for administrative and governance analysis
- Evidence audit queries for review workflows and governance processes

## 11. Audit Completeness Verification

### Query Coverage Assessment

#### Well-Covered Audit Domains
- ✅ **Financial Audit**: Comprehensive ledger and payment audit query coverage
- ✅ **Registry Audit**: Complete import and correlation audit query support
- ✅ **Operational Audit**: Basic activity timeline and property audit coverage

#### Partially-Covered Audit Domains  
- ⚠️ **Evidence Audit**: Evidence query patterns need index optimization and verification
- ⚠️ **Compliance Audit**: Consent audit covered but financial compliance audit needs enhancement
- ⚠️ **Decision Audit**: Decision workflow audit queries need performance optimization

#### Under-Covered Audit Domains
- ❌ **Security Audit**: Authentication and access control audit queries need implementation
- ❌ **Review Process Audit**: Review workflow audit queries need comprehensive index strategy
- ❌ **Export Audit**: Export generation and institutional audit queries need development

### Audit Trail Integrity Verification

#### Verified Integrity Areas
- ✅ **Registry Data Lineage**: Complete audit trail from import to correlation
- ✅ **Financial Transaction Timeline**: Payment and ledger event correlation verified
- ✅ **Property Operational Timeline**: Property activity and maintenance audit timeline

#### Integrity Verification Needed
- ⚠️ **Decision Workflow Integrity**: Decision action correlation with review sessions needs verification
- ⚠️ **Evidence Package Integrity**: Evidence audit correlation with source data needs verification
- ❌ **Security Event Integrity**: Security audit trail completeness needs implementation

## 12. Recommendations for Phase 3 Completion

### Immediate Index Implementation Required
1. **Evidence Audit Indexes**: Implement composite indexes for `canonicalEvents` and `decisionActions`
2. **Review Workflow Indexes**: Add performance indexes for `operatorReviewSessions` 
3. **Security Audit Infrastructure**: Plan and implement security audit query strategy

### Phase 3 Mission Integration
1. **Preview/Staging Separation**: Use audit query analysis to verify audit consistency across environments
2. **Recovery Workflow Security**: Apply audit query patterns to recovery operation audit
3. **Operational Incident Readiness**: Use audit query performance baseline for incident response audit

### Future Audit Enhancement
1. **Immutability Enforcement**: Implement append-only enforcement for critical audit collections
2. **Audit Query Monitoring**: Add performance monitoring for critical audit queries
3. **Compliance Automation**: Automate compliance audit query execution and reporting

This audit query dependency analysis establishes the governance foundation for Phase 3 missions 8-10, ensuring that audit trails remain complete, performant, and compliant while supporting evidence-based governance and regulatory requirements.