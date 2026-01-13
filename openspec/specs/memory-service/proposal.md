# Memory Service Proposal

## Overview

The Memory Service is a microservice that provides persistent conversational memory for students in the CourseWise educational platform. It enables AI-powered personalized learning by storing conversation history and synthesizing meaningful memories about student interactions, learning patterns, and preferences.

**Status**: ✅ Implementation Complete (MVP)  
**Location**: [`src/services/memory-service/`](../../../src/services/memory-service/)  
**Documentation**: This OpenSpec formalizes the already-implemented service

---

## Why

### Problem Statement

The CourseWise platform provides AI-powered Socratic tutoring via Google Genkit, but currently lacks persistent memory across sessions. This creates several problems:

1. **No Context Continuity**: Each conversation starts from scratch, forcing students to re-explain their background, learning preferences, and previous struggles
2. **Lost Learning Insights**: Valuable information about student comprehension, learning style, and knowledge gaps is discarded after each session
3. **Inefficient Tutoring**: The AI cannot build on previous interactions or adapt its teaching style based on what worked before
4. **Poor User Experience**: Students expect modern AI systems to remember them, similar to ChatGPT and other conversational AI platforms

### Business Value

-   **Personalized Learning**: AI tutor adapts to individual student needs based on accumulated knowledge
-   **Improved Retention**: Students more engaged when the system "remembers" them
-   **Better Outcomes**: Targeted interventions based on identified learning patterns
-   **Competitive Advantage**: Memory-enhanced tutoring differentiates CourseWise from basic Q&A systems

### Technical Motivation

-   **Scalability**: Separate microservice can scale independently from main application
-   **Specialization**: Dedicated service optimized for conversation storage and memory synthesis
-   **Flexibility**: Can be integrated with multiple AI agents and learning contexts
-   **Data Ownership**: Centralized control over student conversation data

---

## What

### Core Capabilities

The Memory Service provides five primary operations:

1. **User Registration** (`POST /api/v1/memory/register`)

    - Initialize users in the memory system
    - Idempotent operation for reliable integration

2. **Message Persistence** (`POST /api/v1/memory/messages`)

    - Store student-AI conversations
    - Auto-create conversations on first message
    - Maintain sequential ordering

3. **Conversation Retrieval** (`GET /api/v1/memory/conversations/:chatID`)

    - Paginated message history
    - Newest-first ordering for context loading

4. **User Conversations** (`GET /api/v1/memory/users/:userID/conversations`)

    - List all conversations for a student
    - Metadata for conversation selection UI

5. **Memory Synthesis** (`POST /api/v1/memory/synthesize`)
    - Extract learning insights using mem0.ai
    - Store semantic memories for AI context enhancement

### Data Model

**Student Profile → Memory Relationship**:

```
Student (Firebase Auth)
  └─► User (Memory Service)
       ├─► Conversations (Chats)
       │    └─► Messages
       └─► Synthesized Memories (mem0.ai + PostgreSQL)
```

**Storage Strategy**:

-   **PostgreSQL**: Primary storage for all conversations, messages, and metadata
-   **mem0.ai**: Semantic embeddings for memory synthesis and retrieval
-   **Dual Storage**: Resilient to mem0.ai outages while leveraging vector search capabilities

### Technology Stack

-   **Framework**: NestJS (TypeScript)
-   **Database**: PostgreSQL 15+ with Prisma ORM
-   **Memory Engine**: mem0.ai SDK
-   **API**: RESTful with OpenAPI/Swagger documentation
-   **Development**: Docker Compose for local PostgreSQL
-   **Deployment**: Firebase Cloud Run (planned)

---

## What Changes

### New Components

**Service Architecture**:

-   `src/services/memory-service/` - Standalone NestJS microservice
    -   `src/memories/` - Memory synthesis module
    -   `src/messages/` - Message persistence module
    -   `src/chats/` - Conversation retrieval module
    -   `src/users/` - User registration module
    -   `src/database/` - Prisma client service
    -   `src/health/` - Health monitoring endpoints

**Database Schema**:

-   `users` table - User profiles with role information
-   `chats` table - Conversation metadata with user relationships
-   `messages` table - Individual messages with sequential ordering
-   `memories` table - Synthesized memory metadata

**API Endpoints**:

-   5 RESTful endpoints under `/api/v1/memory/`
-   Interactive Swagger documentation at `/api/docs`
-   Health monitoring at `/health`

### Integration Points

**Upstream Dependencies**:

-   **Chat Management Service** (Primary Consumer) - The ONLY service that calls Memory Service
    -   Registers users when they first interact with chat
    -   Saves messages from chat sessions
    -   Retrieves conversation history for AI context
    -   Triggers memory synthesis as needed

**Downstream Dependencies**:

-   PostgreSQL database (local: Docker, production: Cloud SQL)
-   mem0.ai API (for memory synthesis)

**Network Architecture**:

-   **Internal Service Only**: Not exposed to frontend or external clients
-   **Network Isolated**: Only accessible by Chat Management Service
-   **No Authorization Layer**: Service-to-service trust model (network security only)
-   **No Direct User Access**: All user interactions go through Chat Management Service

**Platform Impact**:

-   No breaking changes to existing services
-   Internal backend service for chat management
-   Additive capability that enhances existing chat features
-   Frontend never directly calls Memory Service

---

## Impact

### Affected Specs

This proposal creates a new capability spec:

-   **NEW**: [`openspec/specs/memory-service/spec.md`](./spec.md) - Memory Service requirements and scenarios
-   **NEW**: [`openspec/specs/memory-service/design.md`](./design.md) - Technical decisions and architecture
-   **NEW**: [`openspec/specs/memory-service/plan.md`](./plan.md) - Implementation roadmap and timeline

### Affected Code

**New Files** (~50+ files):

-   Complete NestJS application structure
-   Prisma schema and migrations
-   NestJS modules (Users, Messages, Chats, Memories)
-   Docker Compose configuration
-   Test infrastructure (Jest, E2E)
-   Documentation (README, IMPLEMENTATION)

**Modified Files**:

-   None (service is fully isolated)

**Integration Required**:

-   Chat Management Service needs to integrate Memory API calls (future work)
-   Network configuration to restrict access to internal services only

### Migration Strategy

**Phase 1: Standalone Operation** ✅ (Current)

-   Memory Service runs independently
-   Can be tested in isolation via direct API calls
-   No impact on existing platform

**Phase 2: Integration** (Next)

-   Chat Management Service integrates with Memory Service
-   Network isolation configured (VPC/firewall rules)
-   Service-to-service communication established

**Phase 3: Enhancement** (Future)

-   Deploy to production Cloud Run with VPC connector
-   Enable real mem0.ai synthesis
-   Add caching layer (Redis) if needed
-   Monitoring and alerting

**Rollback Plan**:

-   Service is additive only - can be disabled without affecting core platform
-   No data migration needed (new database)
-   Easy to revert by not calling Memory API endpoints

---

## Success Metrics

### Technical KPIs

-   ✅ All 5 API endpoints implemented and tested
-   ✅ OpenAPI documentation auto-generated
-   ✅ Database schema with proper indexes and constraints
-   ✅ Error handling with appropriate HTTP status codes
-   ✅ Docker-based local development environment
-   🎯 >80% test coverage (in progress)
-   🎯 <200ms p95 latency for read operations (to be measured)
-   🎯 Health monitoring operational (basic endpoint exists)

### Business KPIs

-   📊 Conversation continuity across sessions (measurable after integration)
-   📊 Improved student engagement metrics (measurable after integration)
-   📊 Relevant memory synthesis quality (requires user feedback)
-   📊 AI tutor provides context-aware responses (after integration)

### Operational KPIs

-   ✅ Runnable in GitHub Codespaces for PR review
-   ✅ Clear setup documentation (<10 minutes to run)
-   🎯 Production deployment to Cloud Run (planned)
-   🎯 CI/CD pipeline with automated tests (planned)
-   🎯 Monitoring and alerting configured (planned)

---

## Risks & Mitigations

### Risk 1: mem0.ai Service Availability

**Impact**: Memory synthesis fails  
**Likelihood**: Medium  
**Mitigation**:

-   Mock implementation for development
-   Graceful degradation (service continues without synthesis)
-   PostgreSQL stores all data regardless of mem0.ai status
    **Status**: ✅ Mitigated with mock service

### Risk 2: Database Performance

**Impact**: Slow queries affect API latency  
**Likelihood**: Low (with proper indexing)  
**Mitigation**:

