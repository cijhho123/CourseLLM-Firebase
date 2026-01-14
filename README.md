# CourseLLM (Coursewise)

**Status**: Development Complete - Ready for Review
**Project Type**: Educational AI Platform
**Feature**: Memory Service for Persistent Conversational Learning
**Deadline**: January 21, 2026 (PR Review)

---

## Project Overview

CourseLLM (Coursewise) is an educational platform that leverages AI to provide personalized learning experiences for undergraduate university courses, tested specifically on Computer Science courses. The platform provides role-based dashboards for students and teachers, integrated authentication via Firebase, and AI-powered course assessment and tutoring.

### Core Capabilities

- **Personalized Learning Assessment**: AI-driven assessment of student knowledge with recommendations
- **Socratic Course Tutoring**: AI-powered chat that guides students through course concepts using Socratic questioning
- **Memory Service**: Persistent conversational memory that enables continuity across learning sessions (MY FEATURE)
- **Role-Based Workflows**: Separate dashboards and capabilities for students and teachers
- **Secure Authentication**: Firebase Authentication with Google OAuth integration

---

## My Feature: Memory Service

**What I Implemented**: A standalone NestJS microservice that provides persistent conversational memory for the CourseWise platform.

### Feature Description

The Memory Service solves a critical problem: AI tutoring sessions currently start from scratch every time, forcing students to re-explain their background, learning preferences, and previous struggles. My microservice stores complete conversation history in PostgreSQL and uses mem0.ai to synthesize meaningful student insights, enabling truly personalized learning experiences.

**Key Capabilities:**
- User registration in memory system
- Message persistence for conversations
- Paginated conversation retrieval
- Memory synthesis using mem0.ai
- RESTful API with OpenAPI documentation

**Architecture:**
- Backend microservice (NestJS + TypeScript)
- PostgreSQL database with Prisma ORM
- mem0.ai integration for semantic memory
- Docker-based local development
- Swagger/OpenAPI documentation

**Integration Point:**
- Internal service called by Chat Management Service
- Not directly exposed to frontend
- Network-isolated for security

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 with React 18 (TypeScript)
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: React Context API
- **UI Library**: Radix UI (accessible, unstyled primitives)

### Backend
- **Main Platform**: Firebase (Authentication, Firestore, Cloud Functions, Storage)
- **Memory Service**: NestJS 10.x (TypeScript)
- **Database**:
  - Firestore (NoSQL) for main platform
  - PostgreSQL 15+ for Memory Service
- **Data Layer**: Firebase Data Connect (GraphQL over Firestore)

### AI/ML
- **Framework**: Google Genkit 1.20.0
- **Models**: Google GenAI (gemini-2.5-flash default)
- **Memory Engine**: mem0.ai SDK

### DevOps & Testing
- **Testing**: Playwright (E2E), Jest (unit tests for Memory Service)
- **Containerization**: Docker & Docker Compose
- **Package Manager**: pnpm (workspace)
- **Deployment**: Firebase Hosting, Firebase App Hosting, Cloud Run (planned)

---

## Environment Setup Instructions

### Package Manager

**IMPORTANT**: This project uses **pnpm** as the package manager. Do NOT use npm or yarn.

```bash
# If pnpm is not installed:
npm install -g pnpm
```

### Environment Variables

#### Main Application (.env.local)

Create `.env.local` in the project root for local development with Firebase emulators:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with the following values:

```env
# Firebase Web App Config (from Firebase Console -> Project Settings -> SDK setup)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Testing Configuration (required for E2E tests)
FIREBASE_SERVICE_ACCOUNT_JSON=<your_service_account_json>
ENABLE_TEST_AUTH=true
```

**For Production** (.env):
- Create `.env` instead of `.env.local`
- Set `ENABLE_TEST_AUTH=false` or omit it
- Never commit this file to Git

#### Memory Service Environment (.env)

Navigate to memory service directory and set up environment:

```bash
cd src/services/memory-service
cp .env.example .env
```

