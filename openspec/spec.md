# CourseLLM Platform Integration Specification

**Version**: 1.0.0
**Last Updated**: January 14, 2026
**Status**: Active Development

---

## Platform Overview

CourseLLM (Coursewise) is an educational AI platform that provides personalized learning experiences through:
- AI-powered Socratic tutoring
- Personalized learning assessments
- Persistent conversational memory (Memory Service)
- Role-based access for students and teachers

This specification describes how all components integrate to create a cohesive learning experience.

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Student    │    │   Teacher    │    │  Auth/Login  │  │
│  │  Dashboard   │    │  Dashboard   │    │    Pages     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└────────────┬──────────────────┬───────────────────┬─────────┘
             │                  │                   │
             v                  v                   v
┌────────────────────────────────────────────────────────────┐
│              Firebase Authentication (Google OAuth)         │
└────────────┬──────────────────────────────────────────────┘
             │
             v
┌───────────────────────────────────────────────────────────┐
│                    Firebase Firestore                      │
│  (User Profiles, Course Data, Enrollments, Settings)      │
└────────────┬──────────────────────────────────────────────┘
             │
┌────────────┴────────────────────────────────────┐
│                                                  │
v                                                  v
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   Google Genkit AI Flows    │    │    Memory Service (NestJS)  │
│   - Socratic Chat            │    │    - Message Persistence    │
│   - Learning Assessment      │    │    - Conversation History   │
│                              │    │    - Memory Synthesis       │
│   (Gemini 2.5 Flash)        │    │    (PostgreSQL + mem0.ai)  │
└─────────────────────────────┘    └─────────────────────────────┘
```

### Integration Flow

**Student Learning Workflow:**
1. Student authenticates via Firebase Auth
2. Student navigates to course dashboard
3. Student initiates chat with AI tutor
4. Frontend sends message to Genkit AI flow
5. **[PLANNED]** Genkit flow queries Memory Service for student history
6. Genkit generates personalized response using student context
7. **[PLANNED]** Response and user message saved to Memory Service
8. Conversation displays in student chat interface

**Teacher Analytics Workflow:**
1. Teacher authenticates via Firebase Auth
2. Teacher navigates to course management
3. **[FUTURE]** Teacher views student interaction analytics from Memory Service
4. **[FUTURE]** Teacher reviews synthesized memories showing learning patterns

---

## Memory Service Integration

### Purpose in Platform

The Memory Service is a critical backend component that enables:
- **Persistent Context**: AI remembers previous conversations
- **Personalized Learning**: AI adapts based on student history
- **Learning Analytics**: Teachers gain insights into student progress

### Integration Points

#### 1. Chat Management Service → Memory Service

**Status**: Planned (not yet implemented)

**Flow:**
```
Chat Management Service (Future)
       │
       ├─► POST /api/v1/memory/register
       │   (Register user on first interaction)
       │
       ├─► POST /api/v1/memory/messages
       │   (Save each message in conversation)
       │
       ├─► GET /api/v1/memory/conversations/:chatID
       │   (Retrieve conversation history for AI context)
       │
       └─► POST /api/v1/memory/synthesize
           (Generate learning insights periodically)
