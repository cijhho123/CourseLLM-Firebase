# Memory Service Specification

## Overview

The Memory Service is a **lightweight microservice** that ONLY synthesizes and retrieves semantic memories. It does NOT handle user registration, message storage, or conversation management.

**Purpose**: Extract meaningful learning insights from conversations and provide them for AI personalization.

**Location**: `src/services/memory-service/`

**Technology Stack**: NestJS, TypeScript, PostgreSQL (for memory metadata only), Prisma ORM, mem0.ai SDK

**Scope**:

-   ✅ Synthesize memories from conversations
-   ✅ Retrieve memories for users
-   ❌ User registration (handled by Chat Service)
-   ❌ Message storage (handled by Chat Service)
-   ❌ Conversation management (handled by Chat Service)

---

## Requirements

### Requirement: Memory Synthesis

The Memory Service SHALL synthesize meaningful memories from conversation history using mem0.ai.

#### Scenario: Synthesize memories from conversation

-   **GIVEN** a conversation with meaningful student interactions exists in Chat Service
-   **WHEN** `POST /api/v1/memory/synthesize` is called with chatID
-   **THEN** Memory Service fetches conversation via IChatService interface
-   **AND** at least 1 relevant memory is created
-   **AND** memories are stored in both PostgreSQL and mem0.ai
-   **AND** response includes success status, memoriesCreated count, and memory descriptions

#### Scenario: Synthesize with query focus

-   **GIVEN** a conversation about learning preferences
-   **WHEN** `POST /api/v1/memory/synthesize` is called with query="learning preferences"
-   **THEN** synthesis focuses on extracting preference-related insights
-   **AND** relevant memories about preferences are created

#### Scenario: Memory synthesis for empty conversation

-   **GIVEN** a conversation with no messages
-   **WHEN** `POST /api/v1/memory/synthesize` is called
-   **THEN** response returns success=true, memoriesCreated=0, memories=[]
-   **AND** no errors are thrown

#### Scenario: Memory synthesis failure

-   **GIVEN** mem0.ai service is unavailable
-   **WHEN** `POST /api/v1/memory/synthesize` is called
-   **THEN** synthesis fails gracefully
-   **AND** response includes success=false and error message
-   **AND** service continues to operate for other requests

#### Scenario: Invalid chat ID

-   **GIVEN** a non-existent chatID
-   **WHEN** `POST /api/v1/memory/synthesize` is called
-   **THEN** a 404 Not Found error is returned
-   **AND** error message indicates chat not found

---

### Requirement: Memory Retrieval

The Memory Service SHALL provide retrieval of synthesized memories for users.

#### Scenario: Retrieve user memories

-   **GIVEN** a user with synthesized memories
-   **WHEN** `GET /api/v1/memory/users/:userID/memories` is called
-   **THEN** all user's memories are returned
-   **AND** memories are ordered by createdAt descending (newest first)
-   **AND** each memory includes memoryID, content, createdAt, relatedChats

#### Scenario: Retrieve memories for user with no memories

-   **GIVEN** a user with no memories
-   **WHEN** `GET /api/v1/memory/users/:userID/memories` is called
-   **THEN** an empty memories array is returned
-   **AND** response status is 200

#### Scenario: Invalid user ID

-   **GIVEN** a non-existent userID
-   **WHEN** `GET /api/v1/memory/users/:userID/memories` is called
-   **THEN** a 404 Not Found error is returned
-   **AND** error message indicates user not found

---

### Requirement: Data Isolation

The Memory Service SHALL ensure strict data isolation between users.

#### Scenario: User data access restriction

-   **GIVEN** multiple users with memories
-   **WHEN** retrieving memories for a specific userID
-   **THEN** only memories belonging to that user are returned
-   **AND** no cross-user data leakage occurs

#### Scenario: Memory retrieval filtering

-   **GIVEN** memories synthesized for multiple users
-   **WHEN** memories are retrieved for a specific userID
-   **THEN** only memories associated with that user are accessible
-   **AND** memories are filtered by userID in both PostgreSQL and mem0.ai queries

---

### Requirement: Error Handling

The Memory Service SHALL provide consistent error responses with appropriate HTTP status codes.

#### Scenario: Not found errors

-   **GIVEN** a request for non-existent resource (chatID, userID)
-   **WHEN** any endpoint is called
-   **THEN** a 404 Not Found status is returned
-   **AND** error message describes what was not found

#### Scenario: Validation errors

-   **GIVEN** missing or invalid required fields
-   **WHEN** any POST endpoint is called
-   **THEN** a 400 Bad Request status is returned
-   **AND** validation errors are detailed in response

#### Scenario: External service errors

