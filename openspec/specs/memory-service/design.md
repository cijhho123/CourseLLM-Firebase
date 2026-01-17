# Memory Service Design Document

## Context

The Memory Service is a critical component of the CourseWise platform that enables personalized learning through persistent conversational memory. It must integrate with the existing Next.js/Firebase architecture while operating as an independent NestJS microservice capable of handling user management, conversation storage, message persistence, and AI-powered memory synthesis using Firebase Data Connect for data persistence and mem0.ai for semantic memory extraction.

** IMPORTANT: Internal Service Architecture**

**The Memory Service is an INTERNAL backend service that does NOT implement authentication or authorization.** It is designed to be called only by other backend services (primarily the Chat Management Service) and relies on network isolation and service-to-service trust. Users never directly access the Memory Service API.

**Security Model:**
```
User → Chat Management Service (authenticates/authorizes) → Memory Service (trusts caller, no auth)
```

**Background:**

-   CourseWise uses Next.js 15 with Firebase for authentication and Firebase Data Connect for data persistence
-   AI tutoring via Google Genkit requires conversation context across sessions
-   Students need personalized learning experiences based on past interactions
-   The platform has role-based access (students, teachers, admins) - **handled by Chat Management Service, NOT Memory Service**
-   Memory Service uses GraphQL schema with Firebase Data Connect for type-safe data operations
-   **Memory Service does NOT verify Firebase tokens or implement any authentication middleware**

**Constraints:**

-   Must be runnable in GitHub Codespaces for PR review
-   **Network isolation required** - Only accessible by other backend services (VPC/firewall rules)
-   Limited budget for external services (mem0.ai rate limits)
-   Must handle concurrent access from multiple backend service instances
-   Data privacy and GDPR compliance required (enforced by calling services)

**Stakeholders:**

-   Students (indirect users - access through Chat Management Service)
-   Teachers (indirect users - access through Chat Management Service)
-   **Chat Management Service (primary API consumer - only direct caller)**
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

1. **User Authentication/Authorization**: Memory Service does NOT authenticate users or verify permissions (handled by calling services)
2. **Direct User Access**: Memory Service is NOT accessible directly by frontend or end users
3. Real-time collaborative conversations (students work individually)
4. Rich media storage (text-only for MVP)
5. Advanced analytics dashboard (future enhancement)
6. Message editing/deletion (immutable append-only design)
7. Multi-language NLP (English-only for MVP)
8. Automatic memory management/forgetting (manual/orchestrated only)

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
-   **Internal Service Design**: Designed as internal-only service (no authentication needed)

**Alternatives Considered**:

1. **Next.js API Routes**: Rejected due to coupling with frontend and limited architectural patterns
2. **Express.js**: Rejected in favor of NestJS for better structure and DI container
3. **Firebase Cloud Functions**: Rejected due to cold starts and deployment complexity for complex services

**Trade-offs**:

-   ➕ Clear boundaries, independent scaling
-   ➕ Better suited for microservice patterns
-   ➕ No authentication overhead (internal service)
-   ➖ Additional deployment complexity
-   ➖ Requires separate service management
-   ➖ Requires network isolation configuration

---

### Decision 1.5: Modular Architecture with Domain-Driven Design

**Choice**: Separate modules for User, Chat, Message, and Memory with domain/infrastructure/application layers

**Rationale**:

-   **Separation of Concerns**: Each module handles one domain entity
-   **Repository Pattern**: Clean abstraction over data access (interfaces + implementations)
-   **Testability**: Easy to mock repositories and test services in isolation
-   **Maintainability**: Consistent structure across modules makes codebase easier to understand
-   **Dependency Injection**: NestJS DI container manages dependencies between modules

**Module Structure**:

```
modules/
├── user/
│   ├── domain/              # Interfaces, types
│   ├── infrastructure/      # Data Connect repository
│   ├── application/         # Services, DTOs
│   └── user.controller.ts   # API endpoints
├── chat/
├── messages/
└── memory/
```

**Trade-offs**:

