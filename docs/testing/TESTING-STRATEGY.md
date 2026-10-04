# Komenin Testing Strategy

## Overview

Komenin memiliki comprehensive test suite dengan coverage di berbagai layer:
- **Unit Tests**: Individual function/component testing
- **Integration Tests**: Multi-component/system integration
- **E2E Tests**: Full user journey validation
- **Smoke Tests**: Quick health checks

## Current Test Coverage

### Unit Tests (Existing)

Located in `tests/unit/`:

| Test File | Coverage Area | Status |
|---|---|---|
| `smoke.test.ts` | Basic sanity check | ✅ Basic |
| `security.test.ts` | Security utilities | ✅ Comprehensive |
| `encryption.test.ts` | Encryption service | ✅ Good |
| `rbac.test.ts` | Role-based access control | ✅ Good |
| `billing-commerce.test.ts` | Billing calculations | ✅ Good |
| `entitlements.test.ts` | Feature entitlements | ✅ Good |
| `quota.test.ts` | Quota management | ✅ Good |
| `connector-router.test.ts` | Connector routing logic | ✅ Good |
| `work-foundation.test.ts` | Worker basics | ✅ Basic |
| `live-readiness.test.ts` | Production readiness gates | ✅ Good |
| `production-gate.test.ts` | Production deployment checks | ✅ Comprehensive |
| `mock-social-bridge.test.ts` | Bridge mock mode | ✅ Good |
| `live-bridge.test.ts` | Bridge live mode | ⚠️ Limited |
| `credential-router.test.ts` | Credential management | ❌ Missing |
| `webhook-client.test.ts` | Webhook handling | ⚠️ Partial |
| `e2e/mock-bridge.e2e.ts` | E2E bridge flow | ⚠️ Basic |

### Component Tests (Existing)

Located in `tests/components/`:

| Test File | Component | Status |
|---|---|---|
| `form-select.test.tsx` | Form Select UI | ✅ Good |
| `hero-section.test.tsx` | Marketing Hero | ✅ Basic |
| `app-sidebar.test.tsx` | App Navigation Sidebar | ⚠️ Partial |
| `site-header.test.tsx` | Site Header | ❌ Missing |

## Testing Pyramid

```
                    ┌──────────────┐
                    │    E2E       │  ← Few (5-10 tests)
                    │   Tests      │     • Critical user journeys
                    └──────────────┘
                          ▲
                   ┌──────┴──────┐
                   │ Integration │  ← Moderate (20-30 tests)
                   │   Tests      │     • API endpoints
                   └──────────────┘
                          ▲
              ┌───────────┴───────────┐
              │      Unit Tests       │  ← Many (100+ tests)
              │                       │     • Business logic
              └───────────────────────┘
```

## Gaps & Priority Areas

### 🔴 HIGH PRIORITY - Missing Critical Tests

#### 1. Authentication Flow Tests

**Status**: ❌ Largely missing

**What to test:**
```typescript
// tests/auth/auth-flows.test.ts

describe('Authentication Flows', () => {
  it('should complete Google OAuth flow successfully', async () => {
    // Mock Google OAuth callbacks
    // Verify session creation
    // Check user profile setup
  });
  
  it('should handle invite accept flow correctly', async () => {
    // Generate invite token
    // Accept invite via email link
    // Create workspace membership
  });
  
  it('should enforce workspace permissions after auth', async () => {
    // Login as operator
    // Try admin-only actions
    // Expect 403 Forbidden
  });
});
```

#### 2. Workspace Management Tests

**Status**: ⚠️ Partial

**Missing tests:**
```typescript
// tests/workspace/workspace-management.test.ts

describe('Workspace Management', () => {
  it('should create new workspace with owner role', async () => {
    // POST /api/workspaces/create
    // Verify workspace + owner membership created
  });
  
  it('should invite users to workspace', async () => {
    // Generate invite link
    // Verify expiration handling
    // Check role assignment
  });
  
  it('should handle workspace member removal', async () => {
    // Remove non-owner member
    // Verify audit log entry
    // Check cleanup of related data
  });
  
  it('should transfer ownership when owner leaves', async () => {
    // Owner initiates departure
    // Assign new owner from admins
    // Fallback if no other admins
  });
});
```

