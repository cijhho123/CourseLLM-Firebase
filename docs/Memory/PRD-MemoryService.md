# Product Requirements Document: Student Memory Service

**Version:** 1.0
**Last Updated:** 2025-11-20
**Owner:** = Infernobles

---

## 1. Overview

The Student Memory Service is a microservice that handles persistent memory for each student in the CourseWise platform. It stores full conversation history in PostgreSQL and uses mem0.ai to synthesize meaningful memories about students for personalized learning experiences.

**Key Purpose:** Enable the AI Socratic tutor to remember student interactions, learning patterns, and provide context-aware responses across sessions.

---

## 2. User Stories

### Primary User Stories

**US-1:** As a student, I want my conversations with the AI tutor to be saved, so I can continue where I left off in future sessions.

**US-2:** As a student, I want the AI to remember my learning preferences and struggles, so I receive personalized guidance tailored to my needs.

**US-3:** As the Socratic chat service, I need to retrieve conversation history and student memories, so I can provide contextually relevant responses.

**US-4:** As a developer, I need to store new messages and trigger memory synthesis, so the system learns from each interaction.

**US-5:** As a user management service, I need to register new users in the memory system when they join the platform.

---

## 3. Functional Requirements

### 3.1 API Endpoints

#### FR-1: Register User
**Endpoint:** `POST /api/v1/memory/register`

**Purpose:** Initialize a new user in the memory system.

**Input:**
- `userID` (string): Unique identifier from authentication service
- `name` (string): User's display name
- `role` (enum): "student" | "teacher" | "admin"
- `userInfo` (object, optional): Additional user metadata

**Output:**
- `success` (boolean): Operation status
- `message` (string): Error details if failed

**Behavior:** Idempotent - re-registering existing users returns success without duplication.

---

#### FR-2: Save Message
**Endpoint:** `POST /api/v1/memory/messages`

**Purpose:** Persist a message to a conversation.

**Input:**
- `chatID` (string, nullable): Existing conversation ID (null creates new conversation)
- `userID` (string, required if chatID is null): For new conversations
- `content` (string): Message plain text
- `sender` (enum): "user" | "assistant" | "system"
- `metadata` (object, optional): Additional context (courseID, topicID, etc.)

**Output:**
- `success` (boolean): Operation status
- `chatID` (string): Conversation identifier (existing or newly created)
- `messageID` (string): Unique message identifier
- `timestamp` (ISO 8601): When message was saved

**Behavior:**
- If `chatID` is null, create new conversation with auto-generated title
- Messages stored with sequential ordering

---

#### FR-3: Get Conversation (Paginated)
**Endpoint:** `GET /api/v1/memory/conversations/:chatID`

**Purpose:** Retrieve messages from a specific conversation with pagination.

**Input:**
- `chatID` (string): Conversation identifier
- `page` (integer, default=1): Page number (1 = newest messages)
- `pageSize` (integer, default=20): Messages per page

**Output:**
- `messages` (array): Message objects containing:
  - `messageID` (string)
  - `content` (string)
  - `sender` (enum)
  - `timestamp` (ISO 8601)
- `pagination` (object):
  - `currentPage` (integer)
  - `totalPages` (integer)
  - `totalMessages` (integer)
  - `hasNext` (boolean)
  - `hasPrevious` (boolean)

**Behavior:** Returns newest messages first (page 1 = most recent).

---

#### FR-4: Get Conversations of User
**Endpoint:** `GET /api/v1/memory/users/:userID/conversations`

**Purpose:** Retrieve all conversation metadata for a user.

**Input:**
- `userID` (string): User identifier
- `limit` (integer, optional): Max conversations to return

**Output:**
- `conversations` (array): List of conversation objects:
  - `chatID` (string)
  - `title` (string)
  - `createdAt` (ISO 8601)
  - `lastUpdatedAt` (ISO 8601)
  - `messageCount` (integer)

**Behavior:** Ordered by `lastUpdatedAt` descending (most recent first).

---

#### FR-5: Synthesize Memories
**Endpoint:** `POST /api/v1/memory/synthesize`

**Purpose:** Generate synthesized memories from conversation history using mem0.ai. Intended to be called by another service that decides when to create new memories and what to focus on.

**Input:**
- `chatID` (string): Conversation to analyze
- `query` (string, optional): Focus area for memory extraction (e.g., "learning preferences", "knowledge gaps")

**Output:**
- `success` (boolean): Operation status
- `memoriesCreated` (integer): Number of new memories
- `memories` (array of strings): Descriptions of synthesized memories

**Behavior:**
- Analyzes conversation messages based on provided query
- Extracts learning insights from the conversation
- Stores synthesized memories in mem0.ai with userID

---

## 4. Data Model

### 4.1 PostgreSQL Schema

#### Users Table
```sql
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    user_info JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Chats Table
```sql
CREATE TABLE chats (
    chat_id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 0
);

