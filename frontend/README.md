# Orbit Frontend

React frontend for the Orbit platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create `.env` file:
```
VITE_API_URL=http://localhost:3001
```

3. Start development server:
```bash
npm run dev
```

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Query
- Zustand
- Socket.io Client
- Recharts

## Project Structure

```
src/
├── api/          # API client and endpoints
├── components/   # Reusable components
├── pages/        # Page components
├── stores/        # Zustand state management
└── App.tsx       # Main app component
```

## Building

```bash
npm run build
```

## Testing

```bash
npm test
```
