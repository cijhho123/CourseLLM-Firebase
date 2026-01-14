# CourseLLM Platform Integration Design

**Version**: 1.0.0
**Last Updated**: January 14, 2026
**Status**: Active Development

---

## Purpose

This document describes the architectural design decisions for integrating the Memory Service into the CourseWise platform. It explains HOW components connect, WHY specific patterns were chosen, and WHAT trade-offs were considered.

---

## Integration Architecture

### System Context

```
                        ┌──────────────────────┐
                        │       Student        │
                        │      (Browser)       │
                        └──────────┬───────────┘
                                   │
                                   │ HTTPS
                                   │
                        ┌──────────v───────────┐
                        │   Next.js Frontend   │
                        │   (Server + Client)  │
                        │                      │
                        │  Pages:              │
                        │  - /student/*        │
                        │  - /teacher/*        │
                        │  - /login            │
                        └──────────┬───────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   │               │               │
                   v               v               v
        ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
        │   Firebase   │  │     Genkit    │  │    Memory    │
        │ Auth+Storage │  │   AI Flows    │  │   Service    │
        │  Firestore   │  │               │  │   (NestJS)   │
        └──────────────┘  └───────┬───────┘  └──────┬───────┘
                                  │                  │
                                  v                  v
                          ┌──────────────┐  ┌───────────────┐
                          │   Gemini     │  │  PostgreSQL   │
                          │   2.5 Flash  │  │   Database    │
                          └──────────────┘  └───────────────┘
```

### Design Principles

1. **Microservices Architecture**: Memory Service is isolated and independently scalable
2. **Service-to-Service Trust**: Internal services trust each other (network-level security)
3. **Data Sovereignty**: Each service owns its data domain
4. **API-First Design**: All integration happens through well-defined REST APIs
5. **Fail-Safe Operations**: System continues if Memory Service is unavailable

---

## Integration Patterns

### Pattern 1: Frontend → Backend → Memory Service

**Why This Pattern:**
- Frontend never directly accesses Memory Service (security)
- Backend validates user authentication before forwarding requests
- Centralizes authorization logic
- Allows response transformation/enrichment

**Flow:**
```
┌────────────┐
│  Frontend  │
│  (React)   │
└─────┬──────┘
      │ 1. POST /api/chat/send
      │    { message: "Hello", courseID: "CS101" }
      v
┌─────────────────┐
│   Next.js API   │
│   Route Handler │
├─────────────────┤
│ 2. Verify user  │
│    auth token   │
│ 3. Get userID   │
└─────┬───────────┘
      │ 4. Call Memory Service
      │    POST /api/v1/memory/messages
      │    { userID, content, sender: "user" }
      v
┌─────────────────┐
│ Memory Service  │
│   (NestJS)      │
├─────────────────┤
│ 5. Save message │
│ 6. Return msgID │
└─────┬───────────┘
      │ 7. Response with chatID
      v
┌─────────────────┐
│   Next.js API   │
│   Route Handler │
├─────────────────┤
│ 8. Call Genkit  │
│    AI flow      │
└─────┬───────────┘
      │ 9. Return to frontend
      v
┌────────────┐
│  Frontend  │
│  Updates   │
│  Chat UI   │
└────────────┘
```

### Pattern 2: Genkit AI Flow → Memory Service

**Why This Pattern:**
- AI flows need conversation context for personalized responses
- Keeps AI logic separate from message persistence
- Allows AI to influence memory synthesis

**Current State**: Not yet implemented (planned)

**Planned Approach:**
1. Fetch recent conversation history (last 10 messages)
2. Fetch synthesized student memories from Memory Service
3. Build enriched prompt with student context
4. Generate response using Gemini
5. Return response with chatID

### Pattern 3: Background Job → Memory Synthesis

**Why This Pattern:**
- Memory synthesis is computationally expensive
- Doesn't need to be real-time (eventual consistency)
- Decouples user interaction from AI processing

