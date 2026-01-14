# CourseLLM Platform - Memory Service Integration Proposal

**Version**: 1.0.0
**Date**: January 14, 2026
**Status**: Approved and Implemented
**Team**: Memory Service Integration Team

---

## Executive Summary

This proposal describes the integration of a persistent Memory Service into the CourseLLM (CourseWise) educational platform. The Memory Service enables AI-powered personalized learning by maintaining conversation history across sessions and synthesizing meaningful insights about student learning patterns.

**Implementation Status**: MVP Complete

---

## Problem Statement

### Current State

The CourseWise platform provides AI-powered Socratic tutoring via Google Genkit and Gemini 2.5 Flash, but currently lacks persistent memory across sessions:

1. **No Conversation Continuity**: Each AI conversation starts fresh with no context
2. **Lost Learning Insights**: Information about student struggles and preferences is discarded
3. **Inefficient Tutoring**: AI cannot adapt based on historical interactions
4. **Poor User Experience**: Modern AI systems (ChatGPT, Claude) have set expectations for memory

### Impact

- Students must re-explain their background in every session
- Teachers have no visibility into AI-student interactions
- AI cannot build on previous successful teaching approaches
- Platform lacks competitive features of commercial AI tutors

---

## Proposed Solution

### Feature: Persistent Conversational Memory

Add a standalone microservice that:
1. **Stores All Conversations**: Complete message history for every student-AI interaction
2. **Provides Context to AI**: Recent conversation history for personalized responses
3. **Synthesizes Memories**: Uses mem0.ai to extract learning insights
4. **Enables Analytics**: Teachers can review student learning patterns (future)

### Architecture Decision

**Microservice vs. Monolith**: Chose microservice architecture because:
- Independent scaling from main application
- Specialized technology stack (PostgreSQL for relational data)
- Clear service boundaries for team development
- Easier testing in isolation

**Technology Stack**:
- **Runtime**: NestJS (TypeScript) - consistent with platform
- **Database**: PostgreSQL with Prisma ORM - relational model for conversations
- **Memory Engine**: mem0.ai SDK - semantic memory synthesis
- **Documentation**: OpenAPI/Swagger - auto-generated API docs

---

## What We Built

### Memory Service (NestJS Microservice)

**Location**: `src/services/memory-service/`

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/memory/register` | POST | Initialize users in memory system |
| `/api/v1/memory/messages` | POST | Save conversation messages |
| `/api/v1/memory/conversations/:chatID` | GET | Retrieve conversation history |
| `/api/v1/memory/users/:userID/conversations` | GET | List user's conversations |
| `/api/v1/memory/synthesize` | POST | Generate learning insights |
| `/api/v1/memory/users/:userID/memories` | GET | Retrieve synthesized memories |
| `/health` | GET | Service health check |

**Database Schema**:

```
users
├── user_id (PK)
├── name
├── role (student/teacher)
└── created_at

chats
├── chat_id (PK)
├── user_id (FK)
├── title
├── created_at
└── updated_at

messages
├── message_id (PK)
├── chat_id (FK)
├── content
├── sender (user/assistant/system)
├── sequence_number
└── created_at

memories
├── memory_id (PK)
├── user_id (FK)
├── content
├── mem0_memory_id
├── source_chat_ids (JSON)
└── created_at
```

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  Student Dashboard → Course Chat → AI Tutoring Interface    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
┌────────────────────────────────────────────────────────────┐
│                Firebase Authentication                       │
│                (Google OAuth)                                │
└────────────────────────────┬───────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         v                   v                   v
┌─────────────────┐  ┌───────────────┐  ┌─────────────────────┐
│    Firestore    │  │  Genkit AI    │  │   Memory Service    │
│  (User Data,    │  │   Flows       │  │     (NestJS)        │
│   Courses)      │  │  (Socratic    │  │                     │
│                 │  │   Tutoring)   │  │  ┌───────────────┐  │
└─────────────────┘  └───────────────┘  │  │  PostgreSQL   │  │
                                        │  └───────────────┘  │
                                        │  ┌───────────────┐  │
                                        │  │   mem0.ai     │  │
                                        │  └───────────────┘  │
                                        └─────────────────────┘
```

---

## How It Fits in the Platform

### Application Flow

```
1. Student logs in (Firebase Auth)
         │
         v
2. Student navigates to course
         │
         v
3. Student opens AI chat panel
         │
         v
4. Student sends message
         │
         ├─────────────────────────────────────┐
         │                                     │
         v                                     v
5. [PLANNED] Save message to           6. Generate AI response
   Memory Service                          (Genkit + Gemini)
         │                                     │
         │                                     │
         v                                     v
7. [PLANNED] Get conversation          8. AI uses conversation
   history for context                    context for personalization
         │                                     │
         └─────────────────────────────────────┘
                        │
                        v
9. [PLANNED] Save AI response to Memory Service
                        │
                        v
10. Display conversation in UI
                        │
                        v
11. [FUTURE] Periodic memory synthesis extracts learning insights
```

### What Comes Before Memory Service

1. **Firebase Authentication**: User must be authenticated
2. **User Profile**: User data stored in Firestore
3. **Course Selection**: Student navigates to specific course
4. **Chat Interface**: Frontend chat panel opened

### What Comes After Memory Service

1. **AI Response Generation**: Genkit flow uses conversation context
2. **Display in UI**: Frontend shows updated conversation
3. **Memory Synthesis**: Background job extracts learning insights
4. **Teacher Analytics**: (Future) Dashboard shows student patterns

### Integration with Other PRs