#### 3. Social Platform Integration Tests

**Status**: ⚠️ Limited

**Missing tests:**
```typescript
// tests/integration/social-platforms.test.ts

describe('Social Platform Integration', () => {
  describe('Instagram', () => {
    it('should fetch posts using Instagram Graph API', async () => {
      // Setup mock Instagram OAuth tokens
      // Call Instagram API
      // Parse response to Post objects
    });
    
    it('should send comment to Instagram post', async () => {
      // Authenticate with Instagram
      // Post comment
      // Verify result message
    });
    
    it('should handle Instagram rate limits gracefully', async () => {
      // Simulate rate limit response
      // Verify retry logic
      // Check circuit breaker activation
    });
  });
  
  describe('Threads', () => {
    // Similar test structure for Threads
  });
  
  describe('TikTok', () => {
    // Similar test structure for TikTok
  });
});
```

#### 4. Notification & Alerting Tests

**Status**: ❌ Missing

**Missing tests:**
```typescript
// tests/services/notification-service.test.ts

describe('Notification Service', () => {
  it('should send in-app notification on job failure', async () => {
    // Trigger job failure scenario
    // Verify notification created
    // Check notification channel
  });
  
  it('should handle notification preferences per workspace', async () => {
    // Configure workspace notification settings
    // Trigger event
    // Verify delivery based on preferences
  });
});
```

#### 5. Audit Log Tests

**Status**: ❌ Partial

**Missing tests:**
```typescript
// tests/services/audit-logging.test.ts

describe('Audit Logging', () => {
  it('should record all sensitive operations', async () => {
    // Perform operation (delete account, modify billing)
    // Verify audit log entry created
    // Check metadata completeness
  });
  
  it('should mask sensitive fields in audit logs', async () => {
    // Perform action with sensitive data
    // Verify encryption/token values masked in logs
  });
  
  it('should index audit logs by workspace and date', async () => {
    // Query audit logs with filters
    // Verify efficient database indexing works
  });
});
```

### 🟡 MEDIUM PRIORITY - Weakly Tested

#### 1. Proxy Rotation Logic

**Current**: Basic smoke test only

**Need more:**
- Rotated IP validation
- Proxy health check scenarios
- Failed proxy fallback paths

#### 2. Content Generation Pipeline

**Current**: Some unit tests for templates

**Need more:**
- AI model integration tests
- Content quality validation
- Rate limiting during generation

#### 3. Billing Payment Flow

**Current**: Amount calculation tests

**Need more:**
- Midtrans webhook handling
- Subscription cancellation flows
- Refund processing scenarios

### 🟢 LOW PRIORITY - Well Tested

These areas have good coverage:
- ✅ Security utilities
- ✅ Encryption service
- ✅ RBAC core logic
- ✅ Quota calculations
- ✅ Production gates

## New Test Files to Create

### Critical Additions

1. **`tests/e2e/onboarding-journey.test.ts`**
   - Complete signup → first workspace → connect account → publish flow
   
2. **`tests/e2e/billing-flow.test.ts`**
   - Checkout → payment → subscription activation → invoice
   
3. **`tests/integration/worker-jobs.test.ts`**
   - All worker job types with various failure scenarios
   
4. **`tests/integration/notification-workflow.test.ts`**
   - End-to-end notification delivery across channels
   
5. **`tests/api/admin-operations.test.ts`**
   - Admin panel CRUD operations with various roles

### Quality Improvements

1. **`tests/factories/data-factories.ts`**
   - Centralized test data generation
   - Fixture management
   
2. **`tests/mocks/platform-api-mocks.ts`**
   - Mock responses for all social platforms
   - Rate limit simulation
   
3. **`tests/setup/database-seed.ts`**
   - Clean database seeding before tests
   - Workspace templates

## Test Execution Strategy

### CI/CD Pipeline

```yaml
jobs:
  test:
    # Fast feedback: lint + critical unit tests
    run: npm run test:fast
    
  test-full:
    # Nightly or PR-merge: all tests
    run: npm run test:all
    
  test-e2e:
    # Staging environment validation
    environment: staging
    run: npm run test:e2e
    
  test-security:
    # Specialized security scans
    run: npm run test:security
```

### Parallelization Strategy

