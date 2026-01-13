# Memory Service Design Document

## Context

The Memory Service is a critical component of the CourseWise platform that enables personalized learning through persistent conversational memory. It must integrate with the existing Next.js/Firebase architecture while operating as an independent microservice capable of handling conversation storage, retrieval, and AI-powered memory synthesis.

**Background:**

-   CourseWise uses Next.js 15 with Firebase for authentication and Firestore for data
-   AI tutoring via Google Genkit requires conversation context across sessions
-   Students need personalized learning experiences based on past interactions
-   The platform has role-based access (students, teachers, admins)

**Constraints:**

-   Must be runnable in GitHub Codespaces for PR review
-   Must integrate with Firebase Authentication
-   Limited budget for external services (mem0.ai rate limits)
-   Must handle concurrent access from multiple students
-   Data privacy and GDPR compliance required

**Stakeholders:**

-   Students (primary users consuming memory-enhanced AI tutoring)
-   Teachers (indirect users viewing student progress)
-   AI Socratic Chat Service (primary API consumer)
-   Platform Administrators (monitoring and operations)

---

## Goals / Non-Goals

### Goals

1. **Persistent Conversation Storage**: Store all student-AI conversations reliably
2. **Memory Synthesis**: Extract meaningful learning insights using mem0.ai
3. **Fast Retrieval**: Enable quick context loading for AI tutor (<200ms p95)
4. **Data Isolation**: Ensure strict student data privacy
5. **Scalable Architecture**: Support 100+ concurrent students
6. **Operational Visibility**: Provide health monitoring and debugging capabilities

### Non-Goals

1. Real-time collaborative conversations (students work individually)
2. Rich media storage (text-only for MVP)
3. Advanced analytics dashboard (future enhancement)
4. Message editing/deletion (immutable append-only design)
5. Multi-language NLP (English-only for MVP)
6. Automatic memory management/forgetting (manual/orchestrated only)

---

## Technical Decisions

### Decision 1: Standalone NestJS Microservice

**Choice**: Implement as independent NestJS application in `src/services/memory-service/`

**Rationale**:

-   **Separation of Concerns**: Memory logic is complex enough to warrant isolation
-   **Independent Deployment**: Can be scaled/updated without affecting main Next.js app
-   **Technology Fit**: NestJS provides dependency injection, modular architecture, and TypeScript
-   **Testing**: Easier to test in isolation with dedicated test infrastructure
-   **Firebase Functions Alternative Rejected**: Functions have cold start issues and limited control over dependencies

**Alternatives Considered**:

1. **Next.js API Routes**: Rejected due to coupling with frontend and limited architectural patterns
2. **Express.js**: Rejected in favor of NestJS for better structure and DI container
3. **Firebase Cloud Functions**: Rejected due to cold starts and deployment complexity for complex services

**Trade-offs**:

-   ➕ Clear boundaries, independent scaling
-   ➕ Better suited for microservice patterns
-   ➖ Additional deployment complexity
-   ➖ Requires separate service management

---

### Decision 2: PostgreSQL for Primary Storage

**Choice**: PostgreSQL with Prisma ORM for conversation and message storage

**Rationale**:

-   **Relational Integrity**: Conversations, messages, and users have clear relationships (foreign keys, cascades)
-   **ACID Transactions**: Critical for message ordering and consistency
-   **Efficient Pagination**: Native support for OFFSET/LIMIT with proper indexing
-   **JSONB Support**: Flexible metadata storage while maintaining relational benefits
-   **Prisma Benefits**: Type-safe queries, migrations, excellent DX

**Alternatives Considered**:

1. **Firestore**: Rejected due to weak querying, expensive pagination, and complex transaction model
2. **MongoDB**: Rejected in favor of relational model for conversation hierarchies
3. **Redis Only**: Rejected as primary store due to persistence requirements

**Trade-offs**:

-   ➕ Strong consistency guarantees
-   ➕ Mature ecosystem and tooling
-   ➕ Excellent query performance with indexes
-   ➖ Requires managed PostgreSQL instance
-   ➖ More complex setup than Firestore

---

### Decision 3: Dual Storage with mem0.ai

**Choice**: PostgreSQL stores all data; mem0.ai stores semantic embeddings for memory synthesis

**Rationale**:

-   **PostgreSQL as Source of Truth**: All conversations and messages are reliably stored
-   **mem0.ai for Semantic Search**: Leverages specialized vector DB for memory synthesis
-   **Separation of Concerns**: OLTP (PostgreSQL) vs. Semantic Search (mem0.ai)
-   **Resilience**: Service continues working if mem0.ai is unavailable (synthesis fails gracefully)

**Memory Flow**:

1. Messages saved to PostgreSQL immediately
2. Memory synthesis triggered on-demand (external orchestration)
3. Synthesized memories stored in both PostgreSQL (metadata) and mem0.ai (vectors)
4. Memory retrieval queries mem0.ai with userID filter

**Alternatives Considered**:

1. **mem0.ai Only**: Rejected due to lack of control over data persistence
2. **PostgreSQL with pgvector**: Rejected for MVP to avoid complexity; valid future enhancement
3. **Separate Vector DB (Pinecone, Weaviate)**: Rejected in favor of mem0.ai's higher-level API

**Trade-offs**:

-   ➕ Best tool for each job (relational + vector search)
-   ➕ Resilient to mem0.ai outages
-   ➖ Data synchronization complexity
-   ➖ Additional external dependency

---

### Decision 4: API Versioning with /api/v1/ Prefix

**Choice**: All endpoints prefixed with `/api/v1/memory`

**Rationale**:

-   **Future-Proofing**: Enables breaking changes without affecting existing clients
-   **Clear Expectations**: Clients know they're using a versioned API
-   **Industry Standard**: Follows REST API best practices
-   **Migration Path**: v2 can coexist with v1 during transitions

**Trade-offs**:

-   ➕ Clear versioning strategy
-   ➕ Safe evolution path
-   ➖ Slightly longer URLs
-   ➖ Maintenance of multiple versions (future concern)

---

### Decision 5: Pagination Defaults (page=1, pageSize=20)

**Choice**: Default pagination to newest-first with 20 messages per page

**Rationale**:

-   **User Experience**: Most recent context is most relevant for AI
-   **Performance**: Limiting default results prevents large payloads
-   **Balance**: 20 messages (~5-10 exchanges) provides good context window
-   **Flexibility**: Clients can override defaults via query params

**Alternatives Considered**:

1. **Cursor-based Pagination**: Rejected for MVP due to complexity; considered for future
2. **Larger Default (50)**: Rejected due to payload size and API latency concerns
3. **Oldest-first Default**: Rejected as AI needs recent context more

**Trade-offs**:

-   ➕ Simple implementation
-   ➕ Good default for most use cases
-   ➖ Not optimal for very long conversations
-   ➖ Offset-based pagination can skip items if new messages arrive

---

### Decision 6: Idempotent User Registration

**Choice**: User registration returns success if user already exists

**Rationale**:

-   **Reliability**: Network retries don't cause errors
-   **Simplicity**: Callers don't need to check existence first
-   **Integration**: Firebase Auth sync can be repeated safely

**Implementation**:

```typescript
// Prisma upsert pattern
await prisma.user.upsert({
    where: { user_id: userID },
    update: { name, role, updated_at: new Date() },
    create: { user_id: userID, name, role, user_info: userInfo },
});
```

**Trade-offs**:

-   ➕ Robust to retries and race conditions
-   ➕ Simpler caller logic
-   ➖ Silently updates existing users (acceptable for this use case)

---

### Decision 7: Auto-Generated Conversation Titles

**Choice**: Generate conversation title from first message content (truncated to 100 chars)

**Rationale**:

-   **User Experience**: Descriptive titles help users find conversations
-   **Automation**: No user input required
-   **Simplicity**: Deterministic algorithm, no AI needed
-   **MVP Scope**: Good enough for launch; can enhance with AI summarization later

**Implementation**:

```typescript
const title = firstMessageContent.substring(0, 100).trim();
```

**Alternatives Considered**:

1. **AI-Generated Titles**: Rejected for MVP due to latency and cost
2. **Generic Titles ("Conversation 1")**: Rejected due to poor UX
3. **User-Specified Titles**: Rejected to reduce friction in message flow

**Trade-offs**:

-   ➕ Fast and deterministic
-   ➕ No AI call overhead
-   ➖ May not be semantically optimal
-   ➖ Long messages create awkward titles

---

### Decision 8: Swagger/OpenAPI Documentation

**Choice**: NestJS auto-generated Swagger docs at `/api/docs`

**Rationale**:

-   **Developer Experience**: Interactive playground for API testing
-   **Documentation**: Always up-to-date with code
-   **Code Review**: Reviewers can test endpoints directly in Codespaces
-   **Client Generation**: OpenAPI schema can generate client SDKs