| Team PR | Integration Point | Status |
|---------|------------------|--------|
| File Upload | Store file references in conversation metadata | Planned |
| Document Chunking | Memory references chunked content in context | Planned |
| Search Service | Search conversation history | Planned |
| Authentication | Receive userID from auth flow | Ready |

---

## What AI Generated vs. Manual Work

### AI-Generated (Approximately 60%)

- NestJS module scaffolding (controllers, services, modules)
- Prisma schema initial draft
- Docker Compose configuration
- Swagger/OpenAPI decorators
- README documentation structure
- Test scaffolding (Jest setup)
- Error handling boilerplate

### Manually Written/Refined (Approximately 40%)

- Architecture decisions (microservice vs. monolith)
- Database schema optimization (indexes, constraints)
- Security model (service-to-service trust)
- Integration design (how Memory Service connects to platform)
- OpenSpec documentation (this proposal, design decisions)
- Code cleanup ("de-slopping" AI-generated verbosity)
- Test logic (realistic test scenarios, edge cases)

### What AI Did Well

1. **Boilerplate Generation**: NestJS modules generated quickly and correctly
2. **Documentation**: Structured README and API docs
3. **Docker Configuration**: Working Docker Compose on first try
4. **Type Definitions**: TypeScript interfaces and DTOs

### What Required Manual Intervention

1. **Architecture Decisions**: AI suggested over-engineered solutions
2. **Security Design**: AI didn't understand network isolation model
3. **Query Optimization**: AI generated N+1 query problems
4. **Integration Logic**: AI couldn't understand platform-specific context
5. **Code Cleanup**: AI generated verbose, redundant code ("slop")

---

## Trade-offs and Decisions

### Decision 1: Separate Microservice

**Choice**: Standalone NestJS service
**Alternative**: Next.js API routes
**Why This Choice**:
- Independent scaling
- PostgreSQL better for relational conversation data
- Clear service boundaries
- Easier to test in isolation

### Decision 2: PostgreSQL over Firestore

**Choice**: PostgreSQL with Prisma
**Alternative**: Continue using Firestore
**Why This Choice**:
- Better for relational data (users → chats → messages)
- ACID transactions for message ordering
- Efficient JOINs and pagination
- Full-text search capability

### Decision 3: No Auth in Memory Service

**Choice**: Service-to-service trust model
**Alternative**: Firebase Auth verification in Memory Service
**Why This Choice**:
- Simpler architecture
- Network isolation provides security
- Faster request processing
- Clear separation of concerns

### Decision 4: Dual Storage (PostgreSQL + mem0.ai)

**Choice**: Store in both PostgreSQL and mem0.ai
**Alternative**: Only mem0.ai
**Why This Choice**:
- Resilience to mem0.ai outages
- PostgreSQL for reliable queries
- mem0.ai for semantic search
- No vendor lock-in

---

## Risks and Mitigations

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| mem0.ai availability | High | Mock implementation, graceful degradation | Mitigated |
| Database performance | Medium | Proper indexes, connection pooling | Mitigated |
| Integration complexity | Medium | OpenAPI docs, clear contracts | Mitigated |
| Data privacy | High | User isolation in all queries | Mitigated |
| Cost overruns | Low | Start minimal, monitor usage | Monitoring |

---

## Success Metrics

### Technical Metrics (Achieved)

- [x] 5/5 API endpoints implemented
- [x] OpenAPI documentation complete
- [x] Database schema with migrations
- [x] Docker local development environment
- [x] Health monitoring endpoint
- [x] E2E test structure in place

### Integration Metrics (In Progress)

- [ ] Chat Management Service integration
- [ ] Network isolation configured
- [ ] Frontend integration
- [ ] >80% test coverage

### Business Metrics (Future)

- [ ] Conversation continuity across sessions
- [ ] Improved AI response relevance
- [ ] Teacher analytics dashboard
- [ ] Student engagement improvement

---

## Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| Core Implementation | Jan 10 | Complete |
| OpenSpec Documentation | Jan 13-14 | Complete |
| Test Expansion | Jan 16 | In Progress |
| Integration & Security | Jan 18 | Planned |
| PR Ready | Jan 21 | Target |
| Demo | Jan 22 | Optional |
| Grades Submitted | Jan 25 | Deadline |

---

## Conclusion

The Memory Service successfully addresses the lack of conversational memory in the CourseWise platform. The microservice architecture provides a clean, scalable solution that integrates with the existing Firebase/Next.js stack while adding specialized capabilities through PostgreSQL and mem0.ai.

**Key Achievements**:
- Functional MVP with all planned API endpoints
- Comprehensive documentation (OpenSpec, README, Swagger)
- Runnable in GitHub Codespaces for professor review
- Clear integration path with platform

**Next Steps**:
- Expand test coverage
- Complete integration with Chat Management Service
- Configure production deployment

---

## Related Documents

- **Technical Design**: [`openspec/design.md`](./design.md)
- **Integration Spec**: [`openspec/spec.md`](./spec.md)
- **Implementation Plan**: [`openspec/plan.md`](./plan.md)
- **Feature Spec**: [`openspec/specs/memory-service/spec.md`](./specs/memory-service/spec.md)
- **Feature Design**: [`openspec/specs/memory-service/design.md`](./specs/memory-service/design.md)
- **Project Report**: [`PROJECT_REPORT.md`](../PROJECT_REPORT.md)
- **Service README**: [`src/services/memory-service/README.md`](../src/services/memory-service/README.md)

---

**Proposal Status**: Approved
**Implementation Status**: MVP Complete
**Author**: Development Team
**Last Updated**: January 14, 2026
