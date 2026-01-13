# Memory Service OpenSpec Documentation

## Overview

This directory contains the complete OpenSpec documentation for the Memory Service, a critical microservice in the CourseWise platform that provides persistent conversational memory for AI-powered learning experiences.

**Service Type**: Internal Backend Microservice  
**Primary Consumer**: Chat Management Service (only)  
**Technology**: NestJS, PostgreSQL, mem0.ai  
**Status**: ✅ MVP Implementation Complete

---

## Document Structure

### 📋 [proposal.md](./proposal.md)

**Purpose**: High-level proposal explaining why, what, and impact

**Contents**:

-   Problem statement and business value
-   Core capabilities and data model
-   Integration architecture (internal service only)
-   Success metrics and risk mitigation
-   Timeline and approval criteria

**Key Insight**: Memory Service is network-isolated and only accessible by Chat Management Service - no direct frontend or external access.

### 📐 [spec.md](./spec.md)

**Purpose**: Formal requirements and behavioral specifications

**Contents**:

-   13 detailed requirements with scenarios
-   API endpoint specifications
-   Data model (PostgreSQL schema)
-   Quality constraints (privacy, consistency, performance)
-   Integration points and assumptions

**Key Features**:

-   User registration (idempotent)
-   Message persistence with auto-conversation creation
-   Paginated conversation retrieval
-   Memory synthesis with mem0.ai
-   Strict data isolation by userID

### 🏗️ [design.md](./design.md)

**Purpose**: Technical decisions and architecture rationale

**Contents**:

-   12 major technical decisions with trade-offs
-   Architecture diagrams and data flows
-   Security model (network-based, no auth middleware needed)
-   Performance optimization strategies
-   Migration and deployment plans

**Key Decisions**:

-   Standalone NestJS microservice (not Next.js API routes)
-   PostgreSQL primary storage + mem0.ai for semantics
-   Internal-only service with network isolation
-   No Firebase Auth middleware (trusted service-to-service)

### 📅 [plan.md](./plan.md)

**Purpose**: Implementation roadmap and task tracking

**Contents**:

-   10 implementation phases from setup to production
-   Detailed task checklists with status tracking
-   Testing strategy (unit, E2E, load tests)
-   CI/CD pipeline configuration
-   Timeline with milestones

**Current Status**:

-   ✅ Phase 1-2: Core implementation and OpenSpec docs complete
-   🔄 Phase 3: Test expansion in progress
-   🎯 Phase 4-6: Integration, deployment, and polish planned

---

## Quick Reference

### Service Architecture

```
Chat Management Service (ONLY Consumer)
           │
           │ HTTP/REST
           ▼
    Memory Service (NestJS)
           │
           ├─► PostgreSQL (conversations, messages)
           └─► mem0.ai (memory synthesis)
```

### API Endpoints

All endpoints under `/api/v1/memory/`:

| Method | Endpoint                       | Purpose                                       |
| ------ | ------------------------------ | --------------------------------------------- |
| POST   | `/register`                    | Initialize user in memory system              |
| POST   | `/messages`                    | Save message (creates conversation if needed) |
| GET    | `/conversations/:chatID`       | Retrieve paginated messages                   |
| GET    | `/users/:userID/conversations` | List user's conversations                     |
| POST   | `/synthesize`                  | Generate memories with mem0.ai                |

### Security Model

**Network Isolation**:

-   ✅ Internal service only (not exposed to internet)
-   ✅ Only Chat Management Service can reach endpoints
-   ✅ VPC/firewall rules enforce isolation
-   ✅ No authentication middleware needed (service-to-service trust)

**Data Protection**:

-   All queries filtered by `userID`
-   PostgreSQL foreign keys enforce relationships
-   Chat Management Service handles user authorization
-   Network security prevents unauthorized access

---

## Key Constraints

### Operational

1. **Internal Only**: Never exposed to frontend or external clients
2. **Single Consumer**: Chat Management Service is the only caller
3. **Network Isolated**: Accessible only within private network/VPC
4. **No Auth Layer**: Relies on network security, not application auth

### Quality

1. **Privacy**: Strict `userID` filtering on all queries
2. **Consistency**: ACID transactions for message ordering
3. **Performance**: <200ms p95 latency for reads (target)
4. **Availability**: Graceful degradation if mem0.ai unavailable

### Development

