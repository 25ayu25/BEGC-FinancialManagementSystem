# Bahr El Ghazal Clinic - Financial Management System

A comprehensive financial management system for the Bahr El Ghazal Clinic, featuring transaction tracking, insurance management, reporting, and analytics.

## Features

### Core Modules

- **Dashboard** - Real-time financial overview with KPIs and trends
- **Transactions** - Track income and expenses across departments
- **Insurance Management** - Manage insurance claims and payments
- **Insurance Overview** - Enterprise-grade analytics dashboard (USD-only)
- **Reports** - Generate and manage monthly financial reports
- **Patient Volume** - Track patient visits and department activity
- **User Management** - Role-based access control and user administration

### Insurance Overview Dashboard (NEW)

The Insurance Overview page (`/insurance-overview`) provides a standalone, production-ready analytics interface for insurance data:

#### Key Features:
- **USD-Only**: All monetary calculations and displays in USD
- **Daily Timeline Chart**: Stacked bar chart showing daily payments by provider
- **Executive KPIs**: Real-time summary of billed, collected, and outstanding amounts
- **Provider Analytics**: Performance comparison across insurance providers
- **Aging Analysis**: Outstanding claim aging buckets (0-30, 31-60, 61-90, 90+ days)
- **Smart Filtering**: Multi-select providers, date presets (7/30/90 days), custom ranges
- **Data Tables**: Sortable, paginated claims and payments tables
- **Error Handling**: ErrorBoundary prevents crashes, graceful error states

#### Technology Stack:
- **Frontend**: React, TypeScript, Recharts (charting), Tailwind CSS
- **Backend**: Express.js, PostgreSQL
- **Client-Side Aggregation**: Efficient for moderate datasets (<= 10k rows)
- **Server Routes**: `/api/insurance-overview/*` for pre-aggregated data (optional)

#### File Structure:
```
client/src/
├── features/insurance-overview/
│   ├── components/
│   │   ├── ProviderDailyTimeline.tsx     # Primary daily chart
│   │   ├── ExecutiveDashboard.tsx        # KPI cards
│   │   ├── ProviderComparison.tsx        # Provider bars
│   │   ├── AgingAnalysis.tsx             # Aging buckets
│   │   ├── PaymentTimeline.tsx           # Monthly timeline
│   │   ├── SmartTable.tsx                # Data tables
│   │   └── AdvancedFilters.tsx           # Filter controls
│   ├── hooks/
│   │   ├── useDailyInsurance.ts          # Daily data aggregation
│   │   ├── useInsuranceOverview.ts       # Main data fetching
│   │   └── useAdvancedFilters.ts         # Filter state management
│   ├── utils/
│   │   ├── formatters.ts                 # formatUSD, date formatters
│   │   └── calculations.ts               # Aggregation helpers
│   └── __tests__/
│       ├── calculations.test.ts          # Unit tests (needs test setup)
│       └── ProviderDailyTimeline.test.tsx # Component tests (needs test setup)
├── components/
│   └── ErrorBoundary.tsx                 # Error boundary wrapper
└── pages/
    └── insurance-overview.tsx            # Main page (wrapped with ErrorBoundary)

server/routes/
└── insurance-overview.ts                 # Independent API endpoints
```

#### API Endpoints:

**Insurance Overview Routes** (`/api/insurance-overview/*`):
- `GET /api/insurance-overview/summary` - KPI metrics
- `GET /api/insurance-overview/aging` - Aging analysis buckets
- `GET /api/insurance-overview/provider-performance` - Provider metrics
- `GET /api/insurance-overview/timeline-data` - Monthly time-series data
- `GET /api/insurance-overview/claims-list` - Paginated claims
- `GET /api/insurance-overview/payments-list` - Paginated payments

All endpoints:
- Require authentication (`requireAuth` middleware)
- Support date range filters (`start`, `end`)
- Support provider filters (`providers[]`)
- Return USD data only
- Handle empty data gracefully

#### Development Setup:

1. **Seed Sample Data** (for testing):
   ```sql
   psql -d your_database -f migrations/seed-insurance-sample.sql
   ```
   This creates ~9 sample claims and ~60 daily payments for testing charts.

2. **Access the Dashboard**:
   Navigate to `/insurance-overview` after logging in.

3. **Filter Data**:
   - Use date presets (7/30/90 days) or custom range
   - Multi-select providers to filter data
   - Apply quick filters (high value, recent, overdue)

#### Production Safety:

- **No Breaking Changes**: All code is additive, no modifications to existing `insurance.tsx` page
- **Error Boundaries**: Component errors don't crash the entire app
- **Client-Side USD Filtering**: No invalid `currency` query parameters to existing endpoints
- **Fallback States**: Loading, error, and empty states handled gracefully
- **Authentication**: All routes protected with `requireAuth`

#### Testing:

Test infrastructure (Jest/Vitest) not yet configured. Test files are included as documentation:
- `client/src/features/insurance-overview/__tests__/calculations.test.ts`
- `client/src/features/insurance-overview/__tests__/ProviderDailyTimeline.test.tsx`

To set up testing:
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see `env-template.txt`)
4. Run database migrations:
   ```bash
   npm run db:push
   ```
5. Seed sample data (optional):
   ```bash
   psql -d your_database -f migrations/seed-insurance-sample.sql
   ```

## Development

```bash
npm run dev
```

Runs the development server on `http://localhost:5000` (or configured port).

## Build

```bash
npm run build
```

Builds both the client (Vite) and server (esbuild) for production.

## Production

```bash
npm start
```

Runs the production build.

## Type Checking

```bash
npm run check
```

Runs TypeScript type checking across the project.

## Project Structure

```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Shared UI components
│   │   ├── features/    # Feature-specific modules
│   │   ├── pages/       # Page components (routes)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── context/     # React context providers
│   │   ├── lib/         # Third-party library configs
│   │   └── utils/       # Utility functions
├── server/              # Backend Express application
│   ├── routes/          # API route handlers
│   ├── drizzle/         # Database schema (Drizzle ORM)
│   └── src/             # Server source code
├── migrations/          # Database migrations and seeds
├── shared/              # Shared types and schemas
└── dist/                # Production build output
```

## License

MIT

## Support

For issues or questions, please contact the development team.