```

**Current State:**
- Memory Service API is fully functional
- Chat Management Service integration in progress
- Network isolation not yet configured

#### 2. Frontend → Chat Management → Memory Service

**What Comes Before Memory Service:**
1. User authentication (Firebase Auth)
2. User profile loaded from Firestore
3. Student navigates to course chat
4. User sends message to chat interface

**Memory Service Actions:**
5. Register user in memory system (if first time)
6. Save user message to conversation
7. Retrieve recent conversation history
8. Provide context to AI flow

**What Comes After Memory Service:**
9. AI generates response with conversation context
10. AI response saved back to Memory Service
11. Chat UI displays updated conversation
12. Memory synthesis runs periodically

#### 3. Genkit AI Flows → Memory Service

**Status**: Not yet integrated

**Planned Integration:**
- Genkit flows will fetch conversation history from Memory Service
- Genkit flows will include student learning patterns in prompts
- Genkit responses will be enriched with personalized context

**Example Flow:**
```typescript
// In src/ai/flows/socratic-course-chat.ts
const chatFlow = ai.defineFlow({
  name: 'socratic-course-chat',
  inputSchema: z.object({
    userID: z.string(),
    chatID: z.string().optional(),
    message: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    chatID: z.string(),
  }),
}, async (input) => {
  // FUTURE: Fetch conversation history from Memory Service
  const history = await memoryService.getConversation(input.chatID);

  // FUTURE: Fetch synthesized memories about student
  const memories = await memoryService.getUserMemories(input.userID);

  // Generate AI response with context
  const response = await generatePrompt({
    conversationHistory: history,
    studentContext: memories,
    currentMessage: input.message,
  });

  // FUTURE: Save response to Memory Service
  await memoryService.saveMessage({
    chatID: response.chatID,
    content: response.text,
    sender: 'assistant',
  });

  return response;
});
```

### API Contract

**Memory Service provides these capabilities to the platform:**

| Endpoint | Used By | Purpose |
|----------|---------|---------|
| `POST /api/v1/memory/register` | Chat Management | Initialize new users |
| `POST /api/v1/memory/messages` | Chat Management | Store all messages |
| `GET /api/v1/memory/conversations/:chatID` | Genkit AI Flows | Load conversation context |
| `GET /api/v1/memory/users/:userID/conversations` | Teacher Dashboard (future) | List student conversations |
| `POST /api/v1/memory/synthesize` | Background Job (future) | Generate learning insights |
| `GET /api/v1/memory/users/:userID/memories` | Genkit AI Flows | Personalize responses |

### Security Model

**Network Isolation:**
- Memory Service is internal-only (not exposed to frontend)
- Only Chat Management Service can call Memory Service
- VPC/firewall rules enforce isolation (planned)

**Authorization:**
- Chat Management Service verifies user authentication
- Memory Service trusts Chat Management Service (service-to-service trust)
- No authorization layer in Memory Service itself
- User data isolated by userID in all queries

### Data Flow Example

**Student Asks Question:**

```
┌──────────┐   1. Click Send    ┌─────────────┐
│ Frontend │──────────────────>│  Chat API   │
│ (Next.js)│                    │  Route      │
└──────────┘                    └─────┬───────┘
                                      │
                                      │ 2. Save message
                                      v
                              ┌───────────────┐
                              │ Memory Service│
                              │ POST /messages│
                              └───────┬───────┘
                                      │
                                      │ 3. Get history
                                      v
                              ┌───────────────┐
                              │ Memory Service│
                              │ GET /convs    │
                              └───────┬───────┘
                                      │
                                      │ 4. Generate response
                                      v
                              ┌───────────────┐
                              │ Genkit Flow   │
                              │ (Gemini API)  │
                              └───────┬───────┘
                                      │
                                      │ 5. Save AI response
                                      v
                              ┌───────────────┐
                              │ Memory Service│
                              │ POST /messages│
                              └───────┬───────┘
                                      │
                                      │ 6. Return to frontend
                                      v
┌──────────┐   7. Display      ┌─────────────┐
│ Frontend │<─────────────────│  Chat API   │
│ (Next.js)│                    │  Route      │
└──────────┘                    └─────────────┘
```

---

## Other Team PRs and Integration Opportunities

### Related Features

**File Upload Feature:**
- **Integration Point**: Upload course materials → Chunk → Store references in Memory
- **How Memory Service Relates**: Could store file references in conversation context
- **Future Enhancement**: "Remember when we discussed [uploaded document]?"

**Document Chunking/Ingestion:**
- **Integration Point**: Chunked course materials → Indexed for search → Referenced in conversations
- **How Memory Service Relates**: Memory synthesis could include document references
- **Future Enhancement**: AI cites specific course materials based on student questions

**Search Feature:**
- **Integration Point**: Search past conversations → Find similar questions
- **How Memory Service Relates**: Memory Service stores searchable conversation history
- **API Integration**: Search service could query Memory Service for historical Q&A

**Authentication Feature:**
- **Integration Point**: User login → Create memory profile
- **How Memory Service Relates**: Memory Service needs userID from auth system
- **Current State**: Fully integrated via Firebase Auth

### Cross-Team Integration Scenarios

**Scenario 1: File Upload + Memory Service**
```
Student uploads syllabus PDF
  → File Upload service stores in Firebase Storage
  → Document Chunking service processes content
  → Student asks: "What's due next week?"
  → AI queries Memory Service (sees syllabus discussion)
  → AI queries Chunking service (searches syllabus)
  → AI provides contextualized answer
```

**Scenario 2: Search + Memory Service**
```
Student searches: "derivatives"
  → Search service queries course materials
  → Search service queries Memory Service for past questions
  → Results show both:
    - Course material on derivatives
    - Student's previous derivative questions
  → Student gets personalized learning path
