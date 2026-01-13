# Memory Service Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the Memory Service, from initial setup through production deployment. The service is already implemented as documented in [`MEMORY_SERVICE_SUMMARY.md`](../../../docs/MEMORY_SERVICE_SUMMARY.md), and this plan serves as both a completion checklist and a guide for remaining tasks.

---

## Implementation Status

### ✅ Completed (MVP Core)

-   NestJS project structure and configuration
-   PostgreSQL schema with Prisma ORM
-   Database migrations and seed scripts
-   All 5 core API endpoints (register, messages, conversations, user conversations, synthesize)
-   Docker Compose for local PostgreSQL
-   Basic error handling and validation
-   Swagger/OpenAPI documentation
-   Initial unit and E2E tests
-   Service documentation (README, IMPLEMENTATION)

### 🔄 In Progress

-   OpenSpec documentation (this document and related specs)
-   Integration with main CourseWise platform
-   Test coverage expansion
-   Health monitoring enhancements

### ⏳ Pending

-   Firebase Authentication middleware
-   Production deployment to Cloud Run
-   Real mem0.ai SDK integration
-   CI/CD pipeline setup
-   Monitoring and alerting configuration

---

## Phase 1: OpenSpec & Documentation ✅

### 1.1 Create OpenSpec Artifacts

**Status**: ✅ Complete

**Tasks**:

-   [x] Create [`openspec/specs/memory-service/spec.md`](./spec.md) - Formal requirements and scenarios
-   [x] Create [`openspec/specs/memory-service/design.md`](./design.md) - Technical decisions and architecture
-   [x] Create [`openspec/specs/memory-service/plan.md`](./plan.md) - Implementation roadmap (this document)
-   [x] Document data model (student→profile→memory)
-   [x] Document operations (read/append/clear)
-   [x] Document quality constraints (privacy, consistency)

**Validation**:

```bash
# If OpenSpec CLI is available:
# openspec validate memory-service --type spec --strict

# Manual validation checklist:
# - All requirements have at least one scenario
# - Scenarios use #### header format
# - Data model documented
# - API endpoints documented
# - Integration points identified
```

---

## Phase 2: Integration Documentation 📝

### 2.1 Update Top-Level Integration Specs

**Status**: 🔄 In Progress

**Tasks**:

-   [ ] Update [`docs/blueprint.md`](../../../docs/blueprint.md) to include Memory Service
-   [ ] Document where Memory fits in app flow (auth → onboarding → courses → chat → memory)
-   [ ] Document API dependencies:
    -   Firebase Auth → Memory Service (user registration)
    -   Socratic Chat → Memory Service (conversation storage/retrieval)
    -   Memory Orchestrator → Memory Service (synthesis triggers)
-   [ ] Create sequence diagrams for key flows
-   [ ] Document error handling and fallback strategies

**Integration Points**:

```
┌──────────────┐
│ Firebase Auth│
└──────┬───────┘
       │ 1. User created
       ▼
┌──────────────┐     2. Register      ┌──────────────┐
│   Onboarding │────────────────────►│    Memory    │
│   Service    │                      │   Service    │
└──────────────┘                      └───────┬──────┘
                                              │
┌──────────────┐     3. Save messages        │
│   Socratic   │◄────────────────────────────┤
│  Chat Flow   │     4. Get history          │
└──────────────┘                              │
                                              │
┌──────────────┐     5. Synthesize           │
│Memory Orchestr│◄────────────────────────────┘
└──────────────┘
```

### 2.2 Architecture Documentation

**Status**: 🔄 In Progress

**Tasks**:

-   [ ] Create system architecture diagram showing Memory Service placement
-   [ ] Document React components that interact with Memory API:
    -   `StudentProfilePage` → calls user conversations
    -   `ChatInterface` → calls save message, get conversation
    -   `MemoryPanel` (future) → displays synthesized memories
-   [ ] Document component↔API mapping
-   [ ] Add Memory Service to deployment architecture

---

## Phase 3: Test Coverage Expansion 🧪

### 3.1 Backend Tests (pytest)

**Status**: 🔄 In Progress (basic tests exist, need expansion)

**Tasks**:

-   [ ] Expand unit tests for all service methods
-   [ ] Add integration tests for:
    -   Concurrent message writes
    -   Transaction rollback scenarios
    -   mem0.ai integration failures
    -   Database connection failures
-   [ ] Add test fixtures for common scenarios
-   [ ] Measure and report test coverage (target: >80%)
-   [ ] Add tests for edge cases:
    -   Very long messages (>10K chars)
    -   Special characters in content
    -   Invalid UUIDs
    -   Pagination edge cases

**Test Commands**:

```bash
cd src/services/memory-service

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Target coverage: >80% lines, >75% branches
```

### 3.2 Frontend Unit Tests (Jest)

**Status**: ⏳ Pending (no frontend components yet)

**Tasks**:

-   [ ] Create Jest tests for Memory API client
-   [ ] Mock backend responses
-   [ ] Test error handling in UI
-   [ ] Test pagination controls
-   [ ] Coverage report for frontend

**Example Test**:

```typescript
// src/lib/__tests__/memory-client.test.ts
import { MemoryClient } from "@/lib/memory-client";

describe("MemoryClient", () => {
    it("should save message and return chatID", async () => {
        // Mock fetch
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                chatID: "test-chat-id",
                messageID: "test-msg-id",
            }),
        });

        const client = new MemoryClient("http://localhost:3001");
        const result = await client.saveMessage({
            chatID: null,
            userID: "user-1",
            content: "Hello",
            sender: "user",
        });

        expect(result.chatID).toBe("test-chat-id");
    });
});
```

### 3.3 E2E Tests (Playwright)

**Status**: ⏳ Pending (Memory Service E2E integration)

**Tasks**:

-   [ ] Extend existing Playwright tests to cover Memory flows
-   [ ] Test: Login → Profile → View conversation history
-   [ ] Test: Login → Chat → Send message → Verify saved
-   [ ] Test: Login → View synthesized memories (when UI exists)
-   [ ] Test error states (offline, API errors)
-   [ ] Run in CI pipeline

**Example E2E Test**:

```typescript
// tests/memory-flow.spec.ts
import { test, expect } from "@playwright/test";

test("Student can save and retrieve messages", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.click('[data-testid="google-login"]');

    // Navigate to chat
    await page.goto("/student/courses/cs101");
    await page.click('[data-testid="open-chat"]');

    // Send message
    await page.fill('[data-testid="chat-input"]', "What is recursion?");
    await page.click('[data-testid="send-message"]');

    // Verify message appears
    await expect(page.locator("text=What is recursion?")).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator("text=What is recursion?")).toBeVisible();
});
```

---

## Phase 4: Authentication & Authorization 🔐

### 4.1 Firebase Auth Middleware

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Create NestJS guard for Firebase token verification
-   [ ] Add guard to all protected endpoints
-   [ ] Extract userID from token claims
-   [ ] Add authorization checks (user can only access own data)
-   [ ] Document authentication flow
-   [ ] Add auth tests

**Implementation**:

```typescript
// src/common/guards/firebase-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import * as admin from "firebase-admin";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException("No token provided");
        }

        try {
            const decoded = await admin.auth().verifyIdToken(token);
            request.user = decoded; // Attach user to request
            return true;
        } catch (error) {
            throw new UnauthorizedException("Invalid token");
        }
    }

    private extractToken(request: any): string | null {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
```

**Usage**:

```typescript
@Controller("api/v1/memory")
@UseGuards(FirebaseAuthGuard)
export class MessagesController {
    // All routes protected
}
```

### 4.2 Dev Login Path

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Document test user credentials
-   [ ] Create script to provision test users
-   [ ] Document local login flow
-   [ ] Add Codespaces-specific login instructions
-   [ ] Ensure Firebase emulators support test auth

**Dev Login Documentation**:

```markdown
## Development Login

### Local Development

1. Start Firebase emulators: `npm run emulators:start`
2. Navigate to http://localhost:9002
3. Use test credentials:
    - Email: student@test.com
    - Password: test123
    - Role: student

### Codespaces

1. Port 9002 is forwarded automatically
2. Use same test credentials as above
3. Firebase emulator UI accessible via forwarded port
```

---