-   Database indexes on foreign keys and query columns
-   Connection pooling configured
-   Pagination to limit result sets
    **Status**: ✅ Indexes in place

### Risk 3: Integration Complexity

**Impact**: Difficult to integrate with existing services  
**Likelihood**: Medium  
**Mitigation**:

-   RESTful API with standard patterns
-   OpenAPI documentation for client generation
-   Clear examples in documentation
    **Status**: ✅ Well-documented API

### Risk 4: Data Privacy

**Impact**: Potential cross-user data leakage
**Likelihood**: Very Low (internal service only)
**Mitigation**:

-   All queries filtered by userID
-   Foreign key constraints enforce relationships
-   Network isolation: Only Chat Management Service can call endpoints
-   Chat Management Service responsible for authorization before calling Memory Service
    **Status**: ✅ Queries filtered, network isolation planned

### Risk 5: Cost Overruns

**Impact**: Unexpected Cloud SQL or mem0.ai costs  
**Likelihood**: Low (for MVP scale)  
**Mitigation**:

-   Start with minimal Cloud SQL instance
-   Monitor mem0.ai API usage
-   Document cost projections
    **Status**: 📊 Monitoring planned

---

## Dependencies

### External Dependencies

| Dependency    | Purpose             | Version   | Status            |
| ------------- | ------------------- | --------- | ----------------- |
| PostgreSQL    | Primary data store  | 15+       | ✅ Docker Compose |
| mem0.ai       | Memory synthesis    | Latest    | 🔄 Mock impl      |
| Firebase Auth | User authentication | Admin SDK | 🎯 Planned        |
| Node.js       | Runtime             | 18+       | ✅ Configured     |
| NestJS        | Framework           | 10+       | ✅ Installed      |
| Prisma        | ORM                 | 5+        | ✅ Configured     |

### Internal Dependencies

| Service                 | Integration Point                 | Status     |
| ----------------------- | --------------------------------- | ---------- |
| Chat Management Service | Primary consumer of Memory API    | 🎯 Planned |
| Firebase Authentication | userID passed via Chat Management | ✅ Via CMS |

### Infrastructure Dependencies

| Resource           | Purpose             | Status     |
| ------------------ | ------------------- | ---------- |
| Cloud SQL          | Production database | 🎯 Planned |
| Cloud Run          | Service hosting     | 🎯 Planned |
| Secret Manager     | API keys            | 🎯 Planned |
| Container Registry | Docker images       | 🎯 Planned |

---

## Constraints

### Technical Constraints

1. **Codespaces Requirement**: Must be fully runnable in GitHub Codespaces for PR review
2. **Firebase Ecosystem**: Must integrate with existing Firebase Auth and Firestore
3. **TypeScript**: Consistent with platform's TypeScript-first approach
4. **Budget**: Free tier considerations for Cloud SQL and mem0.ai

### Quality Constraints

1. **Privacy**: Strict user data isolation (GDPR compliance)
2. **Consistency**: ACID transactions for message ordering
3. **Performance**: Acceptable latency for AI context loading
4. **Reliability**: Resilient to external service failures

### Timeline Constraints

1. **Demo Readiness**: Next week (January 22, 2026)
2. **PR Review**: January 21, 2026
3. **Grades Submitted**: January 25, 2026

---

## Alternatives Considered

### Alternative 1: Firestore for Storage

**Rejected**:

-   Weak querying capabilities
-   Expensive pagination
-   Complex transaction model for sequential ordering
-   Prefer relational model for conversation hierarchies

### Alternative 2: Integrate into Next.js API Routes

**Rejected**:

-   Couples memory logic with frontend
-   Limited architectural patterns
-   Harder to scale independently
-   Difficult to test in isolation

### Alternative 3: Firebase Cloud Functions

**Rejected**:

-   Cold start latency issues
-   Limited control over dependencies
-   Deployment complexity for complex services
-   Prefer long-running service for connections

### Alternative 4: Monolithic Approach (No Microservice)

**Rejected**:

-   Memory logic complex enough to warrant separation
-   Independent scaling requirements
-   Different technology needs (PostgreSQL vs. Firestore)
-   Clearer boundaries with microservice

---

## Open Questions

1. **Network Isolation**: How should VPC/firewall rules be configured?

    - **Proposed**: Chat Management Service can reach Memory Service, deny all other traffic
    - **Decision Needed**: Before production deployment