**Trade-offs**:

-   ➕ Zero-effort documentation
-   ➕ Great for development and testing
-   ➖ Should be disabled in production
-   ➖ Exposes API structure (security consideration)

---

### Decision 9: Global Exception Filter

**Choice**: Centralized error handling with consistent HTTP status codes

**Rationale**:

-   **Consistency**: All errors follow same format
-   **Security**: Prevents leaking sensitive details
-   **Debugging**: Structured error responses easier to log

**Error Response Format**:

```json
{
    "statusCode": 404,
    "message": "Chat not found",
    "error": "Not Found",
    "timestamp": "2026-01-13T14:00:00.000Z",
    "path": "/api/v1/memory/conversations/invalid-id"
}
```

**Status Code Mapping**:

-   200: Success
-   201: Resource created
-   400: Validation error
-   404: Resource not found
-   500: Internal server error

**Trade-offs**:

-   ➕ Predictable error handling
-   ➕ Better security (no stack traces in production)
-   ➖ May hide useful debug info (mitigated with logging)

---

### Decision 10: Docker Compose for Local Development

**Choice**: PostgreSQL via Docker Compose for local development

**Rationale**:

-   **Consistency**: Every developer has identical database setup
-   **Simplicity**: One command to start dependencies
-   **Isolation**: No conflicts with system PostgreSQL
-   **CI/CD**: Same setup works in Codespaces

**Configuration**:

```yaml
services:
    postgres:
        image: postgres:15
        environment:
            POSTGRES_DB: memory_service
            POSTGRES_USER: dev
            POSTGRES_PASSWORD: dev
        ports:
            - "5432:5432"
        volumes:
            - postgres_data:/var/lib/postgresql/data
```

**Trade-offs**:

-   ➕ Reproducible development environment
-   ➕ Easy to reset/recreate
-   ➖ Requires Docker Desktop
-   ➖ Different from production (Cloud SQL)

---

### Decision 11: Environment-Based Configuration

**Choice**: All secrets and config via environment variables

**Rationale**:

-   **Security**: No secrets in git
-   **Flexibility**: Different config per environment (dev/staging/prod)
-   **12-Factor App**: Follows industry best practices
-   **Codespaces**: Easy to configure via GitHub Secrets

**Required Variables**:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
MEM0_API_KEY=mem0_xxx
PORT=3001
NODE_ENV=development
```

**Trade-offs**:

-   ➕ Secure and flexible
-   ➕ Standard practice
-   ➖ Requires documentation for setup
-   ➖ Easy to misconfigure

---

### Decision 12: Prisma Migrations for Schema Management

**Choice**: Prisma Migrate for database schema versioning

**Rationale**:

-   **Version Control**: Migrations tracked in git
-   **Reproducibility**: Same schema across all environments
-   **Safety**: Migrations are reviewed before deployment
-   **Rollback**: Migration history enables rollback if needed

**Workflow**:

1. Define schema in `prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name <name>`
3. Apply in production: `npx prisma migrate deploy`

**Trade-offs**:

-   ➕ Reliable schema management
-   ➕ Great DX with Prisma Studio
-   ➖ Learning curve for Prisma-specific patterns
-   ➖ Migration conflicts in team development (rare)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CourseWise Platform                       │
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Next.js    │         │   Firebase   │                  │
│  │   Frontend   │◄────────┤     Auth     │                  │
│  │              │         │              │                  │
│  └──────┬───────┘         └──────────────┘                  │
│         │                                                     │
│         │ HTTP/REST                                          │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │     Memory Service (NestJS)                  │           │
│  │                                               │           │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │           │
│  │  │  Users   │  │ Messages │  │ Memories  │ │           │
│  │  │ Module   │  │  Module  │  │  Module   │ │           │
│  │  └──────────┘  └──────────┘  └───────────┘ │           │
│  │       │              │              │        │           │
│  │       └──────────────┼──────────────┘        │           │
│  │                      │                       │           │
│  │                ┌─────▼──────┐                │           │
│  │                │  Prisma    │                │           │
│  │                │  Service   │                │           │
│  │                └─────┬──────┘                │           │
│  └──────────────────────┼───────────────────────┘           │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────┐       ┌──────────────┐
         │      PostgreSQL             │       │   mem0.ai    │
         │                             │       │   API        │
         │  ┌──────┐  ┌──────────┐   │       │              │
         │  │Users │  │  Chats   │   │       │  (Vector DB) │
         │  └──────┘  └──────────┘   │◄──────┤              │
         │  ┌──────┐  ┌──────────┐   │       │              │
         │  │Msgs  │  │ Memories │   │       │              │
         │  └──────┘  └──────────┘   │       └──────────────┘
         └────────────────────────────┘
```