-   ➕ Clear boundaries and responsibilities
-   ➕ Easy to test and modify individual modules
-   ➕ Consistent patterns across codebase
-   ➖ More files and structure (acceptable trade-off)
-   ➖ Circular dependencies require `forwardRef` (Chat ↔ Messages)

---

### Decision 2: Firebase Data Connect for Primary Storage

**Choice**: Firebase Data Connect with GraphQL schema for conversation and message storage

**Rationale**:

-   **Schema-First Development**: GraphQL schema defines data model upfront, generates type-safe SDKs
-   **Type Safety**: Generated TypeScript SDKs provide compile-time type checking
-   **Firebase Integration**: Seamless integration with existing Firebase ecosystem (Auth, Hosting, Functions)
-   **Consistent Architecture**: Aligns with Next.js/Firebase stack already in use
-   **GraphQL Benefits**: Strong querying capabilities, field selection, filtering, and ordering
-   **Generated SDKs**: `firebase dataconnect:sdk:generate` creates type-safe functions for all operations

**Alternatives Considered**:

1. **PostgreSQL with Prisma**: Rejected to maintain consistency with Firebase ecosystem
2. **Firestore Direct**: Rejected in favor of Data Connect's schema-first approach and type safety
3. **MongoDB**: Rejected in favor of Firebase ecosystem integration

**Implementation Pattern**:

Data Connect insert mutations return only the key (ID), so repositories implement a pattern:
1. Execute insert mutation (returns `{ data: { entity_insert: { id } } }`)
2. Fetch full record via query (e.g., `getUserById`, `getChatById`) to get timestamps
3. Return complete entity record

**Trade-offs**:

-   ➕ Type-safe SDKs generated from schema
-   ➕ Consistent with Firebase architecture
-   ➕ Schema-first development provides clear contracts
-   ➖ Newer technology with evolving patterns
-   ➖ Insert mutations return keys only (require follow-up queries for full records)
-   ➖ Additional query overhead for inserts (acceptable trade-off for type safety)

---

### Decision 3: Dual Storage with mem0.ai

**Choice**: Firebase Data Connect stores all data; mem0.ai stores semantic embeddings for memory synthesis

**Rationale**:

-   **Data Connect as Source of Truth**: All conversations, messages, users, and memories are reliably stored
-   **mem0.ai for Semantic Search**: Leverages specialized vector DB for memory synthesis
-   **Separation of Concerns**: OLTP (Data Connect) vs. Semantic Search (mem0.ai)
-   **Resilience**: Service continues working if mem0.ai is unavailable (synthesis fails gracefully)
-   **Async Memory Creation**: Memories are created in Data Connect when fetched from mem0.ai, not during synthesis

**Memory Flow**:

1. Messages saved to Data Connect immediately
2. Memory synthesis triggered on-demand (queues job to mem0.ai, returns immediately)
3. mem0.ai processes conversation asynchronously and creates semantic memories
4. When memories are requested, service checks mem0.ai for new memories and syncs them to Data Connect
5. Memory retrieval returns from Data Connect (with fallback to mem0.ai if none locally)

**Alternatives Considered**:

1. **mem0.ai Only**: Rejected due to lack of control over data persistence
2. **Data Connect with vector search**: Rejected for MVP; Data Connect doesn't support vector operations
3. **Separate Vector DB (Pinecone, Weaviate)**: Rejected in favor of mem0.ai's higher-level API

**Trade-offs**:

-   ➕ Best tool for each job (GraphQL + vector search)
-   ➕ Resilient to mem0.ai outages
-   ➕ Async processing doesn't block API responses
-   ➖ Data synchronization complexity (deduplication needed)
-   ➖ Additional external dependency

---

### Decision 4: API Versioning with /api/v1/ Prefix

**Choice**: All endpoints prefixed with `/api/v1/memory` (except health check at `/health`)

**Rationale**:

-   **Future-Proofing**: Enables breaking changes without affecting existing clients
-   **Clear Expectations**: Clients know they're using a versioned API
-   **Industry Standard**: Follows REST API best practices
-   **Migration Path**: v2 can coexist with v1 during transitions

