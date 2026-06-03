# Local Firestore Emulator Index Parity v1

## 1. Executive Summary

This runbook explains Firestore index behavior in RentChain's local development environment, testing strategies for index-dependent queries, and guidance for maintaining query performance parity between local emulator, preview, and production environments.

Local Firestore emulator behavior differs significantly from production: the emulator allows all queries regardless of custom index availability, while production requires custom indexes for composite queries. This document provides testing strategies to catch index-related query failures before deployment and ensures development practices support production query performance.

## 2. Local Emulator Index Behavior

### Firestore Rules Configuration
**Local Rules File**: `firestore.rules`
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Local emulator only.
    // Not intended for production deployment.
    // Production Firestore rules require separate review.
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Key Implications**:
- ✅ **All Access Allowed**: Local emulator permits all read/write operations without authentication
- ✅ **No Index Requirements**: Queries execute successfully without custom indexes
- ⚠️ **Production Difference**: Production has strict Firestore rules and requires custom indexes
- ⚠️ **Performance Difference**: Local queries may perform differently than production

### Firebase Emulator Configuration
**Configuration File**: `firebase.json`
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "rentchain-api/firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "host": "127.0.0.1",
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "host": "127.0.0.1",
      "port": 4000
    },
    "singleProjectMode": true
  }
}
```

**Key Features**:
- ✅ **Index Configuration Reference**: Points to production index configuration
- ✅ **Single Project Mode**: Simplified local development setup
- ✅ **Emulator UI**: Web interface available at `http://127.0.0.1:4000` for debugging
- ⚠️ **Index Import**: Indexes are referenced but may not be enforced in emulator

## 3. Index Parity Challenges

### Emulator vs Production Index Behavior

#### Local Emulator Behavior
- **Query Execution**: All queries succeed regardless of index availability
- **Performance**: Query performance may not reflect production characteristics
- **Error Detection**: Index-related query failures not detected locally
- **Development Experience**: Fast query execution, no index-related blocking

#### Production Environment Behavior
- **Query Execution**: Composite queries fail without appropriate custom indexes
- **Performance**: Query performance directly dependent on index strategy
- **Error Detection**: Missing indexes cause immediate query failures
- **Deployment Risk**: Query failures can break production functionality

### Common Index Parity Issues

#### Composite Query Dependencies
**Problem**: Queries with multiple `where` clauses + `orderBy` require custom indexes in production
**Local Behavior**: Queries succeed without indexes
**Production Impact**: Query failures, application errors

**Example Query**:
```typescript
// Requires custom index in production, works locally without index
firestore.collection("ledgerEventsV2")
  .where("landlordId", "==", landlordId)
  .where("propertyId", "==", propertyId)
  .orderBy("occurredAt", "desc")
```

**Required Index**: `landlordId + propertyId + occurredAt + __name__ (DESC)`

#### Array-Contains with Additional Filters
**Problem**: Array-contains queries with additional filters require custom indexes
**Local Behavior**: Queries succeed without specific array indexes
**Production Impact**: Query performance issues or failures

**Example Query**:
```typescript
// Requires custom index for array-contains + additional filters
firestore.collection("registryMatches")
  .where("sourceKey", "==", sourceKey)
  .where("queueSearchTokens", "array-contains", token)
  .orderBy("updatedAt", "desc")
```

**Required Index**: `sourceKey + queueSearchTokens (CONTAINS) + updatedAt + __name__ (DESC)`

#### Large Result Set Queries
**Problem**: Queries returning large result sets may perform differently
**Local Behavior**: Fast execution due to small test datasets
**Production Impact**: Slow queries, timeouts, resource exhaustion

**Example Scenarios**:
- Landlord queries with thousands of properties/leases/tenants
- Admin date range queries spanning large time periods
- Registry correlation queries with high-cardinality matches

## 4. Testing Strategies for Index Parity

### Development Testing Approach

#### 1. Index Configuration Verification
**Frequency**: Before each deployment
**Method**:
```bash
# Verify index configuration is valid
firebase deploy --only firestore:indexes --project preview

# Check index deployment status
firebase firestore:indexes --project preview
```

**Verification Points**:
- ✅ All custom indexes in `firestore.indexes.json` are valid
- ✅ Index deployment completes without errors
- ✅ Index status shows as "Ready" in preview environment

#### 2. Query Pattern Validation
**Frequency**: During feature development
**Method**: Code review checklist for new queries

