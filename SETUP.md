# Orbit Platform - Setup Guide

Complete setup instructions for the Orbit fullstack platform.

## Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- OpenAI API key (for AI agent functionality)
- Google OAuth credentials (for calendar integration)

## Quick Start

### 1. Clone and Install

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Environment Setup

Copy the environment example file:
```bash
cp env.example .env
```

Edit `.env` with your configuration:
- Set `OPENAI_API_KEY` for AI functionality
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for calendar integration
- Set `JWT_SECRET` to a secure random string
- Adjust database and Redis URLs if needed

### 3. Start Infrastructure

Start PostgreSQL and Redis using Docker:
```bash
docker-compose up -d
```

### 4. Database Setup

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 5. Start Development Servers

In separate terminals:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Or use the root script:
```bash
npm run dev
```

### 6. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Default Credentials

After seeding:
- Email: `demo@orbitplatform.com`
- Password: `demo123`

## Project Structure

```
orbit-platform/
├── backend/          # Node.js/Express API
│   ├── src/
│   │   ├── controllers/  # Route controllers
│   │   ├── services/     # Business logic
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Express middleware
│   │   └── socket/       # Socket.IO handlers
│   └── prisma/       # Database schema
├── frontend/         # React application
│   └── src/
│       ├── api/         # API client
│       ├── components/  # React components
│       ├── pages/       # Page components
│       └── stores/       # State management
└── docker-compose.yml # Infrastructure
```

## Features Implemented

✅ Fullstack architecture (React + Node.js)
✅ Authentication (JWT)
✅ AI Agent with tool calling
✅ Real-time chat interface (Socket.IO)
✅ Lead management system
✅ Calendar integration (Google Calendar)
✅ Automation workflows
✅ Reporting and analytics
✅ Security (rate limiting, validation)
✅ Scalability (caching, queues)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Verify database exists: `docker exec -it orbit-postgres psql -U postgres -l`

### Redis Connection Issues
- Ensure Redis is running: `docker-compose ps`
- Check REDIS_URL in .env
- Test connection: `docker exec -it orbit-redis redis-cli ping`

### Port Already in Use
- Change PORT in .env (backend)
- Change port in vite.config.ts (frontend)

## Next Steps

1. Configure Google OAuth for calendar integration
2. Set up email service (Resend/SendGrid) for outreach
3. Add more lead discovery sources
4. Customize workflow templates
5. Deploy to production

## Production Deployment

1. Set `NODE_ENV=production`
2. Use secure JWT secret
3. Configure production database
4. Set up SSL/TLS
5. Configure CORS properly
6. Set up monitoring and logging
7. Use environment-specific configs
