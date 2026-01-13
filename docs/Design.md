# Memory Service - Feature Design & Integration

## Overview

A lightweight microservice that **ONLY** synthesizes and retrieves semantic memories for personalized learning. Does NOT handle user registration, message storage, or conversation management.

**Core Responsibility:**

-   Extract meaningful learning insights from conversations (via mem0.ai)
-   Store and retrieve synthesized memories for student personalization

**What Memory Service Does:**
✅ Synthesize memories from existing conversation data
✅ Retrieve memories for a user
✅ Store memory metadata in PostgreSQL

**What Memory Service Does NOT Do:**
❌ User registration (handled by Chat Service)
❌ Message storage (handled by Chat Service)
❌ Conversation management (handled by Chat Service)
❌ Authentication (handled upstream by Chat Service + firewall)

**Core Technology:**

-   mem0.ai (https://mem0.ai/) - Semantic memory synthesis and vector storage
-   PostgreSQL - Stores memory metadata only
-   NestJS - Service framework with TypeScript

**Research Foundation:**

-   Memory in AI: https://github.com/Elvin-Yiming-Du/Survey_Memory_in_AI
-   Context Engineering: https://rlancemartin.github.io/2025/06/23/context_engineering/

## Architecture Context

### Position in CourseWise Platform

The Memory Service is a **specialized service** called by the Chat Service to synthesize and retrieve memories:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Firebase   │────▶│   Next.js    │────▶│   Chat Service  │
│    Auth     │     │   Chat UI    │     │  (manages users,│
└─────────────┘     └──────────────┘     │   messages,     │
                                          │   conversations)│
                                          └────────┬────────┘
                                                   │
                                                   │ Calls when needed:
                                                   │ - Synthesize memories
                                                   │ - Retrieve memories
                                                   ▼
                                          ┌──────────────────┐
                                          │  Memory Service  │
                                          │  (ONLY memories) │
                                          │                  │
                                          │  2 endpoints:    │
                                          │  • POST synth.   │
                                          │  • GET memories  │
                                          └──────────────────┘
```

### Integration Points

**1. Chat Service (Primary Caller)**

-   **When to Call Memory Service**:
    -   After 10-15 messages in conversation → `POST /api/v1/memory/synthesize`
    -   Before generating personalized content → `GET /api/v1/memory/users/:userID/memories`
-   **Chat Service Responsibilities**:
    -   Stores users, messages, conversations
    -   Authenticates requests
    -   Provides conversation data to Memory Service for synthesis
    -   Uses retrieved memories to personalize AI responses

**2. Socratic Chat Flow** ([`src/ai/flows/socratic-course-chat.ts`](../src/ai/flows/socratic-course-chat.ts))

-   **Current Integration**: None (stateless conversations)
-   **Future Integration**:
    -   Chat Service retrieves memories before calling AI flow
    -   Memories included in AI context for personalization
    -   AI generates responses aware of student learning patterns

**3. Student Profile Manager** (Future Feature)

-   **Integration**: Call `GET /api/v1/memory/users/:userID/memories`
-   **Use Case**: Display learning preferences, strengths, areas for improvement

### Security & Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Public Internet                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Firebase Auth      │ ✅ Authentication here
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Chat Service       │ ✅ Validates users
                │   (Next.js/Genkit)   │    Manages data
                └──────────┬───────────┘
                           │
                           │ Internal Network Only
                           ▼
                ┌──────────────────────┐
                │   Memory Service     │◄────── NO PUBLIC ACCESS
                │   (NestJS)           │        FIREWALL PROTECTED
                │   Port: 3001         │        Internal calls only
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   PostgreSQL DB      │
                │   + mem0.ai API      │
                └──────────────────────┘
```

**Security Model:**

-   ❌ **NO authentication** on Memory Service endpoints (by design)
-   🔥 **Firewall-only protection**: Memory Service accessible only from Chat Service
-   ✅ **Authentication upstream**: Chat Service validates user via Firebase Auth
-   🔒 **Data isolation**: Memory Service receives userID from trusted Chat Service
-   🚫 **Deployment constraint**: Must deploy behind VPC/private network

## API Functionality

### Implemented Endpoints

**1. Synthesize Memories** - `POST /api/v1/memory/synthesize`

-   **Caller**: Chat Service (after N messages or before personalization)
-   **Purpose**: Extract learning insights from conversation history
-   **Input**:
    -   `chatID`: Conversation to synthesize (must exist in Chat Service)
    -   `query`: Optional focus (e.g., "learning preferences", "misconceptions")
-   **Process**:
    1. Chat Service calls Memory Service with chatID
    2. Memory Service fetches conversation via IChatService interface
    3. Sends messages to mem0.ai for synthesis
    4. Stores memories in PostgreSQL + mem0.ai
-   **Output**:
    -   `success`: boolean
    -   `memoriesCreated`: integer
    -   `memories[]`: array of synthesized memory descriptions
-   **When**:
    -   After every 10-15 messages in conversation
    -   Before generating personalized assessments
    -   On-demand for profile updates

**2. Get User Memories** - `GET /api/v1/memory/users/:userID/memories`

-   **Caller**: Chat Service (before AI response) OR Student Profile UI
-   **Purpose**: Retrieve synthesized memories for personalization
-   **Input**:
    -   `userID`: User identifier (from Firebase Auth)
-   **Output**:
    -   `memories[]`: array of {memoryID, content, createdAt, relatedChats}
-   **When**:
    -   Before generating AI response (for context)
    -   When displaying student profile
    -   Before creating personalized assessment

## Basic Task Flow

1. **Student asks question** → Chat UI sends to Chat Service
2. **Chat Service** → Stores message in its own database
3. **Chat Service** → Retrieves memories from Memory Service
4. **AI Flow** → Generates response with memory context
5. **Chat Service** → Stores AI response in its own database
6. **[After N messages] Chat Service** → Calls Memory Service to synthesize new memories
7. **Memory Service** → Fetches conversation data, synthesizes memories, stores them

## Data Model (PostgreSQL - Memory Service Only)

### Memories Table

-   `id`: Primary key
-   `userId`: User identifier (from Chat Service)
-   `content`: Synthesized memory text
-   `mem0MemoryId`: Reference to mem0.ai vector storage
-   `sourceChatIds`: Array of chatIDs that contributed to this memory
-   `createdAt`: Timestamp
-   `updatedAt`: Timestamp

**Note**: Users, Chats, and Messages are stored in Chat Service database, NOT Memory Service.

## Dependencies

### Required by Memory Service

**External APIs:**

-   **mem0.ai API**: For semantic memory synthesis and vector storage
    -   Requires `MEM0_API_KEY` environment variable
    -   Handles vector embeddings and semantic search

**Database:**

-   **PostgreSQL**: Stores memory metadata
    -   Requires `DATABASE_URL` environment variable

**Service Interfaces (provided by Chat Service):**

-   **IChatService**: Fetches conversation data for synthesis
-   **IUserService**: Validates user existence
-   **IMessageService**: Not used (messages managed by Chat Service)

### Called By

**Chat Service:**

-   Triggers memory synthesis after conversations
-   Retrieves memories for AI personalization

**Student Profile UI:**

-   Displays synthesized learning insights