---

## Data Flow Diagrams

### Flow 1: New User Registration

```
┌──────────┐      ┌────────────┐      ┌────────────┐
│ Firebase ├─────►│   Memory   ├─────►│ PostgreSQL │
│   Auth   │ 1.ID │  Service   │ 2.   │   users    │
└──────────┘      └────────────┘      └────────────┘
                        │
                        ▼
                   [upsert user]
```

### Flow 2: Save Message to New Conversation

```
┌─────────┐      ┌────────────┐      ┌────────────┐
│   AI    ├─────►│   Memory   ├─────►│ PostgreSQL │
│  Chat   │ 1.   │  Service   │ 2.   │            │
└─────────┘ msg  └────┬───────┘      └────────────┘
                      │                     │
                      │               ┌─────▼──────┐
                      │               │ Transaction│
                      │               │ • Insert   │
                      │               │   chat     │
                      │               │ • Insert   │
                      │               │   message  │
                      │               └────────────┘
                      ▼
              [return chatID, msgID]
```

### Flow 3: Memory Synthesis

```
┌────────────┐      ┌────────────┐      ┌─────────────┐
│Orchestrator├─────►│   Memory   ├─────►│  PostgreSQL │
│  Service   │ 1.   │  Service   │ 2.   │             │
└────────────┘ chatID└────┬───────┘ read └─────────────┘
                          │
                          │ 3. messages
                          ▼
                    ┌───────────┐
                    │  mem0.ai  │
                    │    API    │
                    └─────┬─────┘
                          │
                          │ 4. synthesized
                          ▼
                    ┌───────────┐
                    │   Store   │
                    │ • PG mem  │
                    │ • mem0    │
                    └───────────┘
```

---

## Deployment Strategy

### Local Development

1. **Prerequisites**: Node.js 18+, Docker Desktop, pnpm
2. **Setup**:
    ```bash
    cd src/services/memory-service
    pnpm install
    cp .env.example .env
    docker-compose up -d
    pnpm prisma:generate
    pnpm prisma:migrate
    pnpm start:dev
    ```
3. **Access**: http://localhost:3001/api/docs

### GitHub Codespaces

1. **Automatic Setup**: Docker Compose starts automatically
2. **Port Forwarding**: VSCode forwards port 3001
3. **Environment**: Secrets configured in GitHub repo settings
4. **Testing**: All tests runnable in container

### Production (Cloud Run / Firebase Hosting)

1. **Database**: Firebase Cloud SQL (PostgreSQL)
2. **Container**: Docker image built from Dockerfile
3. **Secrets**: Google Secret Manager
4. **Scaling**: Auto-scaling based on CPU/memory
5. **Monitoring**: Cloud Logging, Cloud Monitoring

---

## Security Considerations

### Authentication & Authorization Model

**Internal Service Architecture**:

The Memory Service is an **internal backend service** that does NOT implement authentication or authorization. Instead, it relies on network isolation and service-to-service trust.

**Security Model**:

```
User → Chat Management Service (handles auth/authz) → Memory Service (trusts caller)
```

**Responsibilities**:

-   **Chat Management Service**: Authenticates users, authorizes requests, validates permissions
-   **Memory Service**: Trusts all incoming requests (network-isolated, only CMS can reach it)
-   **Network Layer**: VPC/firewall rules prevent unauthorized access

**No Authentication Middleware Needed**:

-   Memory Service does NOT verify Firebase tokens
-   Memory Service does NOT check user permissions
-   Memory Service does NOT implement role-based access control
-   All authorization happens in Chat Management Service BEFORE calling Memory API

**Data Isolation**:

-   All Memory Service queries filter by `userID` (passed from Chat Management Service)
-   Chat Management Service is responsible for passing the correct `userID`
-   Network security prevents direct access from frontend or external services

### Data Protection

-   **Encryption in Transit**: HTTPS only (enforced by Cloud Run)
-   **Encryption at Rest**: PostgreSQL encryption enabled
-   **Secrets Management**: Environment variables, never in code
-   **SQL Injection**: Prevented by Prisma parameterized queries
-   **Input Validation**: class-validator on all DTOs