**API Route Structure**:

- `/api/v1/memory/users` - User management (register, get by ID)
- `/api/v1/memory/conversations` - Chat/conversation management (create, get by ID, get by user)
- `/api/v1/memory/messages` - Message persistence (save message)
- `/api/v1/memory` - Memory synthesis (synthesize, get user memories)
- `/health` - Health check endpoint (operational, not versioned)
- `/api/docs` - Swagger documentation

**Trade-offs**:

-   ➕ Clear versioning strategy
-   ➕ Safe evolution path
-   ➕ Consistent route structure
-   ➖ Slightly longer URLs
-   ➖ Maintenance of multiple versions (future concern)

---

### Decision 5: No Pagination for Messages

**Choice**: Messages endpoint returns all messages for a chat without pagination

**Rationale**:

-   **Simplicity**: Eliminates pagination complexity and parameters
-   **Complete Context**: AI needs full conversation history for better memory synthesis
-   **Performance**: Most conversations are manageable size; pagination adds complexity without clear benefit
-   **API Design**: Messages are retrieved through chat endpoint (`GET /api/v1/memory/conversations/:chatID`) that includes full message list

**Implementation**:

- Messages are fetched via `findMessagesByChatId()` which returns all messages
- Messages included in chat response as array of `{ content, sender }` objects
- Messages ordered by `sequenceNumber` (maintained in database)

**Alternatives Considered**:

1. **Pagination with limit/offset**: Rejected - added complexity without clear need
2. **Cursor-based Pagination**: Rejected for MVP due to complexity
3. **Large default limit**: Rejected - simpler to return all messages

**Trade-offs**:

-   ➕ Simpler API and implementation
-   ➕ Complete conversation context available
-   ➖ May be inefficient for very long conversations (future optimization)
-   ➖ No built-in pagination if needed later

---

### Decision 6: Idempotent User Registration

**Choice**: User registration returns success if user already exists

**Rationale**:

-   **Reliability**: Network retries don't cause errors
-   **Simplicity**: Callers don't need to check existence first
-   **Integration**: Firebase Auth sync can be repeated safely

**Implementation**:

```typescript
// Data Connect pattern - check existence first, then create or return existing
const existingUser = await dataConnect.getUserById({ id: userID });
if (existingUser) {
    return existingUser;
}
return await dataConnect.createUser({ id: userID, name, role });
```

**Trade-offs**:

-   ➕ Robust to retries and race conditions
-   ➕ Simpler caller logic
-   ➖ Silently updates existing users (acceptable for this use case)

---

### Decision 7: Optional Conversation Titles

**Choice**: Conversation titles are optional and provided by the caller when creating a chat

**Rationale**:

-   **Flexibility**: Callers can provide meaningful titles or omit them
-   **Simplicity**: No automatic generation logic needed
-   **MVP Scope**: Good enough for launch; can enhance with auto-generation later

**Implementation**:

```typescript
// Title is optional in CreateChatDto
title?: string;

// Passed directly to Data Connect (null if not provided)
title: data.title || null,
```

**Alternatives Considered**:

1. **AI-Generated Titles**: Rejected for MVP due to latency and cost
2. **Auto-Generated from First Message**: Not implemented in MVP; can be added later
3. **Generic Titles ("Conversation 1")**: Rejected due to poor UX

**Trade-offs**:

-   ➕ Simple implementation
-   ➕ Flexible for callers
-   ➖ No automatic titles (caller must provide or handle null)
-   ➖ Future enhancement: Auto-generate from first message content

---

### Decision 8: Swagger/OpenAPI Documentation

**Choice**: NestJS auto-generated Swagger docs at `/api/docs`

**Rationale**:

-   **Developer Experience**: Interactive playground for API testing
-   **Documentation**: Always up-to-date with code
-   **Code Review**: Reviewers can test endpoints directly in Codespaces
-   **Client Generation**: OpenAPI schema can generate client SDKs

**Implementation**:

- Swagger configured in `main.ts` with tags for each module (memories, chats, messages, users, health)
- All controllers use `@ApiTags`, `@ApiOperation`, `@ApiResponse` decorators
- Documentation available at `http://localhost:3001/api/docs`

**Trade-offs**:

-   ➕ Zero-effort documentation
-   ➕ Great for development and testing
-   ➖ Should be disabled in production
-   ➖ Exposes API structure (security consideration)

---

### Decision 9: Global Exception Filter and Validation Pipe

**Choice**: Centralized error handling with consistent HTTP status codes and global validation

**Rationale**:

-   **Consistency**: All errors follow same format
-   **Security**: Prevents leaking sensitive details
-   **Debugging**: Structured error responses easier to log
-   **Input Validation**: Automatic DTO validation with class-validator

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

**Validation Pipe Configuration**:

```typescript
new ValidationPipe({
    whitelist: true,        // Strip non-whitelisted properties
    transform: true,        // Transform payloads to DTO instances
    forbidNonWhitelisted: true,  // Throw error for unknown properties
})
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
-   ➕ Automatic input validation
-   ➖ May hide useful debug info (mitigated with logging)

---

### Decision 10: Firebase Data Connect Emulator for Local Development

**Choice**: Firebase Data Connect emulator for local development

**Rationale**:

-   **Consistency**: Matches production Firebase Data Connect environment
-   **Simplicity**: Integrated with Firebase CLI, no separate database setup
-   **Schema Testing**: Test GraphQL schema changes locally before deployment
-   **CI/CD**: Same setup works in Codespaces

**Configuration**:

```bash
# Start Firebase emulators (Data Connect + others)
firebase emulators:start --only dataconnect

# Generate SDKs from schema
firebase dataconnect:sdk:generate
```

**Implementation**:

- Emulator host automatically configured in `main.ts`:
  ```typescript
  if (!process.env.DATA_CONNECT_EMULATOR_HOST && process.env.NODE_ENV !== "production") {
    process.env.DATA_CONNECT_EMULATOR_HOST = "127.0.0.1:9399";
  }
  ```
- Uses `@dataconnect/admin-generated` SDK for server-side operations
- Firebase Admin SDK initialized automatically in repository `onModuleInit` hooks

**Trade-offs**:

-   ➕ Matches production environment exactly
-   ➕ No separate database to manage
-   ➕ Integrated with Firebase tooling
-   ➕ Automatic emulator configuration
-   ➖ Requires Firebase CLI setup
-   ➖ Emulator limitations (not full production parity)

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
GCLOUD_PROJECT=your-project-id
MEM0_API_KEY=mem0_xxx
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399  # Auto-set in dev mode
```

**Implementation**:

- NestJS `ConfigModule` configured globally in `AppModule`
- `ConfigService` used throughout for accessing environment variables
- Default values provided where appropriate (e.g., PORT=3001)

**Trade-offs**:

-   ➕ Secure and flexible
-   ➕ Standard practice
-   ➕ Type-safe configuration access
-   ➖ Requires documentation for setup
-   ➖ Easy to misconfigure

---

### Decision 12: Firebase Data Connect Schema Management

**Choice**: GraphQL schema files in `dataconnect/schema/` with version control

**Rationale**:

-   **Version Control**: Schema tracked in git as `.gql` files
-   **Reproducibility**: Same schema across all environments
-   **Type Safety**: Schema changes generate new SDKs automatically
-   **Deployment**: Schema deployed via Firebase CLI

**Workflow**:

1. Define schema in `dataconnect/schema/schema.gql`
2. Define queries/mutations in `dataconnect/example/queries.gql` and `mutations.gql`
3. Generate SDKs: `firebase dataconnect:sdk:generate`
4. Deploy: `firebase deploy --only dataconnect`

**Schema Structure**:

- `User`: id, name, role, timestamps
- `Chat`: id, userId, title (nullable), timestamps
- `Message`: id (UUID), chatId, content, sender, sequenceNumber, timestamps
- `Memory`: id (UUID), userId, content, mem0MemoryId (nullable), sourceChatIds (array), timestamps

