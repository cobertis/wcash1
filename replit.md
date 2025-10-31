# Walgreens Offers Explorer

## Overview
This is a full-stack web application that integrates with the Walgreens Digital Offers API to provide users with a comprehensive offers management system. The application allows users to look up their membership, browse available offers, clip coupons, and manage their redeemed offers. It also features a powerful Scanner system for bulk account validation with real-time progress tracking. It aims to be a robust tool for managing Walgreens offers and validating accounts at scale, focusing on user-friendly access and real-time data, business vision, market potential, and project ambitions.

## User Preferences
Preferred communication style: Simple, everyday language.
Mobile-first design: Application must be fully optimized for mobile devices as it will be used primarily on mobile.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS with Shadcn UI component library, Radix UI primitives.
- **State Management**: TanStack React Query for server state management.
- **Routing**: Wouter for client-side routing.
- **Build Tool**: Vite.
- **UI/UX Decisions**: Responsive design for mobile-first optimization, clean lookup interface, modern dashboard with responsive sidebar, cards, gradients, and color-coded sections. Organized display of member data, rewards, programs, and preferences. Tabbed interface for offers with mobile-friendly navigation. All routes use a consistent `ControlPanel` with `AdminShell` layout, providing a full-screen experience.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Integration**: Complete Walgreens API service layer including member lookup, offers management (fetch, search, clip, track), store locator, store inventory, and add to cart.
- **Rate Limiting**: Token Bucket architecture for smooth continuous flow and maximum safe throughput:
  - **Design**: 2 token capacity, 0 initial tokens (anti-burst prevents startup spikes that trigger 403s)
  - **Refill rate**: 1 token per 240ms = 250 req/min theoretical maximum per API key
  - **Proven performance**: ~225 req/min per key in production with 66ms average wait time
  - **Zero pauses**: Continuous flow with no 30-60 second waiting periods (vs old fixed-window approach)
  - **Scalability**: Each API key adds ~225 req/min capacity
  - **Current throughput**: 7 active keys = ~1,575 req/min = 94,500 números/hour
  - **Zero errors**: ZERO HTTP 403 rate limit violations achieved in production testing
- **Error Handling**: Centralized error handling middleware.
- **Request Logging**: Custom logging middleware for API requests.

### Database
- **ORM**: Drizzle ORM for type-safe interactions.
- **Database**: PostgreSQL (auto-detects Neon vs. standard PostgreSQL based on `DATABASE_URL`).
- **Schema**: Structured tables for members, offers, clipped offers, redeemed offers, member history, API key management, and scanner-related data (scan_files, scan_queue, scan_results, scan_sessions).
- **Data Persistence**: Data stored in `sessionStorage` for temporary client-side persistence; PostgreSQL for long-term persistence.

### Key Features
- **Scanner System**: Persistent background scanner for bulk account validation with real-time progress updates.
  - Supports uploading multiple `.txt/.csv` files with millions of phone numbers.
  - Instant file upload with deferred background processing.
  - Manual START/STOP control.
  - Real-time WebSocket integration for progress and valid account updates.
  - Duplicate prevention and automatic resumption on server restart.
  - Automatic addition of valid accounts to member history and dashboard updates.
  - CSV export of valid accounts.
- **Backfill Service**: Automated system to enrich ALL accounts with complete location and contact data.
  - Processes all 79,631+ accounts (prioritizes highest balance first)
  - Extracts and saves ZIP code, state, AND email for every account
  - Uses full API key pool (7 keys) with 30 parallel workers for maximum throughput
  - Resumable: Automatically continues from last position after server restart
  - Real-time progress tracking with estimated completion time
  - Zero data loss: Updates database directly with ZIP + state + email fields
- **Downloads & Data Export**: Complete CSV export with comprehensive account information.
  - Exports Phone, Name, Card, Balance, ZIP Code, State, Email, Downloaded status, and Download Date
  - All data sourced directly from database (no client-side calculations)
  - Supports filtering by balance ranges and search
  - Marks exported accounts with download timestamp
- **Comprehensive Offers Management**: Fetch, search, clip, and track offers with real-time API data.
- **Store Locator & Assignment**: Search for stores, view details, assign preferred store.
- **Store Inventory**: Real-time stock levels, product search, barcode scanner integration.
- **Add to Cart Integration**: Product enrichment and cart operations.
- **Robust Member Management**: Member lookup, profile retrieval, and tracking of W Cash rewards.
- **Background Processing**: Asynchronous file processing and background updates for bulk operations (e.g., account updates, offer clipping) without blocking the UI.
- **Performance Optimization**: Optimized database queries and API calls for fast responses. Token Bucket rate limiter ensures smooth continuous flow with 66ms average wait time per request. Current capacity: 7 API keys × 225 req/min = 1,575 req/min total = 94,500 números/hour. Scalable to 20+ keys for proportional throughput increase. ZERO HTTP 403 errors achieved in production testing.
- **Real-time Data**: Emphasis on fresh data directly from Walgreens APIs, with cache invalidation where applicable.

## External Dependencies

- **Walgreens API Integration**:
    - Endpoints for member lookup, profile, offers (available, clipped, redeemed), clipping, search, store locator, store inventory (v4), and add to cart.
    - Authentication via API key and affiliate ID.
    - **API Key Management**: All API keys and affiliate IDs are stored in the PostgreSQL database and managed exclusively through the `/admin/settings` interface. No environment variables are used for API credentials.
    - **Scalable Pool**: Supports an unlimited number of API keys for parallel processing, with individual rate limiting applied via the Token Bucket system.

- **PostgreSQL**: Used as the primary database, with automatic detection and support for Neon serverless database connections.

- **Third-Party Libraries**:
    - **UI Framework**: React with TypeScript.
    - **Styling**: Tailwind CSS with Shadcn UI.
    - **HTTP Client**: Native `fetch` API.
    - **Form Handling**: React Hook Form with Zod validation.
    - **Date Handling**: `date-fns` for date formatting.
    - **Icons**: Lucide React icons.