## Phase 5: Production Deployment 🚀

### 5.1 Cloud SQL Setup

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Provision Cloud SQL PostgreSQL instance
-   [ ] Configure connection pooling
-   [ ] Set up SSL certificates
-   [ ] Configure IAM authentication
-   [ ] Run Prisma migrations on Cloud SQL
-   [ ] Test connection from Cloud Run
-   [ ] Set up automated backups
-   [ ] Configure read replicas (if needed)

**Cloud SQL Connection**:

```bash
# Connection string format
DATABASE_URL="postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance"

# Or with IP
DATABASE_URL="postgresql://user:pass@IP:5432/dbname?sslmode=require"
```

### 5.2 mem0.ai Integration

**Status**: 🔄 In Progress (mock implementation exists)

**Tasks**:

-   [ ] Obtain mem0.ai API key
-   [ ] Install mem0.ai SDK: `npm install mem0ai`
-   [ ] Replace mock implementation in [`src/memories/mem0.service.ts`](../../../src/services/memory-service/src/memories/mem0.service.ts)
-   [ ] Test memory synthesis with real API
-   [ ] Handle rate limits and errors
-   [ ] Document API usage and costs

**Real Implementation**:

```typescript
// src/memories/mem0.service.ts
import { MemoryClient } from "mem0ai";

export class Mem0Service {
    private client: MemoryClient;

    constructor() {
        this.client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
    }

    async add(
        messages: string[],
        userId: string,
        metadata?: any
    ): Promise<string[]> {
        const response = await this.client.add(messages, {
            user_id: userId,
            metadata: metadata,
        });
        return response.memories.map((m) => m.id);
    }

    async search(
        query: string,
        userId: string,
        limit: number = 10
    ): Promise<any[]> {
        return await this.client.search(query, {
            user_id: userId,
            limit: limit,
        });
    }

    async getAll(userId: string): Promise<any[]> {
        return await this.client.getAll({ user_id: userId });
    }
}
```

### 5.3 Docker Build & Cloud Run

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Optimize Dockerfile for production
-   [ ] Build and test Docker image locally
-   [ ] Push image to Google Container Registry
-   [ ] Deploy to Cloud Run
-   [ ] Configure environment variables in Cloud Run
-   [ ] Set up custom domain (optional)
-   [ ] Configure auto-scaling (min: 0, max: 10 instances)
-   [ ] Enable Cloud Run logging

**Deployment Commands**:

```bash
# Build image
docker build -t gcr.io/PROJECT_ID/memory-service:latest .

# Push to GCR
docker push gcr.io/PROJECT_ID/memory-service:latest

# Deploy to Cloud Run
gcloud run deploy memory-service \
  --image gcr.io/PROJECT_ID/memory-service:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=xxx,MEM0_API_KEY=xxx

# Or use Firebase App Hosting
firebase deploy --only hosting:memory-service
```

---

## Phase 6: Monitoring & Operations 📊

### 6.1 Health Endpoints

**Status**: ✅ Complete (basic health endpoint exists)

**Enhancement Tasks**:

-   [ ] Expand health endpoint to include:
    -   Database connection status
    -   mem0.ai API status
    -   Memory usage
    -   Request rate metrics
-   [ ] Add `/health/ready` for readiness checks
-   [ ] Add `/health/live` for liveness checks
-   [ ] Document health check usage

**Enhanced Health Response**:

```json
{
    "status": "healthy",
    "timestamp": "2026-01-13T14:00:00Z",
    "uptime": 3600,
    "checks": {
        "database": {
            "status": "up",
            "latency_ms": 5
        },
        "mem0": {
            "status": "up",
            "latency_ms": 150
        }
    },
    "resources": {
        "memory_mb": 128,
        "cpu_percent": 15
    }
}
```

### 6.2 Logging & Monitoring

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Configure structured logging with Winston/Pino
-   [ ] Set up log levels (DEBUG, INFO, WARN, ERROR)
-   [ ] Integrate with Cloud Logging
-   [ ] Create log-based metrics:
    -   Request count by endpoint
    -   Error rate
    -   Average response time
-   [ ] Set up alerting rules:
    -   Error rate >5%
    -   API latency p95 >500ms
    -   Database connection failures