1. **Codespaces Ready**: Must run in GitHub Codespaces for review
2. **Docker Compose**: Local PostgreSQL via containers
3. **Test Coverage**: >80% target for backend tests
4. **Documentation**: Complete API docs via Swagger

---

## Implementation Status

### ✅ Complete

-   NestJS application structure
-   PostgreSQL schema with Prisma ORM
-   All 5 API endpoints functional
-   Docker Compose for local development
-   Swagger/OpenAPI documentation
-   Basic error handling and validation
-   OpenSpec documentation (this directory)

### 🔄 In Progress

-   Test coverage expansion (currently ~60%, target >80%)
-   Integration documentation
-   Code cleanup ("no slop")

### 🎯 Planned

-   Chat Management Service integration
-   Network isolation configuration
-   Production Cloud Run deployment
-   Real mem0.ai SDK integration
-   CI/CD pipeline with automated tests
-   Monitoring and alerting

---

## Integration Guide

### For Chat Management Service Team

**Service Discovery**:

```typescript
// Environment variable
const MEMORY_SERVICE_URL =
    process.env.MEMORY_SERVICE_URL || "http://localhost:3001";
```

**Example Usage**:

```typescript
import axios from "axios";

// 1. Register user on first chat interaction
await axios.post(`${MEMORY_SERVICE_URL}/api/v1/memory/register`, {
    userID: "user-123",
    name: "John Doe",
    role: "student",
});

// 2. Save message from chat
const response = await axios.post(
    `${MEMORY_SERVICE_URL}/api/v1/memory/messages`,
    {
        chatID: null, // auto-creates conversation
        userID: "user-123",
        content: "What is recursion?",
        sender: "user",
        metadata: { courseID: "cs101", topicID: "algorithms" },
    }
);
const { chatID, messageID } = response.data;

// 3. Retrieve conversation history for AI context
const history = await axios.get(
    `${MEMORY_SERVICE_URL}/api/v1/memory/conversations/${chatID}?page=1&pageSize=20`
);
const messages = history.data.messages;

// 4. Trigger memory synthesis (optional, as needed)
await axios.post(`${MEMORY_SERVICE_URL}/api/v1/memory/synthesize`, {
    chatID: chatID,
    query: "learning preferences",
});
```

---

## Testing

### Local Development

```bash
cd src/services/memory-service

# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose up -d

# Run migrations
pnpm prisma:generate
pnpm prisma:migrate

# Start service
pnpm start:dev

# Access Swagger docs
open http://localhost:3001/api/docs
```

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:cov
```

---

## Related Documentation

### Service Documentation

-   **Implementation Summary**: [`docs/MEMORY_SERVICE_SUMMARY.md`](../../../docs/MEMORY_SERVICE_SUMMARY.md)
-   **Product Requirements**: [`docs/PRD-MemoryService.md`](../../../docs/PRD-MemoryService.md)
-   **Service README**: [`src/services/memory-service/README.md`](../../../src/services/memory-service/README.md)
-   **Setup Guide**: [`src/services/memory-service/doc/LOCAL_SETUP.md`](../../../src/services/memory-service/doc/LOCAL_SETUP.md)

### Platform Documentation

-   **Project Context**: [`openspec/project.md`](../../project.md)
-   **OpenSpec Guidelines**: [`openspec/AGENTS.md`](../../AGENTS.md)
-   **Blueprint**: [`docs/blueprint.md`](../../../docs/blueprint.md)

---

## Validation Checklist

✅ All requirements have at least one scenario  
✅ Scenarios use proper `#### Scenario:` format  
✅ Data model fully documented  
✅ API endpoints specified with examples  
✅ Integration points clearly defined  
✅ Security model explained (network isolation)  
✅ Quality constraints documented  
✅ Implementation plan with timeline  
✅ Risk mitigation strategies included

---

## Contact & Ownership

**Service Owner**: Memory Service Team  
**Primary Consumer**: Chat Management Service Team  
**Documentation**: This OpenSpec directory  
**Issue Tracker**: GitHub Issues (tag: memory-service)

---

## Changelog

| Date       | Version | Changes                                                            |
| ---------- | ------- | ------------------------------------------------------------------ |
| 2026-01-13 | 1.0     | Initial OpenSpec documentation created                             |
| 2026-01-13 | 1.1     | Updated to reflect internal-only architecture (no frontend access) |

---

**Last Updated**: 2026-01-13  
**Status**: ✅ Documentation Complete, ✅ MVP Implementation Complete  
**Next Milestone**: Integration with Chat Management Service