```

---

## API Adaptation for Other Features

### If Chat Management Service Needs Additional Data

**Current Memory Service API:**
```typescript
interface SaveMessageDTO {
  chatID?: string;
  userID: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  metadata?: Record<string, any>;
}
```

**Adaptation for File References:**
```typescript
interface SaveMessageDTO {
  chatID?: string;
  userID: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  metadata?: {
    fileReferences?: string[];  // NEW: File IDs from upload service
    citedDocuments?: string[];  // NEW: Document chunk IDs
    courseContext?: string;      // NEW: Specific course/topic
  };
}
```

### If Teacher Analytics Needs Memory Insights

**Current API:**
```typescript
GET /api/v1/memory/users/:userID/memories
```

**New Endpoint for Teachers:**
```typescript
// NEW: Aggregate student memories for analytics
GET /api/v1/memory/courses/:courseID/student-insights
Response: {
  courseID: string;
  studentSummaries: [{
    userID: string;
    commonStrugglePoints: string[];
    learningPreferences: string[];
    masteredConcepts: string[];
    lastActive: Date;
  }]
}
```

---

## Component Responsibilities

### Frontend (Next.js)
**Responsible For:**
- User interface and interactions
- Client-side routing
- Form validation
- Firebase Auth token management
- Calling Next.js API routes

**Does NOT Handle:**
- Direct Memory Service calls (goes through backend)
- Database writes (uses Firestore via Firebase SDK)
- AI model calls (uses Genkit via API routes)

### Genkit AI Flows
**Responsible For:**
- Generating AI responses
- Prompt engineering
- Model selection
- Context window management

**Future Responsibility:**
- Loading conversation history from Memory Service
- Saving responses to Memory Service
- Using synthesized memories for personalization

### Memory Service
**Responsible For:**
- Storing all conversations permanently
- Providing fast conversation retrieval
- Synthesizing learning insights
- Ensuring data isolation per user

**Does NOT Handle:**
- User authentication (trusts Chat Management Service)
- Frontend rendering
- AI model calls
- File storage (uses Firestore/Storage for that)

### Firebase Firestore
**Responsible For:**
- User profiles
- Course metadata
- Enrollment data
- Real-time updates

**Does NOT Handle:**
- Conversation message storage (Memory Service handles this)
- AI-generated memory synthesis (Memory Service handles this)

---

## Deployment Architecture

### Current State (Development)

```
Developer Machine
├── Firebase Emulators (Auth, Firestore, Storage, Data Connect)
├── Next.js Dev Server (port 9002)
├── Memory Service (port 3001)
└── PostgreSQL Docker Container (port 5432)
```

### Future State (Production)

```
                       ┌──────────────────────────┐
                       │    Firebase Hosting      │
                       │    (Next.js Frontend)    │
                       └────────────┬─────────────┘
                                    │
                       ┌────────────┴─────────────┐
                       │                          │
                       v                          v
         ┌─────────────────────┐    ┌─────────────────────┐
         │ Firebase Services   │    │   Cloud Run VPC     │
         │ - Auth              │    │   (Private Network) │
         │ - Firestore         │    │                     │
         │ - Functions         │    │  ┌──────────────┐   │
         │ - Storage           │    │  │   Memory     │   │
         └─────────────────────┘    │  │   Service    │   │
                                    │  └───────┬──────┘   │
                                    │          │          │
                                    │          v          │
                                    │  ┌──────────────┐   │
                                    │  │ Cloud SQL    │   │
                                    │  │ PostgreSQL   │   │
                                    │  └──────────────┘   │
                                    └─────────────────────┘
```

**Key Deployment Notes:**
- Memory Service runs in Cloud Run with VPC connector
- Cloud SQL PostgreSQL in same VPC (no public IP)
- Memory Service only accessible from Cloud Run services
- Firewall rules prevent external access

---

## Success Metrics

### Integration Success Indicators

**Memory Service Integration:**
- [ ] Chat messages successfully saved to Memory Service
- [ ] Conversation history retrieved for AI context
- [ ] Memory synthesis produces meaningful insights
- [ ] <200ms p95 latency for conversation retrieval
- [ ] Zero data leakage between users

**Platform-Wide Success:**
- [ ] Students experience conversation continuity across sessions
- [ ] AI responses improve in relevance over time
- [ ] Teachers can view student learning trajectories
- [ ] System scales to 100+ concurrent users
- [ ] >99.9% uptime for core services

---

## Future Enhancements

### Phase 1: Basic Integration (Current Focus)
- [x] Memory Service API implementation
- [x] OpenAPI documentation
- [ ] Chat Management Service integration
- [ ] Network isolation configuration

### Phase 2: Advanced Features
- [ ] Real-time memory synthesis
- [ ] Teacher analytics dashboard
- [ ] File reference tracking
- [ ] Course-specific memory contexts

### Phase 3: Optimization
- [ ] Redis caching layer
- [ ] Vector search for semantic retrieval
- [ ] Multi-language support
- [ ] Advanced privacy controls

---

## References

- **Memory Service Spec**: `openspec/specs/memory-service/spec.md`
- **Memory Service Design**: `openspec/specs/memory-service/design.md`
- **Platform Design**: `docs/Design.md`
- **Auth Implementation**: `docs/Auth/auth-implementation.md`
- **Memory Service README**: `src/services/memory-service/README.md`

---

**Document Status**: ✅ Complete
**Next Review**: January 21, 2026
**Owner**: Development Team