**Trade-offs**:

-   ➕ Schema-first development with type safety
-   ➕ Generated SDKs eliminate manual type definitions
-   ➕ Integrated with Firebase deployment
-   ➖ SDK regeneration required for every schema change
-   ➖ Learning curve for GraphQL schema syntax

---

### Decision 13: Winston Logger with Daily Rotation

**Choice**: Custom Winston logger with daily rotating file transport

**Rationale**:

-   **Structured Logging**: Consistent log format across all modules
-   **File Rotation**: Prevents log files from growing unbounded
-   **Context Tracking**: Each module sets its own context for easier debugging
-   **Caller Location**: Automatically includes file and line number in logs

**Implementation**:

- Custom logger service (`CustomLoggerService`) implements NestJS `LoggerService`
- Daily rotating file transport: logs stored in `logs/YYYY_MM_DD_HH.log` format
- Log retention: 30 days
- Console transport: colored output for development
- Log levels: debug, info, warn, error (configurable via `LOG_LEVEL` env var)

**Log Format**:

```
2026-01-12 20:30:45 [INFO] [user.service.ts:42] [UserService]: Created user user_123
```

**Trade-offs**:

-   ➕ Structured, searchable logs
-   ➕ Automatic file rotation prevents disk issues
-   ➕ Context and location tracking for debugging
-   ➖ Additional dependency (winston, winston-daily-rotate-file)
-   ➖ Requires log directory setup

---

### Decision 14: CORS Enabled

**Choice**: Enable CORS for all origins in development

**Rationale**:

-   **Development Flexibility**: Allows frontend development on different ports
-   **Testing**: Enables API testing from browser-based tools
-   **MVP Scope**: Sufficient for development; should be restricted in production

**Implementation**:

```typescript
app.enableCors();
```

**Trade-offs**:

-   ➕ Easy development and testing
-   ➕ No CORS issues during local development
-   ➖ Should be restricted in production (add origin whitelist)
-   ➖ Security consideration for production deployment

---

### Decision 15: Health Check Endpoint

**Choice**: Health check endpoint at `/health` (not under `/api/v1/memory`)

**Rationale**:

-   **Standard Convention**: Health endpoints typically at root level
-   **Monitoring**: Easy for load balancers and monitoring tools to check
-   **Separation**: Health checks are operational, not business logic

**Implementation**:

- Health module with controller at `/health`
- Returns: status, timestamp, uptime, database status, response time
- Swagger documentation included

**Response Format**:

```json
{
    "status": "ok",
    "timestamp": "2026-01-15T20:30:45.123Z",
    "uptime": 12345,
    "database": "connected",
    "responseTime": "5ms"
}
```

**Trade-offs**:

-   ➕ Standard location for health checks
-   ➕ Easy integration with monitoring tools
-   ➕ Includes useful operational metrics
-   ➖ Currently doesn't verify actual database connectivity (commented out)

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
│         │ HTTP/REST (authenticated)                           │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │   Chat Management Service                     │           │
│  │   (handles auth/authz)                        │           │
│  └──────┬───────────────────────────────────────┘           │
│         │                                                     │
│         │ HTTP/REST (NO AUTH - internal service)             │
│         │ Network isolated (VPC/firewall)                    │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │     Memory Service (NestJS)                   │           │
│  │     ⚠️ INTERNAL ONLY - NO AUTHENTICATION      │           │
│  │                                               │           │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │           │
│  │  │  Users   │  │  Chats   │  │ Messages  │ │           │
│  │  │ Module   │  │  Module  │  │  Module   │ │           │
│  │  └──────────┘  └──────────┘  └───────────┘ │           │
│  │       │              │              │        │           │
│  │       └──────────────┼──────────────┘        │           │
│  │                      │                       │           │
│  │                ┌─────▼──────┐                │           │
│  │                │  Memories  │                │           │
│  │                │  Module    │                │           │
│  │                └─────┬──────┘                │           │
│  │                      │                       │           │
│  │                ┌─────▼──────┐                │           │
│  │                │ Data       │                │           │
│  │                │ Connect    │                │           │
│  │                │ SDK        │                │           │
│  │                └─────┬──────┘                │           │
│  └──────────────────────┼───────────────────────┘           │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────┐       ┌──────────────┐
         │  Firebase Data Connect      │       │   mem0.ai    │
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
┌──────────┐      ┌────────────┐      ┌──────────────────┐
│ Firebase ├─────►│   Memory   ├─────►│ Firebase Data    │
│   Auth   │ 1.ID │  Service   │ 2.   │ Connect          │
└──────────┘      └────┬───────┘      │                  │
                       │              │ • createUser     │
                       │              │   (returns key)   │
                       │              │ • getUserById    │
                       │              │   (get full rec)  │
                       │              └──────────────────┘
                       ▼
              [return user record]
