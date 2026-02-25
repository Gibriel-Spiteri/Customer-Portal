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
- **CRD Rebate API** endpoint for fetching Consumers Cash data from NetSuite custom records

### Data Storage Solutions
- **PostgreSQL database** via Neon serverless with connection pooling
- **Drizzle ORM** for type-safe database operations and schema management
- **Database schema** includes users, accounts, orders, invoices, payments, sync jobs, and support tickets
- **Data freshness tracking** with 'live' and 'cached' indicators for different sync strategies

### Authentication and Authorization
- **Primary Login: NetSuite Customer Email + custentity_legpw**: Users log in with their NetSuite customer email as the username and the `custentity_legpw` custom entity field as the password. Credentials are verified in real-time via SuiteQL query against NetSuite. Local user records are auto-created or synced on first/subsequent logins.
- **NetSuite Customer Center SAML SSO**: Compliant with official NetSuite Customer Center guidelines
- **NetSuite M2M OAuth2 Authentication**: Certificate-based machine-to-machine authentication with PS256 algorithm (WORKING as of Aug 12, 2025)
- **Direct NetSuite Customer Authentication**: Customers authenticate with NetSuite Customer Center credentials
- **Customer Center Role Validation**: Validates SAML SSO permissions and customer center access
- **Customer Data Isolation**: Strict data access control ensuring customers see only their own data
- **Enhanced JWT-based authentication** with customer center validation and 24-hour expiration
- **Customer Access Middleware**: validateCustomerAccess middleware protects all customer data endpoints
- **Session management** with PostgreSQL session store and secure cookie handling
- **Customer Record Validation**: Validates active customer status and web access permissions
- **Route protection** middleware for API endpoints with customer center context validation
- **User context** management with customer center role awareness throughout the application

### NetSuite Integration Status
- **✅ M2M OAuth2 WORKING (Aug 12, 2025)**: Successfully fetching estimate data using SuiteQL queries
  - Using PS256 algorithm (RSASSA-PSS with SHA-256) for JWT signing
  - 4096-bit RSA certificate configured and validated
  - SuiteQL queries executing successfully against transaction records
  - Real-time data retrieval from NetSuite confirmed
- **✅ UPDATED**: Customer Center SAML SSO implementation following NetSuite official guidelines
- **Implementation Enhancement**: Modified to comply with NetSuite Customer Center SAML requirements
- **Authentication flow**: 
  - User clicks "Sign in with NetSuite Customer Center" button
  - Redirected to NetSuite Customer Center SAML Suitelet with proper role validation
  - Customer authenticates with NetSuite Customer Center credentials
  - Suitelet validates customer center access permissions and record status
  - Suitelet generates JWT token with customer center specific information
  - Suitelet redirects back with enhanced customer data in JWT payload
  - Application verifies JWT with customer center validation
  - Creates user session with customer data isolation
- **Customer Center Compliance**:
  - ✅ Customer center role permissions validated (SAML SSO permission = Full)
  - ✅ Customer record validation (active status, web access enabled)
  - ✅ Enhanced token payload with customer center specific data
  - ✅ Customer data isolation middleware implemented
  - ✅ Customer access validation on all data endpoints
  - ✅ Customer-only data filtering and security
- **Enhanced Security**: 
  - Customer center access validation in JWT token processing
  - Customer data isolation on all API endpoints
  - Role-based access control for customer center users
  - Enhanced token validation with customer center permissions
  - Company name and billing address inclusion in customer profile
- **Recent Updates (Aug 11, 2025)**: 
  - **Customer Center SAML Compliance**: Updated SSO to follow NetSuite Customer Center guidelines
  - **Enhanced Token Payload**: Added customer center specific fields (companyName, customerCenterAccess, billingAddress, phone)
  - **Customer Data Isolation**: Implemented validateCustomerAccess middleware for all customer data endpoints
  - **Improved Suitelet**: Created customer_center_sso_suitelet.js with proper customer validation
  - **Updated Documentation**: Added NETSUITE_CUSTOMER_CENTER_SAML_SETUP.md with official NetSuite guidelines
