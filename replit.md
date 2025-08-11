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
- **NetSuite OAuth 2.0 SSO**: True Single Sign-On implementation with OAuth 2.0 authorization code flow
- **Direct NetSuite Authentication**: Users authenticate directly with NetSuite, no password storage
- **OAuth 2.0 with PKCE**: Enhanced security using Proof Key for Code Exchange
- **Automatic Token Management**: Access and refresh tokens handled automatically
- **JWT-based authentication** with secure token storage and 24-hour expiration
- **Session management** with PostgreSQL session store and secure cookie handling
- **Password hashing** using bcrypt for local demo accounts only
- **Route protection** middleware for API endpoints with NetSuite user context
- **User context** management throughout the React application

### Current NetSuite SSO Status  
- **✅ WORKING**: Suitelet-based JWT SSO successfully implemented and tested
- **SSO implementation**: NetSuite Suitelet generates JWT tokens for authentication in `netsuite-sso.ts`
- **Authentication flow**: 
  - User clicks "Sign in with NetSuite SSO" button
  - Redirected to NetSuite Suitelet (script=4389&deploy=1) with Replit callback URL
  - User authenticates with NetSuite directly
  - Suitelet generates JWT token with user information
  - Suitelet redirects back to Replit domain `/api/auth/netsuite/sso?sso_token=JWT`
  - Application verifies JWT and creates user session
- **Configuration status**: 
  - ✅ `NETSUITE_SSO_SECRET` environment variable configured and working
  - ✅ `NETSUITE_ACCOUNT_ID`: 1212804
  - ✅ `NETSUITE_SSO_SCRIPT_ID`: 4389 
  - ✅ `NETSUITE_SSO_DEPLOY_ID`: 1
  - ✅ Replit domain integration: `8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev`
- **Security features**: 
  - JWT tokens signed with HMAC-SHA256 using shared secret
  - Token expiration validation
  - Multiple secret format support (base64, plaintext, hex, UTF8)
  - No password storage in application
  - Direct NetSuite authentication
- **Recent fixes (Aug 11, 2025)**: 
  - Fixed JWT signature verification with proper secret handling
  - Added Replit domain callback URL to prevent localhost navigation issues
  - Enhanced token payload parsing for NetSuite's format (id field support)
  - Improved user creation/update logic for SSO users
- **Documentation**: See `NETSUITE_SSO_UPDATE.md` for current setup status and required NetSuite Suitelet updates

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
- **NetSuite OAuth 2.0 SSO** - Single Sign-On authentication for NetSuite customers
- **NetSuite REST API** - ERP system integration for customer data
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