```

**Idempotent Behavior**: If user already exists, returns existing user (no error).

### Flow 2: Save Message to Conversation

```
┌─────────┐      ┌────────────┐      ┌──────────────────┐
│   AI    ├─────►│   Memory   ├─────►│ Firebase Data    │
│  Chat   │ 1.   │  Service   │ 2.   │ Connect          │
└─────────┘ msg  └────┬───────┘      │                  │
                      │               │ • createMessage  │
                      │               │   (returns key)  │
                      │               │ • query messages │
                      │               │   (get full rec) │
                      │               └──────────────────┘
                      ▼
              [return chatID, msgID]
```

**Note**: Data Connect insert mutations return only the key (ID), so repositories fetch the full record via follow-up queries to get timestamps and other fields.

### Flow 3: Memory Synthesis

```
┌────────────┐      ┌────────────┐      ┌──────────────────┐
│Orchestrator├─────►│   Memory   ├─────►│ Firebase Data    │
│  Service   │ 1.   │  Service   │ 2.   │ Connect          │
└────────────┘ chatID└────┬───────┘ read │ (getChat + msgs) │
                          │              └──────────────────┘
                          │ 3. messages
                          ▼
                    ┌───────────┐
                    │  mem0.ai  │
                    │    API    │
                    └─────┬─────┘
                          │
                          │ 4. queue job
                          │    (async)
                          ▼
                    [return event_id]
                    
When memories fetched:
┌────────────┐      ┌────────────┐      ┌───────────┐
│   Client   ├─────►│   Memory   ├─────►│  mem0.ai  │
│            │      │  Service   │      │   API     │
└────────────┘      └─────┬──────┘      └─────┬─────┘
                          │                    │
                          │ 5. getMemories     │
                          │                    │
                          ▼                    │
                    ┌──────────────────┐      │
                    │ Firebase Data    │◄─────┘
                    │ Connect          │
                    │ (createMemory)   │
                    └──────────────────┘