-   **GIVEN** mem0.ai API is unavailable
-   **WHEN** synthesis endpoint is called
-   **THEN** synthesis fails gracefully
-   **AND** error response indicates external service failure
-   **AND** other operations continue to work

---

### Requirement: Health Monitoring

The Memory Service SHALL expose health endpoints for monitoring.

#### Scenario: Health check

-   **GIVEN** the service is running
-   **WHEN** `GET /health` is called
-   **THEN** response includes status "ok"
-   **AND** response status is 200

#### Scenario: Database health check

-   **GIVEN** the service is running
-   **WHEN** `GET /health` is called
-   **THEN** database connectivity status is included
-   **AND** if database is unreachable, status indicates degraded state

---

## Data Model

### Memories Table (PostgreSQL)

```sql
CREATE TABLE memories (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    mem0_memory_id VARCHAR(255),
    source_chat_ids TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
```

**Note**: Users, Chats, and Messages are NOT stored in Memory Service. They are managed by Chat Service.

---

## API Endpoints

All endpoints are prefixed with `/api/v1/memory`.

### POST /synthesize

Synthesize memories from a conversation using mem0.ai.

**Request Body:**

```json
{
    "chatID": "string",
    "query": "string" // optional focus area
}
```

**Response (200 OK):**

```json
{
    "success": true,
    "memoriesCreated": 3,
    "memories": [
        "Student prefers visual learning methods",
        "Struggles with calculus integration concepts",
        "Responds well to real-world examples"
    ]
}
```

**Response (404 Not Found):**

```json
{
    "statusCode": 404,
    "message": "Chat not found",
    "error": "Not Found"
}
```

**Response (500 Internal Server Error - mem0.ai failure):**

```json
{
    "success": false,
    "memoriesCreated": 0,
    "memories": [],
    "error": "Failed to connect to mem0.ai API"
}
```

---

### GET /users/:userID/memories

Retrieve all synthesized memories for a user.

**Path Parameters:**

-   `userID` - User identifier

**Response (200 OK):**

```json
{
    "memories": [
        {
            "memoryID": "mem_xyz789",
            "content": "Student demonstrates understanding of calculus concepts",
            "createdAt": "2025-11-20T10:30:00.000Z",
            "relatedChats": ["chat_abc123", "chat_def456"]
        }
    ]
}
```

**Response (404 Not Found):**

```json
{
    "statusCode": 404,
    "message": "User not found",
    "error": "Not Found"
}
```

---

## Integration Points

### Position in Application Flow

The Memory Service is a **specialized service** called by Chat Service to synthesize and retrieve memories:

```
Current Implementation (MVP):
1. Firebase Auth → Authenticates student
2. Next.js Chat UI → Student asks question (messages stored in UI state)
3. Socratic Chat Flow (AI) → Generates AI response (no memory context yet)
4. [External Trigger] → Calls Memory Service POST /synthesize
5. Memory Service → Fetches conversation via IChatService
6. Memory Service → Synthesizes memories via mem0.ai
7. Memory Service → Stores memories in PostgreSQL + mem0.ai
8. [Future] → GET /users/:userID/memories retrieves personalized insights

Future Full Integration:
1. Chat Service → Manages users, messages, conversations
2. Chat Service → Triggers POST /synthesize after N messages
3. Memory Service → Synthesizes and stores memories
4. Chat Service → Calls GET /users/:userID/memories before AI response
5. Socratic Chat Flow → Receives memory context for personalization
6. AI → Generates context-aware personalized responses
```

### Current Implementation Status

**✅ Implemented:**

-   `POST /api/v1/memory/synthesize` - Memory synthesis from conversations
-   `GET /api/v1/memory/users/:userID/memories` - Retrieve user memories
-   PostgreSQL schema for memories only
-   mem0.ai integration for semantic memory storage
-   Health check endpoint

**⏳ Not Implemented (Handled by Chat Service):**

-   User registration
-   Message saving
-   Conversation retrieval
-   Conversation listing

**Current Architecture Note:**
The Memory Service defines service interfaces (`IChatService`, `IUserService`) to fetch data from external services. These must be implemented by Chat Service or mocked for testing.

### External Dependencies

**1. Chat Service** (Primary Data Provider)

-   **Purpose**: Provides conversation data for synthesis
-   **Integration**: Memory Service calls IChatService.findChatWithMessages(chatID)
-   **Data Required**: chatID, userID, messages array
-   **Responsibility**: Chat Service manages users, conversations, messages
-   **When**: Called during POST /synthesize to fetch conversation

