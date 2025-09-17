# Overview

TerraTwin is a full-stack web application for managing bamboo cultivation plots. The application provides a comprehensive dashboard for tracking bamboo plots with features including plot creation, visualization, and detailed plot management. Users can create and manage plots with geographic coordinates, area measurements, bamboo types, and status tracking. The application includes interactive mapping capabilities using Leaflet and provides a clean, dark-themed UI built with modern React components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript for type safety and modern component development
- **Vite** as the build tool and development server for fast hot reloading
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query** for server state management, caching, and data synchronization
- **React Hook Form** with Zod validation for form handling and validation
- **Tailwind CSS** with CSS variables for responsive styling and theming
- **shadcn/ui** component library built on Radix UI primitives for accessible, customizable components

## Backend Architecture
- **Express.js** server with TypeScript for API endpoints
- **RESTful API** design with CRUD operations for plot management
- **Memory storage** implementation with in-memory data persistence and sample data seeding
- **Zod schema validation** for request/response validation using shared schemas
- **Error handling middleware** for consistent API error responses

## Database & Schema Design
- **Drizzle ORM** configured for PostgreSQL with schema-first approach
- **PostgreSQL** database setup (configured but using memory storage currently)
- **Shared schema** between frontend and backend ensuring type consistency
- Plot entity with fields: id, name, coordinates (lat/lng), area, bamboo type, status, notes, timestamps

## UI/UX Design Decisions
- **Dark theme** as default with comprehensive CSS custom properties
- **Component-based architecture** using shadcn/ui for consistency
- **Responsive design** with mobile-first approach using Tailwind breakpoints
- **Interactive maps** using Leaflet for geographic visualization
- **Toast notifications** for user feedback on actions

## Development & Build Setup
- **Monorepo structure** with shared types and schemas between client/server
- **TypeScript** configuration with path aliases for clean imports
- **ESBuild** for production server bundling
- **PostCSS** with Tailwind for CSS processing
- **Vite plugins** for development enhancements (error overlay, cartographer)

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless** - Neon database client for PostgreSQL connection
- **drizzle-orm** and **drizzle-kit** - Type-safe ORM and migration tools
- **express** - Web framework for Node.js backend
- **react** and **react-dom** - Frontend framework
- **vite** - Build tool and development server

## UI Component Libraries
- **@radix-ui/* packages** - Unstyled, accessible UI primitives for components
- **shadcn/ui components** - Pre-built component library using Radix UI
- **tailwindcss** - Utility-first CSS framework
- **lucide-react** - Icon library for consistent iconography

## State Management & Data Fetching
- **@tanstack/react-query** - Server state management and caching
- **react-hook-form** - Form state management with minimal re-renders
- **@hookform/resolvers** - Validation resolvers for React Hook Form
- **zod** - Schema validation library

## Mapping & Visualization
- **Leaflet** (loaded via CDN) - Interactive mapping library for plot visualization

## Routing & Navigation
- **wouter** - Lightweight routing library for React

## Development Tools
- **@replit/vite-plugin-*** - Replit-specific development enhancements
- **tsx** - TypeScript execution for development server
- **typescript** - Type checking and compilation

## Session & Database
- **connect-pg-simple** - PostgreSQL session store for Express sessions
- **nanoid** - URL-safe unique ID generator

The application uses environment variables for database configuration and supports both development and production builds with different optimization strategies.