Edit `src/services/memory-service/.env`:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/memory_service?schema=public"
MEM0_API_KEY=your_mem0_api_key_here
LOG_LEVEL=debug
```

**Getting API Keys:**
- **GOOGLE_API_KEY**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
  - Export as environment variable: `export GOOGLE_API_KEY=your_key_here`
  - Required for Google Genkit AI flows
- **MEM0_API_KEY**: Sign up at [mem0.ai](https://mem0.ai) (currently using mock implementation for development)

### Firebase Configuration

1. **Project**: Uses Firebase project for authentication, Firestore, and Data Connect
2. **Emulators**: Local development uses Firebase emulators (no production Firebase calls)
3. **Service Account**: Required for testing and admin operations
   - Download from Firebase Console → Project Settings → Service Accounts
   - Store JSON content in `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable
   - **DO NOT commit service account JSON to Git**

---

## Dependency Installation

### Prerequisites

- Node.js 18+ and npm
- pnpm (installed globally: `npm install -g pnpm`)
- Docker and Docker Compose (for PostgreSQL)
- Firebase Tools (installed globally: `npm install -g firebase-tools`)

### Main Application Dependencies

From project root:

```bash
# Install all workspace dependencies
pnpm install
```

### Memory Service Dependencies

The memory service is a pnpm workspace package, so it's installed automatically with the root `pnpm install`. However, if you need to install separately:

```bash
cd src/services/memory-service
npm install
```

### Development Tools

Install Firebase CLI globally (if not already installed):

```bash
npm install -g firebase-tools
```

Install Playwright browsers (for E2E tests):

```bash
pnpm exec playwright install
```

---

## How to Run the Application

### Step 1: Start Firebase Emulators

Firebase emulators must be running for local development:

```bash
# From project root
firebase emulators:start
```

**Emulator Ports:**
- Auth: 9099
- Firestore: 8080
- Database: 9000
- Storage: 9199
- Data Connect: 9399
- UI: http://localhost:4000

**Note**: Keep emulators running in a separate terminal window.

### Step 2: Start Memory Service (Optional)

If you want to test memory service functionality:

```bash
cd src/services/memory-service

# Start PostgreSQL database
docker-compose up -d

# Run database migrations (first time only)
npm run prisma:generate
npm run prisma:migrate

# Start the service
npm run start:dev
```

**Memory Service URLs:**
- API: http://localhost:3001
- Swagger Docs: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/health

### Step 3: Start Main Application

In a new terminal (from project root):

```bash
# Set Google API key (required for Genkit flows)
export GOOGLE_API_KEY=your_key_here

# Start Next.js development server
pnpm run dev
```

**Application URLs:**
- Main App: http://localhost:9002
- Genkit Developer UI: http://localhost:4000 (if running genkit:dev)

### Alternative: Run Genkit in Development Mode

For testing AI flows directly:

```bash
pnpm run genkit:dev
```

This starts Genkit Developer UI with all AI flows available for testing.

---

## How to Run Tests

### End-to-End Tests (Playwright) - HIGHEST PRIORITY

E2E tests simulate complete user workflows including authentication, navigation, and interactions.

```bash
# Ensure Firebase emulators are running first
firebase emulators:start

# In another terminal, run E2E tests
pnpm run test:e2e
```

**What E2E Tests Cover:**
- User authentication flow (login, onboarding)
- Role-based redirects (student/teacher dashboards)
- Navigation and page rendering
- Form interactions
- Logout functionality

**Test Files:**
- `tests/auth.spec.ts` - Authentication flows

**Test Configuration:**
- `tests/playwright.config.ts` - Playwright configuration

### Backend API Tests (Memory Service - Jest)

Test the Memory Service API endpoints:

```bash
cd src/services/memory-service

# Ensure PostgreSQL is running
docker-compose up -d

# Run all tests with coverage
npm run test:all

# Or run individual test suites:
npm run test        # Unit tests
npm run test:e2e    # E2E API tests
npm run test:cov    # Coverage report
```

**Test Files:**
- `src/services/memory-service/test/app.e2e-spec.ts` - API endpoint tests

**Test Coverage:**
- Coverage reports generated in `src/services/memory-service/coverage/`
- Current target: >80% coverage (in progress)

### Unit Tests (Jest) - Frontend

**Status**: Not yet implemented for main application. Focus has been on E2E tests as per professor's priority guidance.

**Planned Coverage:**
- React components with mocked Firebase calls
- Utility functions
- Custom hooks

### Type Checking

Ensure TypeScript compilation passes with zero errors:

```bash
# From project root
pnpm run typecheck
```

### Linting

Run ESLint to check code quality:

```bash
# From project root
pnpm run lint
```

**Memory Service Linting:**
```bash
cd src/services/memory-service
npm run lint
```

### Test Execution Order

When testing the full application:

1. `firebase emulators:start` - Start Firebase emulators
2. `pnpm run typecheck` - Verify TypeScript
3. `pnpm run lint` - Check code quality
4. `pnpm run test:e2e` - Run Playwright E2E tests
5. Memory Service tests (if testing memory feature)

---

## Login Credentials

### Test User Accounts

**IMPORTANT**: For professor review, use the following test accounts:

#### Student Account
- **Email**: `student@test.com`
- **Password**: `[TODO: Add actual test password]`
- **Role**: Student
- **Department**: Computer Science

#### Teacher Account
- **Email**: `teacher@test.com`
- **Password**: `[TODO: Add actual test password]`
- **Role**: Teacher

### Sign-up Procedure

1. Navigate to http://localhost:9002
2. Click "Continue with Google" (uses Firebase Auth emulator in local dev)
3. For E2E tests, authentication uses custom tokens via `/api/test-token` endpoint
4. On first login, user goes through onboarding:
   - Select role (Student or Teacher)
   - Select department
   - Select courses (if student)
5. After onboarding, redirect to role-based dashboard

### Role-Based Access

**Student Role:**
- Access to `/student` routes
- View enrolled courses
- Access AI-powered assessments
- Chat with AI tutor
- Cannot access teacher features

**Teacher Role:**
- Access to `/teacher` routes
- Manage courses
- View student progress
- Access analytics dashboard
- Cannot access student-specific features

**Authorization Rules:**
- Firestore security rules enforce role-based access
- Rules defined in `firestore.rules`
- Client-side guards in `RoleGuardClient.tsx`

---

## API Documentation

### Main Application API

**Next.js API Routes:**
- Located in `src/app/api/`
- Test-only endpoint: `/api/test-token` (creates custom Firebase tokens for E2E tests)
  - **CRITICAL**: Only enabled when `ENABLE_TEST_AUTH=true`
  - **NEVER enable in production**

### Memory Service API

**Base URL**: http://localhost:3001

**Interactive Documentation:**
- **Swagger UI**: http://localhost:3001/api/docs
  - Complete API reference
  - Request/response schemas
  - Try-it-out playground
  - Authentication examples

**API Version**: v1

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/memory/register` | Register user in memory system |
| POST | `/api/v1/memory/messages` | Save conversation message |
| GET | `/api/v1/memory/conversations/:chatID` | Get conversation messages (paginated) |
| GET | `/api/v1/memory/users/:userID/conversations` | List user's conversations |
| POST | `/api/v1/memory/synthesize` | Generate memory synthesis |
| GET | `/api/v1/memory/users/:userID/memories` | Get user's memories |
| GET | `/health` | Service health check |

**Example API Call:**

```bash
# Register a user
curl -X POST http://localhost:3001/api/v1/memory/register \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "user123",
    "name": "John Doe",
    "role": "student",
    "userInfo": {}
  }'

# Save a message
curl -X POST http://localhost:3001/api/v1/memory/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "user123",
    "chatID": null,
    "content": "Can you explain derivatives?",
    "sender": "user",
    "metadata": {}
  }'
```

### Genkit AI Flows

**Genkit Developer UI**: http://localhost:4000 (when running `pnpm run genkit:dev`)

**Available Flows:**
- `socratic-course-chat` - Socratic tutoring conversation
- `personalized-learning-assessment` - Adaptive learning assessment

**Flow Testing:**
- Use Genkit UI to test flows with sample inputs
- View execution traces and model responses
- Debug prompts and configurations

---

## Monitoring Dashboard

### Application Health

**Status**: Basic health monitoring implemented for Memory Service. Full monitoring dashboard planned.

### Memory Service Health Check

**Endpoint**: http://localhost:3001/health

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:00Z",
  "service": "memory-service",
  "version": "1.0.0",
  "database": "connected"
}
```

**Monitored Metrics** (Planned):
- Process uptime
- CPU usage
- RAM usage
- Active connections
- Database query performance
- API request latency

### Firebase Emulator UI

**URL**: http://localhost:4000

**Features:**
- View Firestore data
- Inspect authentication users
- Monitor storage files
- View Data Connect queries
- Test functions

### Prisma Studio (Memory Service Database)

View and edit Memory Service PostgreSQL data:

```bash
cd src/services/memory-service
npm run prisma:studio
```

**URL**: http://localhost:5555

---

## Data Connect

### Using Data Connect