2. **Caching Strategy**: Is Redis necessary for MVP?

    - **Proposed**: No, add after measuring production load
    - **Decision Needed**: After load testing

3. **Data Retention**: How long should conversations be kept?

    - **Proposed**: 1 year active, then archive
    - **Decision Needed**: Requires stakeholder input

4. **Memory Synthesis Trigger**: Who decides when to synthesize?

    - **Current**: Chat Management Service triggers synthesis
    - **Future**: Consider event-driven triggers

5. **Service Discovery**: How will Chat Management Service locate Memory Service?
    - **Proposed**: Environment variable with internal service URL
    - **Decision Needed**: By January 16

---

## Approval Criteria

### Must Have (MVP)

-   ✅ All 5 API endpoints functional
-   ✅ Database schema with migrations
-   ✅ OpenAPI documentation
-   ✅ Docker Compose for local dev
-   ✅ Basic error handling
-   ✅ README with setup instructions
-   🎯 >80% test coverage (in progress)
-   🎯 OpenSpec documentation (this proposal)

### Should Have (Before Production)

-   🎯 Network isolation (VPC/firewall configuration)
-   🎯 Cloud SQL deployment
-   🎯 Real mem0.ai integration
-   🎯 CI/CD pipeline
-   🎯 Monitoring and alerting

### Nice to Have (Future)

-   Redis caching layer
-   Admin dashboard
-   Advanced analytics
-   Multi-language support

---

## Timeline

| Milestone                 | Target Date | Status         |
| ------------------------- | ----------- | -------------- |
| Core Implementation       | Jan 10      | ✅ Complete    |
| OpenSpec Documentation    | Jan 13      | ✅ Complete    |
| Integration Documentation | Jan 14      | 🎯 Planned     |
| Test Expansion            | Jan 16      | 🔄 In Progress |
| Auth & Security           | Jan 18      | 🎯 Planned     |
| Deployment Prep           | Jan 20      | 🎯 Planned     |
| **PR Ready**              | **Jan 21**  | **🎯 Target**  |
| Demo (Optional)           | Jan 22      | 🎯 Optional    |
| Grades Submitted          | Jan 25      | 🎯 Deadline    |

---

## Next Steps

### Immediate (This Week)

1. ✅ Complete OpenSpec artifacts (spec.md, design.md, plan.md, proposal.md)
2. 🔄 Update top-level integration documentation
3. 🔄 Expand test coverage to >80%
4. 🔄 Clean up code ("no slop")

### Short-term (Next Week)

1. 🎯 Configure network isolation for internal-only access
2. 🎯 Integrate with Chat Management Service
3. 🎯 Prepare demo environment
4. 🎯 Write project reports

### Long-term (Post-Review)

1. 🎯 Deploy to production Cloud Run with VPC connector
2. 🎯 Finalize Chat Management Service integration
3. 🎯 Add monitoring and alerting
4. 🎯 Implement caching layer if performance requires

---

## Related Documents

-   **Requirements**: [`spec.md`](./spec.md) - Formal specification with scenarios
-   **Architecture**: [`design.md`](./design.md) - Technical decisions and patterns
-   **Implementation**: [`plan.md`](./plan.md) - Detailed implementation roadmap
-   **Product Requirements**: [`docs/PRD-MemoryService.md`](../../../docs/PRD-MemoryService.md)
-   **Implementation Summary**: [`docs/MEMORY_SERVICE_SUMMARY.md`](../../../docs/MEMORY_SERVICE_SUMMARY.md)
-   **Service README**: [`src/services/memory-service/README.md`](../../../src/services/memory-service/README.md)

---

## Stakeholder Sign-off

| Stakeholder      | Role                | Status      | Date   |
| ---------------- | ------------------- | ----------- | ------ |
| Development Team | Implementation      | ✅ Complete | Jan 10 |
| Technical Lead   | Architecture Review | 🔄 Pending  | TBD    |
| Product Owner    | Requirements        | 🔄 Pending  | TBD    |
| Operations       | Deployment          | 🎯 Planned  | Jan 20 |

---

**Proposal Status**: ✅ **Complete and Ready for Review**  
**Implementation Status**: ✅ **MVP Functional**  
**Documentation Status**: ✅ **OpenSpec Complete**  
**Next Milestone**: Integration & Testing (Jan 14-16)