```bash
# Run tests in parallel by file
npm run test -- --parallel

# Or by category
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:components
```

## Mocking Strategy

### Platform APIs

```typescript
// tests/mocks/social-platforms.ts

class SocialPlatformMock {
  private requestQueue: Array<{
    endpoint: string;
    method: string;
    response?: any;
    error?: Error;
  }> = [];
  
  stub(
    endpoint: string,
    options: { 
      response?: any; 
      error?: Error;
      delay?: number;
    }
  ) {
    this.requestQueue.push({
      endpoint,
      method: options.error ? 'ERROR' : 'RESPONSE',
      response: options.response,
      error: options.error,
    });
  }
  
  async getMockResponse(endpoint: string): Promise<any> {
    const mock = this.requestQueue.shift();
    if (!mock) throw new Error(`No mock found for ${endpoint}`);
    
    if (mock.error) throw mock.error;
    return mock.response;
  }
}
```

### Database Mocking

For faster unit tests that don't need real DB:

```typescript
// tests/mocks/database-mock.ts

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workspace: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  // ... other models
} as unknown as PrismaClient;
```

## Performance Benchmarking

Add performance regression detection:

```typescript
// tests/performance/api-latency.test.ts

import { performance } from 'perf_hooks';

describe('API Performance', () => {
  it('posts/list should respond under 200ms p95', async () => {
    const durations = [];
    
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await apiRequest('/api/posts/list');
      durations.push(performance.now() - start);
    }
    
    const p95 = percentile(durations, 95);
    expect(p95).toBeLessThan(200);
  });
});
```

## Visual Regression Testing

For UI components:

```bash
# Install @storybook/test
npm install @storybook/test -D

# Run visual tests
npm run test-storybook
```

Or use Playwright screenshots:

```typescript
// tests/e2e/visual-regression.test.ts

test('billing page maintains layout', async ({ page }) => {
  await page.goto('/app/checkout');
  await expect(page).toHaveScreenshot('billing-page.png');
});
```

## Integration with Development Workflow

### Pre-commit Hooks

```json
// .husky/pre-commit
{
  "scripts": [
    "npx eslint --max-warnings=0",
    "npx vitest run tests/unit/{critical}.test.ts"
  ]
}
```

### Pre-push Validation

```bash
# Full test suite before pushing to main
npm run test:all && npm run build
```

## Code Coverage Targets

| Layer | Target Coverage | Threshold |
|---|---|---|
| Unit Tests | ≥80% | ≤70% fails CI |
| Integration Tests | ≥60% | Optional for features |
| E2E Tests | Focus on critical paths | Must pass |
| Components | ≥70% | ≤60% fails CI |

## Tools & Frameworks

### Current Stack

- **Test Runner**: Vitest
- **Testing Library**: @testing-library/react
- **Mocking**: Vi (Vitest's mock functions)
- **Visual Regression**: Not yet set up

### Recommended Additions

```bash
# API Testing
npm install supertest -D

# Load Testing
npm install k6 -g

# Accessibility Testing
npm install @axe-core/playwright -D
```

## Maintenance & Review

### Quarterly Review

Every quarter:
1. Mark deprecated tests as archival
2. Update mocks for platform API changes
3. Analyze flaky tests and fix
4. Add coverage for new features

### Test Data Hygiene

- Clean up old test fixtures monthly
- Archive expired test data quarterly
- Remove duplicate test scenarios

## Next Steps

### Phase 1 (This Week)
1. ✅ Review current test coverage
2. ✅ Document gaps
3. Start writing high-priority missing tests
4. Set up test data factories

### Phase 2 (Next Sprint)
1. Implement E2E onboarding journey tests
2. Add notification workflow integration tests
3. Fix identified flaky tests
4. Set up automated code coverage reporting

### Phase 3 (Ongoing)
1. Add performance benchmarks to critical paths
2. Implement visual regression testing
3. Improve test documentation
4. Train team on testing best practices

## References

- [vitest.dev](https://vitest.dev/) - Vitest Documentation
- [testing-library.com](https://testing-library.com/) - Testing Library Guide
- [playwright.dev](https://playwright.dev/) - E2E Testing
- [@microsoft/test-decorator](https://github.com/microsoft/test-decorator) - Test organization patterns