**Logging Example**:

```typescript
// src/common/logger/logger.service.ts
import { Injectable, LoggerService } from "@nestjs/common";
import * as winston from "winston";

@Injectable()
export class AppLogger implements LoggerService {
    private logger: winston.Logger;

    constructor() {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || "info",
            format: winston.format.json(),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: "error.log",
                    level: "error",
                }),
                new winston.transports.File({ filename: "combined.log" }),
            ],
        });
    }

    log(message: string, context?: string) {
        this.logger.info(message, { context });
    }

    error(message: string, trace?: string, context?: string) {
        this.logger.error(message, { trace, context });
    }

    warn(message: string, context?: string) {
        this.logger.warn(message, { context });
    }

    debug(message: string, context?: string) {
        this.logger.debug(message, { context });
    }
}
```

### 6.3 Admin Dashboard (Stretch)

**Status**: ⏳ Pending (Optional)

**Tasks**:

-   [ ] Create simple admin UI at `/admin`
-   [ ] Display service health metrics
-   [ ] Show recent errors
-   [ ] Display active connections
-   [ ] Add basic query interface for troubleshooting

---

## Phase 7: CI/CD Pipeline 🔄

### 7.1 GitHub Actions

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Create `.github/workflows/memory-service.yml`
-   [ ] Set up CI jobs:
    -   Lint (ESLint)
    -   Type check (TypeScript)
    -   Unit tests
    -   E2E tests
    -   Build Docker image
-   [ ] Set up CD jobs:
    -   Deploy to staging on merge to main
    -   Deploy to production on release tag
-   [ ] Configure GitHub Secrets

**Workflow Example**:

```yaml
# .github/workflows/memory-service.yml
name: Memory Service CI/CD

on:
    push:
        branches: [main]
        paths:
            - "src/services/memory-service/**"
    pull_request:
        paths:
            - "src/services/memory-service/**"

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: "18"
            - name: Install dependencies
              run: cd src/services/memory-service && npm ci
            - name: Lint
              run: cd src/services/memory-service && npm run lint
            - name: Type check
              run: cd src/services/memory-service && npm run typecheck
            - name: Unit tests
              run: cd src/services/memory-service && npm test
            - name: E2E tests
              run: cd src/services/memory-service && npm run test:e2e
              env:
                  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

    deploy-staging:
        needs: test
        if: github.ref == 'refs/heads/main'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Deploy to Cloud Run (Staging)
              uses: google-github-actions/deploy-cloudrun@v1
              with:
                  service: memory-service-staging
                  region: us-central1
                  image: gcr.io/${{ secrets.GCP_PROJECT_ID }}/memory-service:${{ github.sha }}
```

---

## Phase 8: Cleanup & Polish ✨

### 8.1 Code Cleanup

**Status**: 🔄 In Progress

**Tasks**:

-   [ ] Remove unused imports and files
-   [ ] Remove AI-generated comments/TODOs
-   [ ] Ensure consistent code style
-   [ ] Run ESLint with --fix
-   [ ] Update all documentation
-   [ ] Remove debug console.logs

**Cleanup Script**:

```bash
cd src/services/memory-service

# Lint and fix
npm run lint -- --fix

# Remove unused files
# (manual inspection needed)

# Check for TODOs
rg "TODO|FIXME" src/

# Format code
npm run format
```

### 8.2 Documentation Review

**Status**: 🔄 In Progress

**Tasks**:

-   [ ] Review and update [`README.md`](../../../src/services/memory-service/README.md)
-   [ ] Ensure all API endpoints documented
-   [ ] Add troubleshooting guide
-   [ ] Add FAQ section
-   [ ] Create quickstart video/GIF (optional)
-   [ ] Update environment variable list

---

## Phase 9: Performance & Optimization 🚀

### 9.1 Load Testing

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Set up load testing with k6 or Artillery
-   [ ] Test scenarios:
    -   100 concurrent users sending messages
    -   High pagination load
    -   Memory synthesis under load
-   [ ] Measure and document:
    -   p50, p95, p99 latencies
    -   Throughput (requests/second)
    -   Error rate under load