```

---

## Deployment Strategy

### Local Development

1. **Prerequisites**: Node.js 18+, Firebase CLI, npm/pnpm
2. **Setup**:
    ```bash
    cd src/services/memory-service
    npm install  # or pnpm install
    cp .env.example .env
    # Edit .env with MEM0_API_KEY and GCLOUD_PROJECT
    # Start Firebase emulators (Data Connect)
    firebase emulators:start --only dataconnect
    # Generate SDKs from schema (from project root)
    firebase dataconnect:sdk:generate
    # Start NestJS service
    npm run start:dev  # or pnpm start:dev
    ```
3. **Access**: 
    - API: http://localhost:3001
    - Swagger Docs: http://localhost:3001/api/docs
    - Health Check: http://localhost:3001/health

### GitHub Codespaces

1. **Automatic Setup**: Docker Compose starts automatically
2. **Port Forwarding**: VSCode forwards port 3001
3. **Environment**: Secrets configured in GitHub repo settings
4. **Testing**: All tests runnable in container

### Production (Cloud Run / Firebase Hosting)

1. **Database**: Firebase Data Connect (managed GraphQL backend)
2. **Schema Deployment**: `firebase deploy --only dataconnect` (from project root)
3. **SDK Generation**: Run `firebase dataconnect:sdk:generate` before building
4. **Container**: Docker image built from Dockerfile
5. **Secrets**: Google Secret Manager (MEM0_API_KEY, GCLOUD_PROJECT)
6. **Environment Variables**: PORT, NODE_ENV, LOG_LEVEL
7. **Scaling**: Auto-scaling based on CPU/memory
8. **Monitoring**: Cloud Logging, Cloud Monitoring
9. **CORS**: Should be restricted to specific origins in production

---

## Security Considerations

### ⚠️ Authentication & Authorization Model - CRITICAL

**The Memory Service is an INTERNAL backend service that does NOT implement authentication or authorization.**

**Key Points:**

1. **NO Authentication**: Memory Service does NOT verify Firebase tokens, API keys, or any authentication credentials
2. **NO Authorization**: Memory Service does NOT check user permissions or implement role-based access control
3. **NO User-Facing Endpoints**: Memory Service is NOT accessible directly by frontend applications or end users
4. **Network Isolation**: Access is restricted via VPC/firewall rules - only other backend services can reach it
5. **Service-to-Service Trust**: Memory Service trusts all incoming requests from authorized backend services

**Security Model**:

```
┌─────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  User   │─────►│ Chat Management      │─────►│  Memory Service   │
│         │      │ Service               │      │  (NO AUTH)       │
│         │      │ • Authenticates user  │      │  • Trusts caller  │
│         │      │ • Authorizes request  │      │  • No auth check  │
│         │      │ • Validates permissions│      │  • Network isolated│
└─────────┘      └──────────────────────┘      └──────────────────┘
                  (handles ALL auth/authz)        (internal only)
