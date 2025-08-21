# Financial Management System

## Overview

This is a comprehensive financial management system for Bahr El Ghazal clinic, designed to track daily income and expenses across multiple departments. The system provides real-time financial insights, transaction management, receipt handling, and monthly reporting capabilities. Built with a modern full-stack architecture using React, Express.js, and PostgreSQL, it supports both USD and South Sudanese Pound (SSP) currencies and integrates with various insurance providers.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preference: Minimal, clean designs over elaborate styling, gradients, or complex visual enhancements.
Header layout preference: Clean 2-column grid layout with title/subtitle on left, controls on right with proper spacing.

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
- **Primary Database**: PostgreSQL with Neon serverless adapter for scalable cloud deployment
- **Schema Design**: Normalized relational structure with tables for users, departments, insurance providers, transactions, monthly reports, and receipts
- **Migrations**: Drizzle Kit for database schema versioning and migrations
- **Connection Pooling**: Uses connection pooling for efficient database resource management

### Authentication and Authorization
- **Current Implementation**: Simplified middleware-based authentication (placeholder for production-ready system)
- **User Roles**: Admin and staff roles with location-based access (USA, South Sudan)
- **Session Management**: Cookie-based sessions with credential inclusion for API requests

### File Upload and Storage
- **Cloud Storage**: Google Cloud Storage integration with Replit sidecar authentication
- **Upload System**: Uppy.js file upload library with drag-and-drop interface and progress tracking
- **Receipt Management**: Direct-to-cloud upload with presigned URLs for secure file handling
- **ACL System**: Custom object access control with group-based permissions (USER_LIST, EMAIL_DOMAIN, GROUP_MEMBER, SUBSCRIBER)

### PDF Report Generation
- **Library**: jsPDF for client-side and server-side PDF generation
- **Professional Formatting**: Medical clinic-themed reports with teal branding
- **Features**: Tabulated summaries, department performance rankings, percentage breakdowns
- **Layout**: Professional header, structured financial tables, confidentiality footer
- **Currency Formatting**: Proper comma-separated values and professional presentation

### UI/UX Design Patterns
- **Design System**: Consistent color palette with CSS custom properties for theming
- **Component Architecture**: Modular component structure with reusable UI primitives
- **Responsive Design**: Mobile-first approach with breakpoint-aware components
- **Data Visualization**: Custom chart components for financial data presentation
- **Date Selection**: Professional shadcn calendar components with clinic's teal branding for custom date ranges

### Business Logic Implementation
- **Multi-Currency Support**: USD and SSP with conversion utilities and proper formatting
- **Department Tracking**: Consultation, Laboratory, Ultrasound, X-Ray, and Pharmacy departments
- **Insurance Integration**: Support for multiple insurance providers (CIC, UAP, CIGNA, etc.)
- **Transaction Types**: Income and expense tracking with detailed categorization
- **Reporting System**: Monthly report generation with department and insurance breakdowns
- **Time Period Analysis**: Flexible date filtering with Current Month, Last Month, Last 3 Months, This Year, and Custom date range options

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
- **Authentication**: Replit sidecar token service for Google Cloud authentication
- **Monitoring**: Built-in request logging with performance metrics
- **Error Handling**: Centralized error boundary system with user-friendly error messages