**Planned Implementation:**
```
┌─────────────────┐
│  Cloud Scheduler│
│  (Hourly)       │
└────────┬────────┘
         │ Trigger synthesis job
         v
┌─────────────────┐
│ Cloud Function  │
│ "synthesize-    │
│  memories"      │
└────────┬────────┘
         │ For each active student
         v
┌─────────────────────────┐
│  Memory Service         │
│  POST /api/v1/memory/   │
│       synthesize        │
├─────────────────────────┤
│ 1. Fetch all messages   │
│    since last synthesis │
│ 2. Call mem0.ai API     │
│ 3. Store synthesized    │
│    memories             │
└─────────────────────────┘
```

---

## Data Flow Designs

### Design 1: Message Persistence

**Decision**: Save messages immediately after user sends

**Rationale:**
- Prevents data loss if AI generation fails
- Allows retry without re-asking user
- Enables "thinking..." indicators

**Sequence:**
```
User sends message
  → Save to Memory Service (commit)
  → Generate AI response (can fail/retry)
  → Save AI response (commit)
  → Display to user
```

**Alternative Considered**: Save both messages after AI generation
- **Rejected**: Risk losing user message if AI fails
- **Rejected**: Harder to implement retry logic

### Design 2: Conversation Context Window

**Decision**: Load last 10 messages for AI context

**Rationale:**
- Balances context quality vs. API token cost
- Fits within Gemini 2.5 Flash token limits
- Fast retrieval from PostgreSQL

**Query Optimization:**
- Index on `(chat_id, sequence_number DESC)` for fast retrieval
- Query orders by sequence_number descending, limits to 10

**Alternative Considered**: Load entire conversation history
- **Rejected**: Expensive for long conversations
- **Rejected**: Exceeds token limits for larger chats

### Design 3: Memory Synthesis Storage

**Decision**: Store synthesized memories in both PostgreSQL and mem0.ai

**Rationale:**
- PostgreSQL: Fast relational queries, always available
- mem0.ai: Semantic search, embeddings, vector similarity
- Resilient to mem0.ai outages

**Data Model:**
```
PostgreSQL (Memory Service)
  memories table
    ├─ memory_id (UUID, primary key)
    ├─ user_id (string, indexed)
    ├─ content (text, searchable)
    ├─ mem0_memory_id (string, nullable)
    ├─ source_chat_ids (jsonb, array of chatIDs)
    ├─ created_at (timestamp)
    └─ metadata (jsonb)

mem0.ai (Vector Store)
  ├─ Embeddings for semantic search
  ├─ Vector similarity queries
  └─ Context-aware memory retrieval
```

**Alternative Considered**: Store only in mem0.ai
- **Rejected**: Vendor lock-in
- **Rejected**: Single point of failure

---

## Component Communication Design

### Memory Service API Design

**Design Decision**: RESTful API with versioning

**API Structure:**
```
/api/v1/memory/
  ├─ /register                    (POST)
  ├─ /messages                    (POST)
  ├─ /conversations/:chatID       (GET)
  ├─ /users/:userID/conversations (GET)
  ├─ /synthesize                  (POST)
  └─ /users/:userID/memories      (GET)

/health                           (GET)
/api/docs                         (Swagger UI)
```

**Why RESTful:**
- Standard HTTP methods (POST, GET)
- Easy to test with curl/Postman
- Works with Swagger/OpenAPI
- No special client libraries required

**Alternative Considered**: GraphQL
- **Rejected**: Overkill for simple CRUD operations
- **Rejected**: Adds complexity for minimal benefit

**Alternative Considered**: gRPC
- **Rejected**: HTTP/2 not necessary for current scale
- **Rejected**: Harder to debug and test manually

### Error Handling Strategy

**Design Decision**: Graceful degradation

**Behavior When Memory Service Unavailable:**
- Log error but continue processing
- AI flow continues without historical context
- Chat still works (degraded experience)
- Messages stored in-memory temporarily
- Background retry job attempts to save later

**Why This Design:**
- System remains functional during Memory Service outages
- Better user experience (degraded but not broken)
- Gives time to fix Memory Service without impacting users

