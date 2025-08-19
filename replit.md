# Financial Management System

## Overview

This is a comprehensive financial management system for Bahr El Ghazal clinic, designed to track daily income and expenses across multiple departments. The system provides real-time financial insights, transaction management, receipt handling, and monthly reporting capabilities. Built with a modern full-stack architecture using React, Express.js, and PostgreSQL, it supports both USD and South Sudanese Pound (SSP) currencies and integrates with various insurance providers.

## Migration Status (Phase 2 Complete - Deployment Ready)

✅ **Phase 1 Complete**: Authentication and basic dashboard connectivity established
✅ **Phase 2 Complete**: Full transition to Supabase-only architecture for deployment
- Supabase authentication working perfectly with direct login routing
- Executive Dashboard fully transitioned to Supabase queries (no Express API dependency)
- Add Transaction form creates records directly through Supabase
- All undefined variable references resolved
- Application routes directly to Executive Dashboard after login
- Removed temporary auth bypass - ready for production deployment
- Original professional medical clinic design preserved exactly
- Ready for Netlify deployment with finance.bahrelghazalclinic.com domain

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and hot reloading
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for consistent, accessible design
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management with optimistic updates and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **File Structure**: Organized with pages, components (dashboard, transactions, layout, ui), hooks, and utility libraries

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with centralized route registration and error handling middleware
- **Database ORM**: Drizzle ORM for type-safe database operations and schema management
- **Development Setup**: Uses tsx for TypeScript execution in development with hot reloading
- **Build Process**: esbuild for fast production builds with ESM module format

### Data Storage Solutions
- **Current Architecture**: Supabase PostgreSQL with real-time subscriptions and automatic scaling
- **Schema Design**: Normalized relational structure with tables for users, departments, insurance providers, transactions, monthly reports, and receipts
- **SQL Views**: Created v_totals_current_month, v_dept_totals_current_month, v_insurance_totals_current_month for proper data aggregation
- **Migrations**: Supabase migrations with SQL and automatic schema versioning
- **Connection Pooling**: Built-in connection pooling and edge functions
- **Data Queries**: Dashboard uses direct Supabase queries replacing Express API endpoints

### Authentication and Authorization  
- **Production System**: Supabase Auth with JWT tokens and row-level security (RLS)
- **User Roles**: Admin and staff roles with location-based access (USA, South Sudan)
- **Session Management**: JWT-based sessions with automatic refresh tokens
- **Security**: Row-level security policies for multi-tenant data isolation

### File Upload and Storage
- **Cloud Storage**: Supabase Storage with automatic CDN and image optimization
- **Upload System**: Direct-to-Supabase uploads with progress tracking and resumable uploads
- **Receipt Management**: Secure bucket storage with access control policies
- **ACL System**: Supabase RLS policies for fine-grained access control

### PDF Report Generation
- **Library**: jsPDF for client-side PDF generation
- **Professional Formatting**: Medical clinic-themed reports with teal branding  
- **Executive Dashboard Export**: Real-time PDF generation with current financial metrics
- **Features**: Revenue/expense summaries, net income calculations, department performance data
- **Layout**: Professional header, structured financial tables, confidentiality footer
- **Currency Formatting**: Proper comma-separated values and professional presentation

### UI/UX Design Patterns
- **Design System**: Consistent color palette with CSS custom properties for theming
- **Component Architecture**: Modular component structure with reusable UI primitives
- **Responsive Design**: Mobile-first approach with breakpoint-aware components
- **Data Visualization**: Custom chart components for financial data presentation

### Business Logic Implementation
- **Multi-Currency Support**: USD and SSP with conversion utilities and proper formatting
- **Department Tracking**: Consultation, Laboratory, Ultrasound, X-Ray, and Pharmacy departments
- **Insurance Integration**: Support for multiple insurance providers (CIC, UAP, CIGNA, etc.)
- **Transaction Types**: Income and expense tracking with detailed categorization
- **Reporting System**: Monthly report generation with department and insurance breakdowns

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling and edge optimization
- **Google Cloud Storage**: Object storage for receipt and document management with IAM-based access control
- **Replit Infrastructure**: Development environment with sidecar services for cloud authentication

### Core Libraries
- **Database**: Drizzle ORM with Neon serverless adapter for type-safe PostgreSQL operations
- **UI Framework**: Radix UI components for accessible, unstyled UI primitives
- **Styling**: Tailwind CSS with custom design tokens and responsive utilities
- **File Upload**: Uppy.js ecosystem (@uppy/core, @uppy/dashboard, @uppy/aws-s3) for robust file handling
- **Validation**: Zod for runtime type checking and schema validation
- **HTTP Client**: Native fetch API with custom wrapper for error handling and authentication

### Development Tools
- **Build System**: Vite for frontend development with React Fast Refresh
- **TypeScript**: Full type safety across frontend and backend with path aliases
- **Code Quality**: ESLint and Prettier configuration for consistent code style
- **Database Tools**: Drizzle Kit for schema management and migration generation

### Third-Party Integrations
- **Authentication**: Supabase Auth for secure user management and JWT tokens
- **Monitoring**: Supabase Analytics and Netlify Analytics for performance metrics  
- **Error Handling**: Centralized error boundary system with user-friendly error messages

## Deployment Strategy

### Production Architecture
- **Frontend Hosting**: Netlify with global CDN and automatic deployments from Git
- **Database & Backend**: Supabase with edge functions for API endpoints
- **Custom Domain**: finance.bahrelghazalclinic.com with automatic SSL
- **File Storage**: Supabase Storage for receipts and documents
- **Scheduled Jobs**: Netlify scheduled functions for automated reports

### Multi-Location Access
- **South Sudan Staff**: Fast access via Netlify's global CDN
- **USA Administration**: Real-time monitoring and management access
- **Offline Support**: Service worker caching for unreliable internet
- **Data Sync**: Real-time updates via Supabase subscriptions