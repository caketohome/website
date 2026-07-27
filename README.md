<p align="center">
  <h1>🎂 CakeToHome</h1>
</p>

<h2 align="center">
  Premium Cake & Bakery Ordering Platform
</h2>

<p align="center">
CakeToHome is a fullstack premium cake and bakery ordering platform built with Medusa 2.0 and Next.js 14.</p>

# Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Key Features & Architecture](#key-features--architecture)
4. [Getting Started](#getting-started)
5. [Resources](#resources)

# Overview

CakeToHome is built with:

- [Medusa 2.0](https://medusajs.com/) — Headless commerce engine
- [Next.js 14](https://nextjs.org/) — React framework
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript

Features include:

- Shop storefront with product catalog
- Real-time order status dashboards
- Delivery partner and shop dashboards
- User roles and authentication
- CakeToHome Workflows for order lifecycle
- Real-time Server Sent Events

# Project Structure

The project consists of two main directories:

- `/backend` contains the CakeToHome backend (powered by Medusa 2.0) with all custom modules.
  - This handles core functionalities, including user authentication, order management, and more.
- `/frontend` contains the Next.js storefront.
  - This handles the user interface, shop storefronts, dashboards, and more.

# Key Features & Architecture

## Multi-Sided Platform Architecture
- **Customers**: Browse bakery products and place orders
- **Shops**: Receive order notifications, track preparation, and manage products
- **Delivery Partners**: Get job notifications and claim delivery routes

## Real-time Order Workflow
- **Long-running CakeToHome Workflow**: Handles the complete order lifecycle from customer selection through delivery
- **Automatic notifications**: Shops get notified of new orders
- **Delivery partner matching**: System finds available delivery partners for assignments
- **Live order tracking**: Customers receive real-time status updates throughout the process

## Custom Module Implementation
- **Shop module**: Custom entities and business logic for shop management
- **Delivery module**: Delivery partner profiles and delivery assignment handling
- **Order fulfillment**: Order tracking and delivery capabilities

# Getting Started

1. Clone the repository
2. Install all dependencies: `npm run install:all`
3. Set up the backend: `cd backend && npm run setup-db`
4. Start development:
   - Backend: `npm run dev:backend`
   - Frontend: `npm run dev:frontend`

# Resources

- [Medusa 2.0 Documentation](https://docs.medusajs.com/v2) — commerce engine
- [Next.js Documentation](https://nextjs.org/docs) — storefront framework
- [Project Plans](./plans) — implementation plan, progress summary, feature audit