**Query Review Checklist**:
- [ ] Single-field queries: Verify auto-generated indexes are sufficient
- [ ] Composite queries: Confirm custom index exists in `firestore.indexes.json`
- [ ] Array-contains queries: Verify array-contains index with additional filters
- [ ] OrderBy queries: Confirm ordering field is included in composite index
- [ ] Range queries: Verify range filter + additional filter index requirements

#### 3. Preview Environment Testing
**Frequency**: Before production deployment
**Method**: End-to-end testing in preview environment

**Preview Testing Focus Areas**:
- ✅ **Critical Query Paths**: Test tenant workspace, landlord dashboard, admin operations
- ✅ **Large Dataset Simulation**: Test queries with realistic data volumes
- ✅ **Performance Validation**: Verify query performance meets requirements
- ✅ **Error Detection**: Confirm no index-related query failures

### Automated Testing Approaches

#### Query Index Coverage Testing
**Implementation**: Add unit tests that verify query patterns match available indexes
```typescript
describe('Query Index Coverage', () => {
  it('should have required index for tenant balance query', () => {
    const queryPattern = {
      collection: 'events',
      where: [['tenantId', '==', 'test']],
      orderBy: [['timestamp', 'desc']]
    };

    expect(hasRequiredIndex(queryPattern)).toBe(true);
  });
});
```

#### Performance Baseline Testing
**Implementation**: Add performance tests that measure query execution time
```typescript
describe('Query Performance', () => {
  it('should complete tenant balance query within 500ms', async () => {
    const startTime = Date.now();

    await firestore.collection('events')
      .where('tenantId', '==', testTenantId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500);
  });
});
```

## 5. Local Development Best Practices

### Query Development Guidelines

#### 1. Index-First Development
**Approach**: Plan custom indexes before implementing queries
**Process**:
1. Design query pattern based on business requirements
2. Add required custom index to `firestore.indexes.json`
3. Deploy index to preview environment
4. Implement query in application code
5. Test in preview environment to verify performance

#### 2. Query Complexity Assessment
**Guidelines for query design**:

**Simple Queries (Auto-Generated Index Sufficient)**:
- Single equality filter: `where("field", "==", value)`
- Single inequality filter: `where("field", ">", value)`
- Single orderBy: `orderBy("field", "asc|desc")`

**Complex Queries (Custom Index Required)**:
- Multiple equality filters: `where("field1", "==", value1).where("field2", "==", value2)`
- Equality + orderBy: `where("field1", "==", value).orderBy("field2", "desc")`
- Array-contains + filters: `where("array", "array-contains", value).where("field", "==", value)`
- Inequality + orderBy on different fields: `where("field1", ">", value).orderBy("field2", "desc")`

#### 3. Performance-Aware Query Design
**Query Performance Considerations**:
- **Result Set Size**: Use `limit()` to prevent large result set performance issues
- **Filter Selectivity**: Place most selective filters first in composite indexes
- **Pagination**: Implement cursor-based pagination for large datasets
- **Caching**: Consider result caching for frequently accessed, slowly-changing data

### Local Testing Workflow

#### Daily Development Workflow
1. **Start Emulator**: `npm --prefix rentchain-api run emulator:firestore`
2. **Develop Features**: Implement queries using local emulator
3. **Code Review**: Verify query patterns match index configuration
4. **Preview Testing**: Test query performance in preview environment
5. **Performance Validation**: Confirm queries meet performance requirements

#### Pre-Deployment Workflow
1. **Index Validation**: Deploy indexes to preview environment
2. **Query Testing**: Execute all query patterns in preview environment
3. **Performance Testing**: Measure query performance with realistic data
4. **Error Testing**: Verify no index-related failures in preview
5. **Production Deployment**: Deploy with confidence in query performance

## 6. Preview Environment Index Management

### Index Deployment Strategy
**Deployment Command**:
```bash
# Deploy indexes to preview environment
firebase deploy --only firestore:indexes --project rentchain-preview

# Verify index deployment status
firebase firestore:indexes --project rentchain-preview
```

**Index Deployment Considerations**:
- ✅ **Index Build Time**: Large collections may require hours for index creation
- ⚠️ **Collection Size Impact**: Index creation time scales with collection size
- ⚠️ **Write Performance**: Index creation may temporarily impact write performance
- ✅ **Incremental Deployment**: New indexes can be added without disrupting existing indexes

