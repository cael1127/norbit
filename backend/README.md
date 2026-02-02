# Orbit Backend API

Backend API server for the Orbit platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start PostgreSQL and Redis (using Docker):
```bash
docker-compose up -d
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Seed database (optional):
```bash
npm run db:seed
```

6. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Leads
- `GET /api/leads` - List leads
- `GET /api/leads/:id` - Get lead by ID
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/:id/qualify` - Qualify lead

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation
- `POST /api/conversations` - Create conversation
- `POST /api/conversations/:id/messages` - Send message
- `GET /api/conversations/:id/messages` - Get messages

### Calendar
- `GET /api/calendar/oauth/authorize` - Get OAuth URL
- `GET /api/calendar/oauth/callback` - OAuth callback
- `GET /api/calendar/events` - List events
- `POST /api/calendar/events` - Create event
- `GET /api/calendar/availability` - Check availability

### Workflows
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `POST /api/workflows/:id/execute` - Execute workflow

### Reports
- `GET /api/reports/dashboard` - Dashboard metrics
- `GET /api/reports/leads` - Lead report
- `GET /api/reports/outreach` - Outreach report
- `GET /api/reports/calendar` - Calendar report
- `GET /api/reports/workflows` - Workflow report

## Testing

```bash
npm test
npm run test:coverage
```

## Database

Using Prisma ORM with PostgreSQL.

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```