-   [ ] Identify bottlenecks
-   [ ] Optimize slow queries

**Load Test Script (k6)**:

```javascript
// load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
    stages: [
        { duration: "2m", target: 100 }, // Ramp up to 100 users
        { duration: "5m", target: 100 }, // Stay at 100 users
        { duration: "2m", target: 0 }, // Ramp down
    ],
};

export default function () {
    const payload = JSON.stringify({
        chatID: "test-chat",
        content: "Hello, AI!",
        sender: "user",
    });

    const params = {
        headers: {
            "Content-Type": "application/json",
        },
    };

    let res = http.post(
        "http://localhost:3001/api/v1/memory/messages",
        payload,
        params
    );
    check(res, {
        "status is 201": (r) => r.status === 201,
        "response time < 500ms": (r) => r.timings.duration < 500,
    });

    sleep(1);
}
```

### 9.2 Caching Layer (Future)

**Status**: ⏳ Pending (Post-MVP)

**Tasks**:

-   [ ] Evaluate caching needs based on load test results
-   [ ] Set up Redis instance
-   [ ] Cache conversation metadata (5-minute TTL)
-   [ ] Implement cache invalidation on new messages
-   [ ] Measure cache hit rate
-   [ ] Document caching strategy

---

## Phase 10: Project Report 📝

### 10.1 Individual Reflections

**Status**: ⏳ Pending

**Tasks**:

-   [ ] Each team member writes reflection:
    -   What you built (specific contributions)
    -   How AI helped (tools used, prompts that worked)
    -   How AI hurt (mistakes, wrong suggestions)
    -   Lessons learned
    -   Time saved vs. time debugging AI suggestions
-   [ ] Add reflections to `docs/reports/` directory
-   [ ] Include in final PR

**Report Template**:

```markdown
# Memory Service - Personal Report

**Name**: [Your Name]
**Date**: 2026-01-21
**Role**: [Backend/Frontend/Testing/Documentation]

## What I Built

-   Implemented [specific feature]
-   Wrote [tests/docs/etc]
-   Fixed [bugs/issues]

## AI Tools Used

-   GitHub Copilot: [usage notes]
-   ChatGPT: [usage notes]
-   Claude: [usage notes]

## AI Wins

1. [Example where AI saved time]
2. [Example of good suggestion]

## AI Challenges

1. [Example of misleading suggestion]
2. [Time spent debugging AI code]

## Lessons Learned

-   [Lesson 1]
-   [Lesson 2]

## Statistics

-   Lines of code written: ~X
-   Tests written: ~X
-   Time with AI: ~X hours
-   Time debugging AI: ~X hours
-   Net time saved: ~X hours
```

---

## Milestone Checklist

### Sprint 1: Core Setup ✅

-   [x] NestJS project initialized
-   [x] PostgreSQL + Prisma configured
-   [x] Docker Compose setup
-   [x] Basic API endpoints
-   [x] Initial tests

### Sprint 2: OpenSpec & Integration 🔄

-   [x] OpenSpec spec.md
-   [x] OpenSpec design.md
-   [x] OpenSpec plan.md
-   [ ] Integration documentation
-   [ ] Architecture diagrams

### Sprint 3: Testing & Quality 🔄

-   [ ] Expand backend tests (>80% coverage)
-   [ ] Add frontend tests
-   [ ] E2E tests for Memory flows
-   [ ] Code cleanup ("no slop")

### Sprint 4: Auth & Security ⏳

-   [ ] Firebase Auth middleware
-   [ ] Authorization checks
-   [ ] Dev login documentation
-   [ ] Security audit

### Sprint 5: Deployment ⏳

-   [ ] Cloud SQL setup
-   [ ] Real mem0.ai integration
-   [ ] Cloud Run deployment
-   [ ] Health monitoring
-   [ ] CI/CD pipeline

### Sprint 6: Launch Preparation ⏳

-   [ ] Load testing
-   [ ] Performance optimization
-   [ ] Documentation review
-   [ ] Demo preparation
-   [ ] Project reports

---

## Timeline

