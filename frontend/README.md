<h1 align="center">🎂 CakeToHome — Storefront</h1>

<h4 align="center">Premium Cake & Bakery Ordering Platform — Customer Web App</h4>

<p align="center">
  The CakeToHome storefront is a Next.js 14 (App Router) application powered by
  the CakeToHome backend. It provides the customer-facing ordering
  experience, shop dashboards, and delivery-partner dashboards.
</p>

## Tech Stack

- **Next.js 14** (App Router, View Transitions)
- **React 18** + **TypeScript**
- **Tailwind CSS** + **@medusajs/ui**
- **CakeToHome** backend (separate `backend/` package)

## Features

- Shop storefront with product catalog
- Real-time order status dashboards (SSE)
- Delivery-partner and shop dashboards
- Customer authentication
- Cart, checkout, and order tracking

## Getting Started

```bash
# 1. Configure environment
cp .env.template .env

# 2. Install dependencies
yarn install

# 3. Start the dev server (ensure the backend is running first)
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the storefront.

## Project Structure

- `src/app` — App Router pages (store, checkout, dashboard, api)
- `src/components` — UI components (store, dashboard, common)
- `src/lib` — config, types, data clients, server actions

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start Next.js dev server |
| `yarn build` | Production build |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |

See [`/plans`](../plans) for the full phased implementation plan and progress.