- **Documentation**: 
  - `NETSUITE_CUSTOMER_CENTER_SAML_SETUP.md`: Official NetSuite Customer Center SAML setup guide
  - `netsuite_scripts/customer_center_sso_suitelet.js`: Enhanced Suitelet with customer validation
  - `NETSUITE_SUITELET_SSO_SETUP.md`: Updated with customer center deployment settings

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

## Recent Features (Aug 19, 2025)

### Customer Discount PRA Details Display
- **Promotional Adjustment Breakdown**: Shows non-itemized PRA records from NetSuite under Customer Discount
- **NetSuite Integration**: Fetches actual promotional names from customrecord_txnpra table
- **Clean UI Design**: Right-aligned amounts matching main discount total
- **PRA Type Filtering**: Excludes PROMO-ITEMIZED types, showing only CRD Rebate Redemption and Non-Itemized Promotions
- **Actual NetSuite Names**: Displays "CRD REBATE REDEMPTION" and "Limited Time Spring Into Savings Promo" as they appear in NetSuite

## Previous Features (Aug 14, 2025)

### Header Logo Update
- **Replaced Text with Logo**: Changed "Customer Portal" text to company logo
- **Logo URL**: Uses NetSuite hosted company logo image
- **Responsive Design**: Logo scales appropriately on all device sizes

## Previous Features (Aug 12, 2025)

### Consumers Cash (CRD Rebates)
- **New Page**: `/consumers-cash` displays CRD rebate records from NetSuite
- **Dashboard Integration**: Green quick-access card on dashboard for Consumers Cash
- **API Endpoint**: `/api/crd-rebates` fetches customrecord_crdrebate data using SuiteQL
- **Summary Statistics**: Shows available balance, redeemed amount, expired amount, and total rebates
- **Rebate Details**: Displays date, amount, status, expiration, sales order, and earned percentage
- **Demo Customers**: 
  - Baloga (441667) - Purple button
  - CRD (154783) - Indigo button

### Enhanced Login System (Aug 14, 2025)
- **Simplified Login Interface**: Streamlined email/password authentication
  - Customer Login: Standard email/password authentication only
  - Removed Enterprise, SSO, and Demo tabs for cleaner interface
  - Direct links to password reset and account creation
- **NetSuite OIDC Integration (NEW)**: 
  - OpenID Connect provider discovered: https://1212804.suitetalk.api.netsuite.com/.well-known/openid-configuration
  - Authorization endpoint: https://1212804.app.netsuite.com/app/login/oauth2/authorize.nl
  - Token endpoint: https://1212804.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
  - UserInfo endpoint: https://1212804.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/userinfo
  - PKCE support with S256 code challenge method
  - Supports 'openid' and 'email' scopes
- **OIDC Service Features**:
  - Automatic customer ID retrieval from userinfo endpoint
  - Secure state and PKCE verification
  - Session-based token storage for API calls
  - Automatic user creation or update from OIDC claims
- **Configuration**:
  - NETSUITE_OIDC_CLIENT_ID and NETSUITE_OIDC_CLIENT_SECRET environment variables
  - OAuth 2.0 Client Credentials setup in NetSuite required
  - Redirect URI: /auth/netsuite/oidc/callback

## External Dependencies

### Third-Party Services
- **Neon Database** - Serverless PostgreSQL hosting
- **NetSuite OAuth 2.0 SSO** - Single Sign-On authentication for NetSuite customers
- **NetSuite REST API** - ERP system integration for customer data
- **NetSuite Email RESTlet** - Email service for password resets and welcome messages
  - Script ID: customscript_portal_password_reset
  - Deployment ID: customdeploy_portal_password_reset
  - URL: https://1212804.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=4393&deploy=1
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