**Alternative Considered**: Block chat until Memory Service recovers
- **Rejected**: Poor user experience
- **Rejected**: Creates cascading failures

---

## Security Design

### Network Isolation

**Design Decision**: Internal-only Memory Service

**Architecture:**
```
Internet
    │
    │ HTTPS
    ▼
┌────────────────────┐
│  Firebase Hosting  │
│  (Next.js)         │
│  Public Network    │
└────────┬───────────┘
         │
         │ Internal VPC
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐  ┌───────────────┐
│ Genkit  │  │ Memory Service│
│ Flows   │  │ (Cloud Run)   │
└─────────┘  └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │   Cloud SQL   │
             │  (Private IP) │
             └───────────────┘
```

**Firewall Rules:**
```
# Memory Service ingress (Cloud Run)
ALLOW from tag:coursewise-backend
DENY all

# Cloud SQL ingress
ALLOW from tag:memory-service
DENY all
```

**Why Internal-Only:**
- Prevents direct user access to sensitive data
- Forces authentication through Next.js backend
- Reduces attack surface

**Alternative Considered**: Public API with API keys
- **Rejected**: Risk of key exposure
- **Rejected**: Complex key rotation

### Authorization Model

**Design Decision**: Service-to-service trust (no auth in Memory Service)

**Model:**
```
┌───────────────────────────────────────┐
│          Next.js Backend              │
│  (Verifies Firebase Auth Token)       │
│  - Extracts userID                    │
│  - Validates permissions              │
└───────────────┬───────────────────────┘
                │ Trusted call
                │ (passes verified userID)
                ▼
┌───────────────────────────────────────┐
│         Memory Service                │
│  (NO authentication check)            │
│  - Trusts userID from caller          │
│  - Filters all queries by userID      │
└───────────────────────────────────────┘
```

**Why No Auth in Memory Service:**
- Simplified architecture
- Network isolation provides security
- Faster request processing (no token validation)
- Clear separation of concerns

**Data Isolation in Memory Service:**
- Every database query filters by userID
- Users can only access their own conversations and messages
- No cross-user data leakage possible at the query level

**Alternative Considered**: Firebase Auth in Memory Service
- **Rejected**: Duplicate auth logic
- **Rejected**: Adds latency for every request

---

## Scalability Design

### Memory Service Scaling

**Design Decision**: Horizontal scaling with Cloud Run

**Configuration:**
- Min instances: 1 (no cold start for first request)
- Max instances: 10 (scales with traffic)
- Concurrency: 80 requests per instance
- Resources: 1 CPU, 512Mi memory

**Why This Design:**
- Auto-scales based on traffic
- No idle costs with min instances = 1
- Stateless service (no sticky sessions needed)

### Database Connection Pooling

**Design Decision**: PgBouncer for connection pooling

**Architecture:**
```
┌────────────────┐     ┌────────────────┐
│ Memory Service │────▶│   PgBouncer    │
│  Instance 1    │     │ (Connection    │
└────────────────┘     │  Pool)         │
                       │                │
┌────────────────┐     │  ┌──────────┐  │
│ Memory Service │────▶│  │ Pool: 20 │  │────▶ Cloud SQL
│  Instance 2    │     │  └──────────┘  │     (max 100 conn)
└────────────────┘     └────────────────┘

┌────────────────┐
│ Memory Service │────▶
│  Instance 3    │
└────────────────┘
```

**Prisma Configuration:**
- Database URL from environment variable
- Prisma Client with PostgreSQL extensions enabled
- Connection managed through NestJS dependency injection

**Why Connection Pooling:**
- Cloud SQL limits connections (100 for small instances)
- Each Memory Service instance needs multiple connections
- PgBouncer multiplexes connections efficiently

---

## Monitoring and Observability

### Health Check Design

**Endpoint**: `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:00Z",
  "service": "memory-service",
  "version": "1.0.0",
  "checks": {
    "database": "connected",
    "mem0": "mock"
  }
}
```

**Why This Design:**
- Simple HTTP endpoint (no special tools)
- Cloud Run uses it for readiness/liveness probes
- Includes database connectivity check