This project uses Firebase Data Connect, which provides a GraphQL layer over PostgreSQL.

**Schema Location**: `dataconnect/schema/schema.gql`

**Connectors:**
- `dataconnect/example/connector.yaml`
- Queries: `dataconnect/example/queries.gql`
- Mutations: `dataconnect/example/mutations.gql`

### Generated Files Policy

**Decision**: `dataconnect/generated/` is NOT committed to Git.

**Rationale:**
- Generated files should be regenerated to stay in sync with schema
- Prevents merge conflicts on auto-generated code
- Ensures consistency across environments

**Setup:**
```bash
# After cloning or pulling schema changes
firebase dataconnect:sdk:generate
```

**Code Usage:**
- Generated SDK imported from `@dataconnect/generated` and `@dataconnect/admin-generated`
- Used in Next.js API routes and server components
- TypeScript types auto-generated

### Which Code Uses Data Connect

**Main Application:**
- `src/app/api/*` - API routes using Data Connect queries
- `src/lib/*` - Utility functions interfacing with Data Connect
- Server components fetching data via Data Connect SDK

**Note**: Memory Service uses PostgreSQL directly (not Data Connect) for specialized conversation storage requirements.

---

## Scripts Execution Order

The `package.json` scripts should be run in the following order for a complete workflow:

### Main Application (package.json)

```json
{
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "test:e2e": "playwright test",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "NODE_ENV=production next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

**Execution Order:**

1. **Setup Phase:**
   - `pnpm install` - Install dependencies
   - `firebase emulators:start` - Start Firebase emulators

2. **Development Phase:**
   - `pnpm run dev` - Run Next.js development server
   - `pnpm run genkit:dev` - (Optional) Run Genkit developer UI

3. **Testing Phase:**
   - `pnpm run typecheck` - Type checking (must pass)
   - `pnpm run lint` - Code linting (must pass)
   - `pnpm run test:e2e` - End-to-end tests

4. **Build Phase:**
   - `pnpm run build` - Production build
   - `pnpm run start` - Start production server

### Memory Service (src/services/memory-service/package.json)

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:cov": "jest --coverage",
    "test:all": "npm run lint && npm test -- --coverage && npm run test:e2e"
  }
}
```

**Execution Order:**

1. **Setup Phase:**
   - `docker-compose up -d` - Start PostgreSQL
   - `npm install` - Install dependencies
   - `npm run prisma:generate` - Generate Prisma client
   - `npm run prisma:migrate` - Run database migrations

2. **Development Phase:**
   - `npm run start:dev` - Run NestJS with hot reload

3. **Testing Phase:**
   - `npm run lint` - ESLint check
   - `npm run test` - Unit tests
   - `npm run test:e2e` - API endpoint tests
   - `npm run test:cov` - Coverage report
   - `npm run test:all` - Run all checks

4. **Build Phase:**
   - `npm run build` - Build for production
   - `npm run start:prod` - Start production server

---

## Known Issues / Limitations

### Current Limitations

1. **Memory Service Integration**:
   - Memory Service is implemented but not yet integrated with Chat Management Service
   - Currently testable via direct API calls only
   - Frontend cannot access memory functionality yet

2. **Test Coverage**:
   - E2E tests cover authentication flows
   - Memory Service unit tests in progress (target: >80%)
   - Main application unit tests not yet implemented

3. **Production Deployment**:
   - Memory Service deployment to Cloud Run not yet configured
   - Network isolation (VPC/firewall rules) not yet set up
   - Using mock mem0.ai implementation (not real mem0.ai API)

4. **Authentication**:
   - Google OAuth is the only authentication provider
   - Test authentication uses custom tokens (dev only)
   - Multi-factor authentication not implemented

5. **Monitoring**:
   - Basic health endpoint exists
   - Comprehensive monitoring dashboard planned but not implemented
   - No alerting configured

### Planned Improvements

- [ ] Complete Memory Service integration with Chat Management
- [ ] Increase test coverage to >80% for Memory Service
- [ ] Add unit tests for main application components
- [ ] Deploy Memory Service to Cloud Run with VPC connector
- [ ] Implement comprehensive monitoring dashboard
- [ ] Add real mem0.ai API integration
- [ ] Configure CI/CD pipeline

### Browser Compatibility

- **Recommended**: Chrome, Firefox, Edge (latest versions)
- **Known Issues**:
  - Google OAuth popup may be blocked in some browsers (use redirect flow)
  - IndexedDB persistence may fail in private browsing mode