### Preview Data Management
**Data Seeding for Index Testing**:
- **Realistic Volume**: Seed preview with data volumes representative of production
- **Query Pattern Coverage**: Include data that exercises all major query patterns
- **Performance Baseline**: Use preview data to establish query performance baselines
- **Edge Case Testing**: Include edge cases like large result sets, empty results, boundary conditions

## 7. Performance Difference Analysis

### Expected Performance Characteristics

#### Local Emulator Performance
- **Dataset Size**: Small test datasets (10-1000 documents per collection)
- **Query Speed**: Very fast (< 100ms for most queries)
- **Memory Usage**: Low memory usage due to small datasets
- **Concurrency**: Single developer, low concurrency load

#### Preview Environment Performance
- **Dataset Size**: Medium test datasets (1k-100k documents per collection)
- **Query Speed**: Realistic performance (100ms-3 seconds depending on query)
- **Memory Usage**: Realistic memory usage patterns
- **Concurrency**: Low-to-medium concurrency, realistic for testing

#### Production Environment Performance
- **Dataset Size**: Full production datasets (10k-1M+ documents per collection)
- **Query Speed**: Production performance characteristics (varies by index strategy)
- **Memory Usage**: High memory usage, production-scale resource requirements
- **Concurrency**: High concurrency, full production load

### Performance Optimization Strategies

#### Index Optimization
- **Composite Index Design**: Optimize field order for query selectivity
- **Index Minimization**: Remove unused indexes to reduce write overhead
- **Performance Monitoring**: Monitor index usage and query performance in production

#### Query Optimization
- **Result Set Limiting**: Use appropriate `limit()` values for query result sets
- **Filter Optimization**: Order filters by selectivity (most selective first)
- **Pagination Strategy**: Implement efficient pagination for large result sets

#### Caching Strategies
- **Application-Level Caching**: Cache frequently accessed, slowly-changing data
- **Query Result Caching**: Cache query results for read-heavy workloads
- **Cache Invalidation**: Implement proper cache invalidation for data consistency

## 8. Troubleshooting Common Issues

### Index-Related Query Failures

#### Symptom: Query fails in preview/production but works locally
**Diagnosis**: Missing custom index for composite query
**Solution**:
1. Identify query pattern requiring custom index
2. Add index definition to `firestore.indexes.json`
3. Deploy index to target environment
4. Wait for index creation to complete
5. Retry query execution

#### Symptom: Query performance much slower in preview/production
**Diagnosis**: Query relies on collection scan instead of index
**Solution**:
1. Analyze query execution plan (if available)
2. Verify appropriate index exists and is ready
3. Optimize query pattern or index design
4. Consider query result caching for frequently accessed data

#### Symptom: Index creation fails or times out
**Diagnosis**: Large collection size or complex index requirements
**Solution**:
1. Monitor index creation progress in Firebase console
2. Consider off-peak deployment for large index creation
3. Break complex indexes into simpler components if possible
4. Plan for extended deployment time for large collections

### Performance Issues

#### Symptom: Queries timeout in production but not locally
**Diagnosis**: Production dataset size much larger than local test data
**Solution**:
1. Add appropriate `limit()` constraints to queries
2. Implement pagination for large result sets
3. Optimize query filters for better selectivity
4. Consider result caching for frequently accessed data

#### Symptom: Write performance degrades after index deployment
**Diagnosis**: Too many indexes on frequently written collections
**Solution**:
1. Audit index usage and remove unused indexes
2. Optimize index design for essential queries only
3. Consider write pattern optimization
4. Monitor write performance metrics after index changes

## 9. Monitoring and Maintenance

### Index Usage Monitoring
**Monitoring Strategies**:
- **Firebase Console**: Monitor index usage statistics and performance
- **Application Metrics**: Track query performance and error rates
- **Performance Dashboards**: Monitor query latency and throughput

### Index Maintenance
**Maintenance Tasks**:
- **Quarterly Index Review**: Review index usage and remove unused indexes
- **Performance Optimization**: Analyze slow queries and optimize indexes
- **Index Strategy Updates**: Update index strategy based on query pattern changes

### Emergency Procedures
**Index-Related Production Issues**:
1. **Immediate**: Disable affected queries if possible to prevent cascading failures
2. **Short-term**: Deploy emergency index or query optimization
3. **Long-term**: Review and optimize overall index strategy
4. **Follow-up**: Post-incident review and prevention strategy updates

This runbook provides the foundation for maintaining Firestore query performance parity across development, preview, and production environments while supporting efficient local development workflows.