### Logging Strategy

**Decision**: Structured JSON logs with Winston

**Log Fields:**
- `timestamp`, `level`, `service`, `traceId`
- `message` with contextual data (userID, chatID, latencyMs)

**Why Structured Logs:**
- Easy to query in Cloud Logging
- Trace requests across services
- Performance monitoring

---

## Technology Choices

### Why NestJS for Memory Service

**Decision**: Use NestJS (not Express or FastAPI)

**Rationale:**
- **TypeScript Native**: Type safety across entire stack
- **Dependency Injection**: Clean architecture, testable
- **Built-in Swagger**: Auto-generated API docs
- **Modular**: Clear separation of concerns (modules for users, chats, messages)
- **Decorator-Based**: Concise, readable code

**Alternative Considered**: FastAPI (Python)
- **Rejected**: Different language from main platform
- **Rejected**: Team more experienced with TypeScript

**Alternative Considered**: Express.js (plain)
- **Rejected**: Lacks structure for larger services
- **Rejected**: No built-in dependency injection

### Why PostgreSQL for Conversations

**Decision**: Use PostgreSQL (not Firestore)

**Rationale:**
- **Relational Data**: Natural fit for conversation hierarchies
- **ACID Transactions**: Guaranteed message ordering
- **Complex Queries**: JOIN conversations with users efficiently
- **Sequential IDs**: Auto-incrementing sequence_number
- **Full-Text Search**: Built-in for message content

**Alternative Considered**: Firestore
- **Rejected**: Weak querying (no JOINs)
- **Rejected**: Expensive pagination
- **Rejected**: Complex transaction model for ordering

**Alternative Considered**: MongoDB
- **Rejected**: Less mature for relational queries
- **Rejected**: Team prefers SQL

### Why mem0.ai for Memory Synthesis

**Decision**: Use mem0.ai (with PostgreSQL backup)

**Rationale:**
- **Semantic Search**: Vector embeddings for similar memories
- **Purpose-Built**: Designed for conversational memory
- **Managed Service**: Don't need to build vector search

**Alternative Considered**: Build custom embeddings with Vertex AI
- **Rejected**: Significant engineering effort
- **Rejected**: Not core competency

**Alternative Considered**: Store only in PostgreSQL
- **Rejected**: Loses semantic search capabilities
- **Rejected**: Harder to find contextually relevant memories

---

## Trade-offs and Constraints

### Trade-off 1: Dual Storage (PostgreSQL + mem0.ai)

**Benefit**: Resilience and performance
**Cost**: Data synchronization complexity
**Decision**: Worth it for reliability

### Trade-off 2: No Authentication in Memory Service

**Benefit**: Simpler, faster
**Risk**: Vulnerable if network isolation fails
**Decision**: Network security is sufficient for internal service

### Trade-off 3: Mock mem0.ai Implementation

**Benefit**: Can develop without API key dependency
**Cost**: Not production-ready
**Decision**: Acceptable for MVP, plan to integrate real API

---

## Future Design Considerations

### Caching Layer (Redis)

**When Needed**: >500 concurrent users

**Design:**
```
Request → Check Redis cache → If miss, query PostgreSQL
                            → Store in cache (TTL: 5 min)
```

### Real-time Memory Updates

**WebSocket Design** (Future):
```
Student 1 asks question
  → Memory Service saves
  → Teacher dashboard receives real-time update
  → Shows: "Student struggling with derivatives"
```

### Multi-tenancy

**If Scaling to Multiple Schools:**
```
Add tenantID field to all tables
  users(tenantID, userID, ...)
  chats(tenantID, chatID, ...)
  messages(tenantID, messageID, ...)

Network isolation per tenant
```

---

## References

- **Memory Service Detailed Design**: `openspec/specs/memory-service/design.md`
- **Platform Overview**: `openspec/project.md`
- **Integration Specification**: `openspec/spec.md`
- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization

---

**Document Status**: ✅ Complete
**Next Review**: January 21, 2026
**Design Reviewers**: Development Team