---

## Project Structure

```
CourseLLM-Firebase/
├── src/
│   ├── app/                    # Next.js pages and layouts
│   │   ├── student/           # Student dashboard pages
│   │   ├── teacher/           # Teacher dashboard pages
│   │   ├── login/             # Login page
│   │   └── api/               # API routes
│   ├── components/            # Reusable React components
│   │   ├── ui/                # UI components (Radix UI wrappers)
│   │   └── layout/            # Layout components
│   ├── lib/                   # Utilities and configurations
│   │   ├── firebase.ts        # Firebase initialization
│   │   ├── authService.ts     # Authentication helpers
│   │   └── types.ts           # TypeScript type definitions
│   ├── ai/                    # Genkit AI flows
│   │   ├── flows/             # AI flow definitions
│   │   └── genkit.ts          # Genkit configuration
│   └── services/
│       └── memory-service/    # Memory Service microservice (MY FEATURE)
│           ├── src/           # NestJS source code
│           ├── prisma/        # Database schema and migrations
│           ├── test/          # E2E tests
│           └── doc/           # Memory Service documentation
├── tests/                     # E2E tests (Playwright)
├── dataconnect/               # Firebase Data Connect schema
├── functions/                 # Firebase Cloud Functions
├── openspec/                  # OpenSpec documentation
│   └── specs/
│       └── memory-service/    # Memory Service specifications
├── docs/                      # Project documentation
├── firebase.json              # Firebase configuration
├── package.json               # Main workspace package.json
├── pnpm-workspace.yaml        # pnpm workspace configuration
└── README.md                  # This file
```

---

## Additional Documentation

### OpenSpec Documentation

Complete formal specifications in `openspec/specs/memory-service/`:
- `proposal.md` - Memory Service proposal and requirements
- `design.md` - Architecture and design decisions
- `plan.md` - Implementation roadmap
- `spec.md` - Formal technical specification

### Memory Service Documentation

Detailed documentation in `src/services/memory-service/doc/`:
- `LOCAL_SETUP.md` - Local development setup
- `DOCKER.md` - Docker deployment guide
- `DOCKER_QUICKREF.md` - Docker quick reference
- `DEPENDENCY.md` - Dependency management

### Other Documentation

- `docs/Auth/auth-implementation.md` - Authentication implementation details
- `docs/Memory/PRD-MemoryService.md` - Product requirements document
- `docs/Design.md` - Overall platform design

---

## Troubleshooting

### Firebase Emulator Issues

**Problem**: Emulators fail to start

```bash
# Check if ports are already in use
lsof -i :9099 -i :8080 -i :9000 -i :9199 -i :9399

# Kill processes using those ports
kill -9 <PID>

# Restart emulators
firebase emulators:start
```

**Problem**: Authentication fails in emulator

- Ensure `ENABLE_TEST_AUTH=true` in `.env.local`
- Verify Firebase service account JSON is valid
- Check emulator UI at http://localhost:4000 for auth state

### Memory Service Issues

**Problem**: Database connection fails

```bash
# Check if PostgreSQL is running
cd src/services/memory-service
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

**Problem**: Prisma migrations fail

```bash
cd src/services/memory-service

# Reset database (WARNING: deletes all data)
npm run prisma:migrate reset

# Push schema without migration
npx prisma db push
```

### Next.js Build Issues

**Problem**: Build fails with type errors

```bash
# Run type checking to see errors
pnpm run typecheck

# Common fixes:
# - Ensure all dependencies are installed
# - Clear Next.js cache: rm -rf .next
# - Regenerate Prisma client: npm run prisma:generate
```

### Playwright Test Issues

**Problem**: Tests fail to start

```bash
# Install Playwright browsers
pnpm exec playwright install

# Ensure emulators are running
firebase emulators:start
```

---

## Getting Help

### Resources

- **OpenSpec Documentation**: `openspec/specs/memory-service/`
- **Memory Service README**: `src/services/memory-service/README.md`
- **Firebase Docs**: https://firebase.google.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Genkit Docs**: https://firebase.google.com/docs/genkit

### Contact

For questions about this project:
- Review OpenSpec documentation first
- Check existing documentation in `docs/`
- Consult professor during office hours

---

## License

MIT

---

**Last Updated**: January 14, 2026
**Version**: 1.0.0
**Status**: Ready for PR Review