**2. mem0.ai API** (https://mem0.ai/)

-   **Purpose**: Semantic memory synthesis and vector storage
-   **API Key**: Required in `MEM0_API_KEY` environment variable
-   **Integration**: Called during `/synthesize` endpoint
-   **Rate Limits**: Must monitor quota (external service dependency)
-   **Resilience**: Service continues without mem0 (synthesis fails gracefully)

**3. PostgreSQL Database**

-   **Purpose**: Stores memory metadata only (not full conversations)
-   **Connection**: `DATABASE_URL` environment variable
-   **Schema Management**: Prisma migrations
-   **Version**: PostgreSQL 15+
-   **Extensions**: None required (standard SQL features only)

### Internal Dependencies

**1. Socratic Chat Flow** ([`src/ai/flows/socratic-course-chat.ts`](../../../src/ai/flows/socratic-course-chat.ts))

-   **Current State**: No memory integration (stateless conversations, no persistence)
-   **Current Memory Service Endpoints Available**:
    -   `POST /api/v1/memory/synthesize` - Can be called to extract memories
    -   `GET /api/v1/memory/users/:userID/memories` - Can retrieve synthesized memories for context
-   **Future Integration**:
    -   Chat Service retrieves memories before calling AI flow
    -   Memories included in AI context for personalization
-   **Current Limitation**: Message storage/retrieval handled externally

**2. Chat Panel UI** ([`src/app/student/courses/[courseId]/_components/chat-panel.tsx`](../../../src/app/student/courses/[courseId]/_components/chat-panel.tsx))

-   **Current State**: Stores messages in React state (ephemeral, lost on refresh)
-   **Current Capability**: Could call `GET /api/v1/memory/users/:userID/memories` to display learning insights
-   **Future Integration**: Chat Service manages message persistence
-   **Current Limitation**: No conversation persistence available

**3. Student Profile Manager** (Future Feature)

-   **Purpose**: Display personalized learning insights
-   **Integration**: ✅ **Can use current endpoint** `GET /api/v1/memory/users/:userID/memories`
-   **Available Now**: Retrieve synthesized memories for a student
-   **Use Cases**:
    -   Show learning preferences (from synthesized memories)
    -   Highlight strengths and weaknesses
    -   Personalize assessment generation based on memory insights

**4. Memory Synthesis Orchestrator** (Can Implement Now)

-   **Purpose**: Trigger memory synthesis for conversations
-   **Integration**: ✅ **Available endpoint** `POST /api/v1/memory/synthesize`
-   **Input Required**:
    -   `chatID` - Must exist in Chat Service
    -   `query` - Optional focus (e.g., "learning preferences", "misconceptions")
-   **Triggers** (recommended):
    -   After every 10-15 messages in a conversation
    -   Before generating personalized assessments
    -   On-demand when student profile is viewed
    -   Nightly batch job for all active conversations
-   **Prerequisites**:
    -   Chat and message data must exist in Chat Service
    -   IChatService implementation must be able to fetch the conversation

### Security Architecture

**⚠️ CRITICAL: Memory Service has NO built-in authentication**

```
Security Model:
┌─────────────────────────────────────────────┐
│  Public Internet                             │
│  ❌ NO DIRECT ACCESS TO MEMORY SERVICE       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │ Firebase Auth    │ ✅ Authentication here
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Chat Service     │ ✅ Validates user tokens
        │ (Next.js/Genkit) │    Manages data
        └────────┬─────────┘
                 │
                 │ Internal Network Only
                 ▼
        ┌──────────────────┐
        │ Memory Service   │ ❌ NO auth checks
        │ (Firewall Only)  │ 🔒 userID-based isolation
        └──────────────────┘
```

**Deployment Requirements:**

-   ✅ **VPC/Private Network**: Deploy behind firewall, NOT publicly accessible
-   ✅ **Internal DNS Only**: No public domain/IP for Memory Service
-   ✅ **Trust Boundary**: Only authenticated services can reach Memory Service
-   ✅ **Data Isolation**: Memory Service enforces userID-based segregation
-   ❌ **NO API Keys**: Service trusts all internal callers (by network design)

**Why No Auth?**

-   Simplifies internal service-to-service communication
-   Authentication handled at API gateway (Chat Service/Firebase Auth)
-   Firewall provides network-level security
-   Reduces latency (no token validation overhead)

---

## Quality Constraints

### Privacy

-   User data MUST be isolated by userID
-   No cross-user data access permitted
-   Sensitive data not logged in error messages
-   mem0.ai queries MUST include userID filter

### Consistency

-   Database transactions MUST maintain ACID properties
-   Memories MUST be correctly associated with source chats
-   Timestamp metadata MUST be accurate

### Availability

-   Service MUST handle mem0.ai downtime gracefully
-   Database connection pool MUST be configured for high availability
-   Health endpoints MUST report degraded state on dependency failures

### Performance

-   Memory synthesis SHOULD complete within 5 seconds for typical conversations
-   Memory retrieval MUST use database indexes efficiently
-   Service SHOULD handle concurrent requests from multiple users

### Security

-   Input validation MUST prevent SQL injection
-   Error responses MUST not expose sensitive system details
-   Database credentials MUST be environment-based, never committed
-   Service MUST be deployed behind firewall (internal network only)
-   Data isolation MUST be enforced via userID parameter validation

---

## Test Plan

### Integration Testing Strategy

**Phase 1: Memory Synthesis**

1. **Basic Synthesis**

    - Test: Call POST /synthesize with valid chatID
    - Verify: Memories created and stored
    - Success Criteria: memoriesCreated > 0, memories array not empty

2. **Synthesis with Query Focus**

    - Test: Call POST /synthesize with query parameter
    - Verify: Memories focus on specified topic
    - Success Criteria: Relevant memories generated

3. **Empty Conversation**

    - Test: Call POST /synthesize for conversation with no messages
    - Verify: Returns success with 0 memories
    - Success Criteria: No errors, memoriesCreated = 0

4. **Invalid Chat ID**
    - Test: Call POST /synthesize with non-existent chatID
    - Verify: 404 Not Found error
    - Success Criteria: Clear error message

**Phase 2: Memory Retrieval**

1. **Retrieve User Memories**

    - Test: Call GET /users/:userID/memories
    - Verify: All memories for user returned
    - Success Criteria: Correct ordering (newest first), complete data

2. **User with No Memories**

    - Test: Call GET /users/:userID/memories for user with no memories
    - Verify: Empty array returned, 200 status
    - Success Criteria: No errors

3. **Invalid User ID**
    - Test: Call GET /users/:userID/memories with non-existent userID
    - Verify: 404 Not Found error
    - Success Criteria: Clear error message

**Phase 3: Data Isolation**

1. **User Data Isolation**

    - Test: Create memories for User A and User B
    - Attempt: User A retrieves their memories
    - Expected: Only User A's memories returned (no cross-user leak)
    - Success Criteria: Zero cross-user data exposure

2. **Memory Synthesis Isolation**
    - Test: Synthesize memories for different users
    - Verify: Each memory correctly associated with userID
    - Success Criteria: No memory mis-attribution

**Phase 4: Error Handling**

1. **mem0.ai API Failure**

    - Test: Simulate mem0.ai downtime during synthesis
    - Expected: Synthesis fails gracefully with error message
    - Verify: Service continues operating for other requests
    - Success Criteria: Clear error, no crash

2. **Database Connection Failure**
    - Test: Disconnect PostgreSQL during request
    - Expected: 500 Internal Server Error with generic message
    - Verify: Health endpoint reports degraded state
    - Success Criteria: Graceful error handling

### API Dependency Documentation

**Required Environment Variables:**

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://user:password@host:5432/memory_service

# mem0.ai Integration
MEM0_API_KEY=mem0_xxxxxxxxxxxx

# Service Configuration
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

**Runtime Dependencies:**

-   Node.js 18+
-   PostgreSQL 15+
-   Network access to mem0.ai API (https://api.mem0.ai)
-   Internal network routing from Chat Service

**Startup Sequence:**

1. Load environment variables
2. Initialize Prisma (connect to PostgreSQL)
3. Run database migrations (if needed)
4. Initialize mem0.ai client
5. Start NestJS application
6. Register health check endpoint
7. Log startup completion

**Health Check Dependencies:**

-   `/health` endpoint checks PostgreSQL connectivity
-   Reports degraded state if database unreachable
-   Does NOT check mem0.ai (optional dependency)

---

## Assumptions

1. Chat Service provides conversation data via IChatService interface
2. User IDs from Chat Service are globally unique and immutable
3. Conversations are text-only (no multimedia in MVP)
4. Average conversation contains 50-200 messages
5. Memory synthesis is triggered by Chat Service or external orchestrator
6. mem0.ai API has sufficient rate limits for production usage
7. PostgreSQL can handle expected write load (estimated 1-2 syntheses/minute)
8. **Memory Service is deployed in private network behind firewall**
9. **All calls to Memory Service come from authenticated upstream services**
10. **Chat Service validates user identity before calling Memory Service**

---

## Out of Scope

-   User registration (Chat Service responsibility)
-   Message storage (Chat Service responsibility)
-   Conversation management (Chat Service responsibility)
-   Message editing or deletion
-   Real-time updates via WebSockets
-   Multi-user conversation sharing
-   Advanced analytics dashboard
-   Voice/multimedia message support
-   Automatic memory decay or forgetting mechanisms
-   Multi-language support (English only in MVP)
-   Built-in authentication/authorization (handled upstream)
-   Public API exposure (internal service only)
-   Rate limiting (assumed low traffic for MVP)
