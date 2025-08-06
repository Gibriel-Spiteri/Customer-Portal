# Customer Portal

## Overview

This is a React-based customer portal application that integrates with NetSuite to provide real-time access to customer data including orders, payments, invoices, and account information. The application features a modern architecture with live data synchronization capabilities, user authentication, and a responsive UI built with shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for the main UI framework
- **Vite** as the build tool and development server with hot module replacement
- **Wouter** for client-side routing (lightweight React router alternative)
- **TanStack Query** for server state management, caching, and data fetching
- **shadcn/ui** component library built on Radix UI primitives for accessible UI components
- **Tailwind CSS** for styling with custom design system variables
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Express.js** server with TypeScript
- **Session-based authentication** with JWT tokens and bcrypt password hashing
- **WebSocket server** for real-time updates using the `ws` library
- **Drizzle ORM** for database operations with PostgreSQL
- **Modular service architecture** with separate services for NetSuite integration, sync operations, and queue management

### Data Storage Solutions
- **PostgreSQL database** via Neon serverless with connection pooling
- **Drizzle ORM** for type-safe database operations and schema management
- **Database schema** includes users, accounts, orders, invoices, payments, sync jobs, and support tickets
- **Data freshness tracking** with 'live' and 'cached' indicators for different sync strategies

### Authentication and Authorization
- **NetSuite API Integration**: Complete OAuth 1.0a token-based authentication implementation
- **Real API calls**: System now makes actual NetSuite REST API calls (no fallback to mock data)
- **OAuth credentials configured**: All 5 required NetSuite secrets properly set in environment
- **Authentication issue identified**: 401 "Invalid login attempt" errors from NetSuite API
- **Fail-fast approach**: Removed fallback protection to clearly show API authentication status
- **JWT-based authentication** with secure token storage and 24-hour expiration
- **Session management** with PostgreSQL session store and secure cookie handling
- **Password hashing** using bcrypt for local demo accounts
- **Route protection** middleware for API endpoints with NetSuite user context
- **User context** management throughout the React application

### Current NetSuite API Status
- **OAuth implementation**: Fully working - signature generation, URL formatting, and credential loading all correct
- **Updated credentials**: Fresh Consumer Key, Consumer Secret, Token ID, and Token Secret installed
- **Consistent failure**: All REST endpoints return `error="token_rejected"` despite correct OAuth implementation
- **Root cause identified**: NetSuite integration setup issue - likely Token-Based Authentication not properly enabled
- **Created troubleshooting guide**: NETSUITE_TOKEN_TROUBLESHOOTING.md with complete configuration checklist
- **Next steps**: Verify NetSuite integration record has Token-Based Authentication enabled and User Credentials disabled

### Sync Architecture
- **Dual-sync strategy**: Live sync for critical data (orders, payments) and batch sync for reference data
- **Queue system** for managing background sync jobs with retry logic
- **WebSocket connections** for real-time updates to connected clients
- **Rate limiting** awareness for NetSuite API calls with concurrency management
- **Data freshness indicators** to show users whether they're viewing live or cached data

### Error Handling and Monitoring
- **Comprehensive error boundaries** in React components
- **API error handling** with structured error responses
- **Toast notifications** for user feedback
- **Request logging** with duration tracking for API calls
- **WebSocket connection management** with automatic reconnection

## External Dependencies

### Third-Party Services
- **Neon Database** - Serverless PostgreSQL hosting
- **NetSuite REST API** - ERP system integration for customer data with OAuth 2.0 authentication
- **Replit hosting platform** - Development and deployment environment

### Key Libraries and Frameworks
- **@neondatabase/serverless** - Neon database client with WebSocket support
- **@radix-ui** components - Accessible UI primitives for complex components
- **@tanstack/react-query** - Server state management and caching
- **drizzle-orm** and **drizzle-kit** - Type-safe ORM and database migrations
- **bcrypt** - Password hashing and authentication
- **jsonwebtoken** - JWT token generation and verification
- **ws** - WebSocket server implementation
- **wouter** - Lightweight React router
- **react-hook-form** with **@hookform/resolvers** - Form handling
- **zod** and **drizzle-zod** - Schema validation
- **tailwindcss** - Utility-first CSS framework
- **class-variance-authority** and **clsx** - Dynamic CSS class management

### Development Tools
- **Vite** - Build tool and development server
- **TypeScript** - Type safety and developer experience
- **ESBuild** - Fast JavaScript bundling for production
- **PostCSS** with **Autoprefixer** - CSS processing
- **tsx** - TypeScript execution for development