CREATE INDEX idx_chats_user_id ON chats(user_id, last_updated_at DESC);
```

#### Messages Table
```sql
CREATE TABLE messages (
    message_id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR(255) NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    sequence_number SERIAL
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id, sequence_number DESC);
```

#### Memories Table (Metadata Reference)
```sql
CREATE TABLE memories (
    memory_id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mem0_memory_id VARCHAR(255),
    source_chat_ids TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
```

### 4.2 mem0.ai Integration

**Purpose:** Vector storage and semantic search for synthesized memories.

**Key Operations:**
- `mem0.add(messages, user_id, metadata)`: Store synthesized memories
- `mem0.search(query, user_id, limit)`: Retrieve relevant memories
- `mem0.get_all(user_id)`: Get all memories for a user

**Storage Strategy:**
- PostgreSQL stores conversation data and memory metadata
- mem0.ai stores embeddings for semantic search
- Bidirectional sync between PostgreSQL `memories` table and mem0.ai

---

## 5. Acceptance Criteria

### 5.1 Functional Acceptance

**AC-1:** User Registration
- Given a new user with valid userID
- When `registerUser` is called
- Then user record is created in PostgreSQL
- And duplicate registration returns success without error

**AC-2:** Message Persistence
- Given a valid chatID and message content
- When `saveMessage` is called
- Then message is stored with correct timestamp and sequence
- And messageID is returned

**AC-3:** New Conversation Creation
- Given chatID is null and userID is provided
- When `saveMessage` is called
- Then new conversation is created with generated chatID
- And conversation title is auto-generated

**AC-4:** Conversation Retrieval
- Given a conversation with 50 messages
- When `getConversation` is called with page=1
- Then most recent 20 messages are returned in descending order
- And pagination metadata is accurate

**AC-5:** User Conversations List
- Given a user with multiple conversations
- When `getConversationsOfUser` is called
- Then all user's conversations are returned
- And ordered by most recent activity first

**AC-6:** Memory Synthesis
- Given a conversation with meaningful student interactions
- When `synthesizeMemories` is called
- Then at least 1 relevant memory is created
- And memories are stored in both PostgreSQL and mem0.ai

### 5.2 Non-Functional Acceptance

**AC-7:** Performance
- GET endpoints respond with low latency
- POST endpoints respond with acceptable latency
- Memory synthesis completes in reasonable time

**AC-8:** Data Isolation
- Users can only access their own conversations
- Memory retrieval filtered by userID
- No cross-user data leakage

**AC-9:** Error Handling
- Invalid chatID returns 404
- Missing required fields returns 400
- Database errors return 500 with error message

---

## 6. Dependencies

### 6.1 External Dependencies

| Dependency | Purpose | Criticality |
|------------|---------|-------------|
| Firebase Authentication | User identity verification | High |
| mem0.ai API | Memory synthesis and semantic search | Medium |
| PostgreSQL Database | Data persistence | Critical |

### 6.2 Internal Dependencies

| Service | Integration Point |
|---------|-------------------|
| Socratic Chat Service | Calls memory service to retrieve conversation history for context |
| User Management Service | Sends userID to register new users |
| Memory Orchestration Service | Decides when to trigger memory synthesis and what query to use |


### 6.3 Technology Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js or NestJS
- **Database:** PostgreSQL 15+
- **ORM:** Prisma or TypeORM
- **Memory Engine:** mem0.ai SDK
- **Testing:** Jest + Supertest
- **Deployment:** Firebase Cloud Functions or Cloud Run

---

## 7. Assumptions

**A-1:** User IDs from authentication service are globally unique and immutable.

**A-2:** Messages are text-only (no multimedia in MVP).

**A-3:** Conversation titles can be auto-generated from first message content.

**A-4:** Average conversation contains 50-200 messages.

**A-5:** Memory synthesis is triggered on-demand by an external orchestration service.

**A-6:** mem0.ai API has sufficient rate limits for production usage.

**A-7:** PostgreSQL can handle expected write load (estimated 10 messages/second peak).

**A-8:** Messages are immutable once saved (no editing or deletion in MVP).

---

## 8. Out of Scope

**OS-1:** Real-time updates via WebSockets (polling only)

**OS-2:** Message editing or deletion

**OS-3:** Multi-user conversation sharing

**OS-4:** Advanced analytics dashboard for teachers

**OS-5:** Voice/multimedia message support

**OS-6:** Automatic memory decay or forgetting mechanisms

**OS-7:** Multi-language support (English only in MVP)

---

## 9. Success Metrics

### Technical KPIs
- High API success rate with minimal failures
- Fast response times for read and write operations
- Memory synthesis produces relevant and accurate insights

### Business KPIs
- Conversation context demonstrates continuity across sessions
- Student satisfaction with personalized learning experience
- Retrieved memories are contextually useful for AI responses

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| mem0.ai service downtime | High | Implement caching layer; queue synthesis jobs |
| Database connection exhaustion | High | Connection pooling; auto-scaling |
| Privacy violation | Critical | Strict access controls; audit logging |
| Memory synthesis quality issues | Medium | Validation; confidence scoring |

---

## 11. Running the Service

### Step 1: Start the Data Connect Emulator

From the **root** `CourseLLM-Firebase` directory:

```bash
firebase emulators:start --only dataconnect
```

This will:
- Start the Data Connect emulator on `127.0.0.1:9399`
- Start a local PostgreSQL instance for the emulator
- Generate TypeScript code for database operations

### Step 2: Start the Memory Service

From the `src/services/memory-service` directory:

**Option A: Development Mode (recommended for testing)**
```bash
npm run start:dev
```

**Option B: Standard Start**
```bash
npm run start
```

**Option C: Docker (production-like)**
```bash
docker-compose up
```

### Step 3: Access Swagger UI

Once the service is running, access the API documentation at:
```
http://localhost:3001/api/docs
```

### Environment Variables

Ensure `.env` file exists in `src/services/memory-service/` with:

```env
MEM0_API_KEY=your_mem0_api_key
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399
```

## Appendix: Related Research

- **mem0.ai Documentation:** https://docs.mem0.ai/api-reference
- **Memory in AI Survey:** https://github.com/Elvin-Yiming-Du/Survey_Memory_in_AI
- **Context Engineering:** https://rlancemartin.github.io/2025/06/23/context_engineering/