```

**Responsibilities**:

-   **Chat Management Service (or other backend services)**:
    - Authenticates users (Firebase Auth)
    - Authorizes requests (checks permissions, roles)
    - Validates user can access requested data
    - Passes validated `userID` to Memory Service
    - **MUST** ensure only authorized requests reach Memory Service

-   **Memory Service**:
    - Trusts all incoming requests (assumes caller has already authenticated/authorized)
    - Accepts `userID` from calling service without verification
    - No authentication middleware implemented
    - No authorization checks performed
    - Relies entirely on network isolation for security

-   **Network/Infrastructure Layer**:
    - VPC/firewall rules prevent unauthorized access
    - Only backend services in same VPC can reach Memory Service
    - Frontend and external services cannot directly access Memory Service

**What Memory Service Does NOT Do**:

-   ❌ Does NOT verify Firebase tokens
-   ❌ Does NOT check user permissions
-   ❌ Does NOT implement role-based access control
-   ❌ Does NOT validate that `userID` matches authenticated user
-   ❌ Does NOT have any authentication middleware
-   ❌ Does NOT expose endpoints to frontend or external services

**What Memory Service Assumes**:

-   ✅ Calling service has already authenticated the user
-   ✅ Calling service has already authorized the request
-   ✅ `userID` passed in requests is valid and authorized
-   ✅ Network isolation prevents unauthorized access

**Data Isolation**:

-   All Memory Service queries filter by `userID` (passed from calling service)
-   Calling service is responsible for passing the correct `userID`
-   Memory Service trusts the `userID` without verification
-   Network security prevents direct access from frontend or external services

### Data Protection

-   **Encryption in Transit**: HTTPS only (enforced by Cloud Run)
-   **Encryption at Rest**: Firebase Data Connect encryption enabled
-   **Secrets Management**: Environment variables, never in code
-   **SQL Injection**: Prevented by GraphQL parameterized queries (Data Connect handles this)
-   **Input Validation**: class-validator on all DTOs
-   **GraphQL Injection**: Data Connect validates all queries/mutations against schema

### Privacy Compliance

-   **GDPR**: User data deletion supported via Data Connect mutations (cascade handled in application logic)
-   **Data Minimization**: Only store necessary conversation data
-   **Retention**: Implement data retention policies (future)
-   **Audit Logs**: Track who accessed what data (future)

---

## Performance Optimization

### Database Indexes

Firebase Data Connect automatically creates indexes based on query patterns. Indexes are defined implicitly through:
- `where` clauses in queries (e.g., `userId: { eq: $userId }`)
- `orderBy` clauses (e.g., `orderBy: [{ lastUpdatedAt: DESC }]`)

Data Connect optimizes queries automatically, but we ensure:
- Queries filter by indexed fields (userId, chatId)
- Ordering uses indexed timestamp fields (lastUpdatedAt, createdAt)

### Connection Management

Firebase Data Connect handles connection pooling automatically. The generated SDK manages connections to Data Connect backend. No manual connection pool configuration needed.

### Caching Strategy (Future)

-   **Redis**: Cache frequently accessed conversations
-   **TTL**: 5-minute cache for conversation metadata
-   **Invalidation**: Clear cache on new messages

### Query Optimization

-   GraphQL field selection automatically limits returned fields
-   Use specific queries (GetChatById) instead of fetching all chats
-   Batch operations where possible (though Data Connect handles this)
-   Leverage Data Connect's built-in query optimization

---

## Testing Strategy

### Unit Tests (Jest)

-   Service logic isolated from database
-   Mock Data Connect SDK functions
-   Focus on business logic

### Integration Tests (E2E)

-   Test with Firebase Data Connect emulator
-   Full request/response cycle
-   Test error cases and edge conditions
-   Verify GraphQL queries and mutations work correctly

### Load Testing (Future)

-   Simulate 100 concurrent users
-   Measure p95 latency
-   Identify bottlenecks

---

## Migration Plan

### Phase 1: MVP (Current)

-   Core CRUD operations with Firebase Data Connect
-   GraphQL schema for User, Chat, Message, Memory
-   Firebase Data Connect emulator for local dev
-   Real mem0.ai integration
-   Manual testing

### Phase 2: Production Ready

-   Firebase Data Connect production deployment
-   **Network isolation configuration** (VPC/firewall rules - NO auth middleware needed)
-   Automated CI/CD
-   Monitoring and alerting
-   SDK regeneration in CI pipeline

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

### Risk 2: Firebase Data Connect Rate Limits

-   **Impact**: Service becomes unavailable or throttled
-   **Mitigation**: Data Connect handles scaling automatically, but monitor usage
-   **Monitoring**: Track Data Connect API calls and errors

### Risk 3: Data Growth

-   **Impact**: Slow queries, storage costs
-   **Mitigation**: Data retention policies, archiving old conversations
-   **Monitoring**: Database size metrics

### Risk 4: API Rate Limits (mem0.ai)

-   **Impact**: Memory synthesis throttled
-   **Mitigation**: Queue synthesis jobs, batch processing
-   **Monitoring**: Track mem0.ai usage

### Trade-off: Dual Storage Complexity

-   **Decision**: Firebase Data Connect + mem0.ai
-   **Cost**: Synchronization overhead, potential inconsistencies, deduplication needed
-   **Benefit**: Specialized tools for each use case (GraphQL + vector search)
-   **Mitigation**: Data Connect is source of truth; mem0.ai is derived. Memories synced when fetched.

### Trade-off: Microservice Complexity

-   **Decision**: Standalone service vs. integrated
-   **Cost**: Additional deployment, network latency
-   **Benefit**: Clear boundaries, independent scaling
-   **Mitigation**: Good documentation, health endpoints

---

## Open Questions

1. **Authentication**: Should Firebase Auth middleware ever be added?

    - **Current Answer**: NO - Memory Service is designed as internal-only service
    - **Rationale**: Authentication/authorization handled by calling services (Chat Management Service)
    - **Future Consideration**: Only if Memory Service needs to be directly accessible by frontend (not planned)

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
-   [Firebase Data Connect Documentation](https://firebase.google.com/docs/data-connect)
-   [Firebase Data Connect GraphQL Schema](https://firebase.google.com/docs/data-connect/graphql-schema)
-   [mem0.ai API Reference](https://docs.mem0.ai/api-reference)
-   [12-Factor App Principles](https://12factor.net/)
