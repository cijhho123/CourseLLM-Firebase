# Memory Service External Dependencies

Technical Reference Document

---

## 1. Overview

The Memory Service requires integration with external Chat and User services to retrieve conversation data for memory synthesis. This document defines the required service contracts.

---

## 2. Chat Service

**Purpose:** Provides chat conversations with messages for memory synthesis.

### Required Method

| Method | Input | Output |
|--------|-------|--------|
| `findChatWithMessages` | `chatId: string` | `ChatWithMessages \| null` |

### Response Format: ChatWithMessages

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique chat identifier |
| `userId` | `string` | User who owns the chat |
| `title` | `string \| null` | Optional chat title |
| `messages` | `Array<Message>` | Chat messages |

### Message Format

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Message text |
| `sender` | `string` | Message sender identifier |

---

## 3. User Service

**Purpose:** Validates user existence before retrieving or creating memories.

### Required Method

| Method | Input | Output |
|--------|-------|--------|
| `findUser` | `userId: string` | `User \| null` |

### Response Format: User

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique user identifier |
| `name` | `string` | User display name |
| `role` | `string` | User role (e.g., student, teacher) |

---

## 4. Memory Repository

**Purpose:** Stores synthesized memories. Two implementations available:

### Option A: PrismaMemoryRepository (Local/Default)

Uses Prisma ORM with local PostgreSQL.

**Location:** `src/database/prisma-memory.repository.ts`

**Env Vars:**
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Prisma connection string |

---

### Option B: GoogleCloudMemoryRepository (Google Cloud SQL)

Direct PostgreSQL connection to Google Cloud SQL.

**Location:** `src/database/google-cloud-memory.repository.ts`

**Env Vars:**

| Variable | Description | Default |
|----------|-------------|---------|
| `GCP_SQL_CONNECTION_NAME` | Cloud SQL instance (e.g., `project:region:instance`) | - |
| `GCP_SQL_USER` | Database username | `postgres` |
| `GCP_SQL_PASSWORD` | Database password | - |
| `GCP_SQL_DATABASE` | Database name | `memory_db` |
| `GCP_SQL_HOST` | Host (for local testing) | `localhost` |
| `GCP_SQL_PORT` | Port (for local testing) | `5432` |

**Auto-detection:** When running on Cloud Run (`K_SERVICE` env var present), uses Unix socket `/cloudsql/{connection_name}`.

---

## 5. Integration Summary

| Service | Method | Required |
|---------|--------|----------|
| Chat Service | `findChatWithMessages(chatId)` | Yes |
| User Service | `findUser(userId)` | Yes |
| Memory Repository | `create(data)`, `findByUserId(userId)` | Yes |

---