| Phase            | Duration | Target Date   |
| ---------------- | -------- | ------------- |
| OpenSpec & Docs  | 1 day    | Jan 13 ✅     |
| Integration Docs | 1 day    | Jan 14        |
| Test Expansion   | 2 days   | Jan 16        |
| Auth & Security  | 2 days   | Jan 18        |
| Deployment       | 2 days   | Jan 20        |
| Final Polish     | 1 day    | Jan 21        |
| **PR Ready**     | **-**    | **Jan 21** 🎯 |
| Demo (Optional)  | -        | Jan 22        |
| Grades Submitted | -        | Jan 25        |

---

## Success Criteria

### Functional

-   [x] All 5 API endpoints working
-   [ ] > 80% test coverage (backend)
-   [ ] > 70% test coverage (frontend)
-   [ ] E2E tests passing
-   [ ] Health endpoints operational

### Quality

-   [ ] No ESLint errors
-   [ ] TypeScript strict mode passes
-   [ ] No "slop" (unused code, AI comments)
-   [ ] Documentation complete
-   [ ] Code review ready

### Operational

-   [ ] Runnable in Codespaces
-   [ ] Clear setup instructions (<10 minutes)
-   [ ] Test user login works
-   [ ] Demo-ready
-   [ ] Monitoring configured

---

## Risk Management

| Risk               | Impact | Mitigation                        | Status         |
| ------------------ | ------ | --------------------------------- | -------------- |
| mem0.ai API issues | High   | Mock implementation ready         | ✅ Mitigated   |
| Cloud SQL cost     | Medium | Use free tier, document costs     | 🔄 Monitoring  |
| Testing gaps       | High   | Prioritize E2E, then unit         | 🔄 In Progress |
| Auth complexity    | Medium | Use Firebase examples, test early | ⏳ Planned     |
| Time constraint    | High   | Focus on MVP, defer stretch goals | 🔄 Managing    |

---

## Communication Plan

### Daily Standups (15 min)

-   What did you complete yesterday?
-   What will you do today?
-   Any blockers?

### Integration Points (2x per week)

-   Sync with Socratic Chat team on API contract
-   Sync with Frontend team on component needs
-   Sync with DevOps on deployment requirements

### Code Review Standards

-   All PRs require 1 approval
-   Tests must pass
-   Documentation updated
-   No TODOs in final PR

---

## Resources

### Documentation

-   [NestJS Docs](https://docs.nestjs.com/)
-   [Prisma Guides](https://www.prisma.io/docs/guides)
-   [mem0.ai API Reference](https://docs.mem0.ai/)
-   [Firebase Auth](https://firebase.google.com/docs/auth)
-   [Cloud Run](https://cloud.google.com/run/docs)

### Tools

-   [Postman Collection](./postman-collection.json) (to be created)
-   [k6 Load Tests](./load-tests/) (to be created)
-   [Docker Compose](../../../src/services/memory-service/docker-compose.yml)

### Team

-   Backend Lead: [Name]
-   Frontend Lead: [Name]
-   Testing Lead: [Name]
-   Docs/DevOps Lead: [Name]

---

## Appendix: Quick Commands

```bash
# Development
cd src/services/memory-service
pnpm install
docker-compose up -d
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev

# Testing
pnpm test                    # Unit tests
pnpm test:e2e               # E2E tests
pnpm test:cov               # Coverage report

# Linting & Type Checking
pnpm lint                    # ESLint
pnpm lint --fix             # Auto-fix
pnpm typecheck              # TypeScript

# Deployment
docker build -t memory-service .
docker run -p 3001:3001 memory-service

# Database
pnpm prisma:studio          # Open Prisma Studio
pnpm prisma:migrate:create  # Create migration
pnpm prisma:migrate:deploy  # Apply migrations

# Access
http://localhost:3001/api/docs    # Swagger UI
http://localhost:3001/health      # Health check
```

---

## Notes

-   **This plan is a living document**: Update as priorities change
-   **Focus on MVP first**: Stretch goals only after core is complete
-   **Document as you go**: Don't leave docs for the end
-   **Test early, test often**: Catch issues before integration
-   **Communicate blockers**: Don't wait until standups

**Last Updated**: 2026-01-13
**Status**: OpenSpec documentation complete, proceeding to integration phase