### Privacy Compliance

-   **GDPR**: User data deletion supported via CASCADE DELETE
-   **Data Minimization**: Only store necessary conversation data
-   **Retention**: Implement data retention policies (future)
-   **Audit Logs**: Track who accessed what data (future)

---

## Performance Optimization

### Database Indexes

```sql
-- Critical for query performance
CREATE INDEX idx_chats_user_id ON chats(user_id, last_updated_at DESC);
CREATE INDEX idx_messages_chat_id ON messages(chat_id, sequence_number DESC);
CREATE INDEX idx_memories_user_id ON memories(user_id);
```

### Connection Pooling

```typescript
// Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool size: 10-20 for Cloud Run
}
```

### Caching Strategy (Future)

-   **Redis**: Cache frequently accessed conversations
-   **TTL**: 5-minute cache for conversation metadata
-   **Invalidation**: Clear cache on new messages

### Query Optimization

-   Use `SELECT` only needed fields
-   Avoid N+1 queries with Prisma `include`
-   Batch operations where possible

---

## Testing Strategy

### Unit Tests (Jest)

-   Service logic isolated from database
-   Mock Prisma client
-   Focus on business logic

### Integration Tests (E2E)

-   Test with real PostgreSQL (test database)
-   Full request/response cycle
-   Test error cases and edge conditions

### Load Testing (Future)

-   Simulate 100 concurrent users
-   Measure p95 latency
-   Identify bottlenecks

---

## Migration Plan

### Phase 1: MVP (Current)

-   Core CRUD operations
-   Mock mem0.ai for development
-   Docker Compose for local dev
-   Manual testing

### Phase 2: Production Ready

-   Real mem0.ai integration
-   Firebase Auth middleware
-   Cloud SQL deployment
-   Automated CI/CD
-   Monitoring and alerting

### Phase 3: Enhancements

-   Redis caching layer
-   Cursor-based pagination
-   AI-generated conversation titles
-   Analytics dashboard
-   Multi-language support

---

## Risks / Trade-offs

### Risk 1: mem0.ai Service Availability

-   **Impact**: Memory synthesis fails
-   **Mitigation**: Graceful degradation; service continues without synthesis
-   **Monitoring**: Alert on mem0.ai error rate

### Risk 2: PostgreSQL Connection Exhaustion

-   **Impact**: Service becomes unavailable
-   **Mitigation**: Connection pooling, auto-scaling
-   **Monitoring**: Track active connections

### Risk 3: Data Growth

-   **Impact**: Slow queries, storage costs
-   **Mitigation**: Data retention policies, archiving old conversations
-   **Monitoring**: Database size metrics

### Risk 4: API Rate Limits (mem0.ai)

-   **Impact**: Memory synthesis throttled
-   **Mitigation**: Queue synthesis jobs, batch processing
-   **Monitoring**: Track mem0.ai usage

### Trade-off: Dual Storage Complexity

-   **Decision**: PostgreSQL + mem0.ai
-   **Cost**: Synchronization overhead, potential inconsistencies
-   **Benefit**: Specialized tools for each use case
-   **Mitigation**: PostgreSQL is source of truth; mem0.ai is derived

### Trade-off: Microservice Complexity

-   **Decision**: Standalone service vs. integrated
-   **Cost**: Additional deployment, network latency
-   **Benefit**: Clear boundaries, independent scaling
-   **Mitigation**: Good documentation, health endpoints

---

## Open Questions

1. **Authentication**: When should Firebase Auth middleware be added?

    - **Proposed**: After MVP demo, before production deployment

2. **Caching**: Is Redis caching necessary for MVP?

    - **Proposed**: No, add after measuring production load

3. **Data Retention**: How long should conversations be kept?

    - **Proposed**: 1 year active, then archive; needs stakeholder input

4. **Cross-Service Communication**: Should we use event-driven architecture?

    - **Proposed**: REST for MVP, consider events if real-time needs emerge

5. **Monitoring**: What metrics are critical for operations?
    - **Proposed**: API latency, error rate, DB connections, mem0.ai success rate

---

## References

-   [NestJS Documentation](https://docs.nestjs.com/)
-   [Prisma Best Practices](https://www.prisma.io/docs/guides)
-   [mem0.ai API Reference](https://docs.mem0.ai/api-reference)
-   [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
-   [12-Factor App Principles](https://12factor.net/)
