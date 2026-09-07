# Shopify CRO Partner

Shopify CRO Partner is an embedded Shopify admin app for planning conversion-rate optimization experiments. It provides a store baseline, experiment planning, and the data model needed to turn store observations into measurable tests.

## Current status

The app currently supports:

- An authenticated embedded Shopify admin experience.
- A store overview with shop name, currency, product count, and orders from the last 30 days.
- A lightweight pre-analysis readiness assessment based on recent order volume.
- Creating experiments with a hypothesis, control and treatment variants, and a primary metric.
- Persisting Shopify sessions and CRO records with Prisma and SQLite.
- Shopify uninstall and scope-update webhooks.

Analytics reporting and generated recommendations are present in the navigation, but their pages are currently placeholders for future milestones.

## Tech stack

- React Router 7 and React 18
- Shopify App Bridge and `@shopify/shopify-app-react-router`
- Shopify GraphQL Admin API
- Prisma 6 with SQLite
- TypeScript and Vite
- Shopify CLI

## Prerequisites

- Node.js `20.19+` and `<22`, or `22.12+`
- npm
- A Shopify Partner account
- A development store
- Shopify CLI authenticated with the Partner account

## Getting started

1. Install dependencies:

	```bash
	npm install
	```

2. Link the local project to a Shopify app configuration:

	```bash
	npm run config:link
	```

	Follow the Shopify CLI prompts to select or create the app. This updates the local app configuration; do not commit credentials or secrets.

3. Start the development server:

	```bash
	npm run dev
	```

	Shopify CLI creates the development tunnel, updates the app URLs for the session, and opens the app in the selected development store.

4. Install the app in the development store when prompted. The app requests these Admin API scopes:

	- `read_products`, for the product baseline
	- `read_orders`, for the recent order baseline

The local Prisma database is created and migrated as part of the app setup flow. To run that step explicitly:

```bash
npm run setup
```

## Application areas

| Area | Route | Purpose |
| --- | --- | --- |
| Overview | `/app` | Displays the current store baseline and links to app areas. |
| Analytics | `/app/analytics` | Reserved for store performance reporting. |
| Experiments | `/app/experiments` | Lists experiment records. |
| New experiment | `/app/experiments/new` | Creates a draft experiment with two variants and one primary metric. |
| Experiment detail | `/app/experiments/:id` | Displays an individual experiment. |
| Recommendations | `/app/recommendations` | Reserved for CRO recommendations. |

## Data model

Prisma stores Shopify sessions and the core CRO entities:

- `Experiment`: name, hypothesis, status, and timestamps
- `Variant`: control or treatment options belonging to an experiment
- `Metric`: experiment metrics, including the primary metric
- `Recommendation`: recommendation text, source, and workflow status

Experiments and recommendations are scoped by Shopify shop. The default local database is SQLite at `dev.sqlite`.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Shopify CLI development mode. |
| `npm run build` | Build the React Router application. |
| `npm run start` | Serve the production build. |
| `npm run typecheck` | Generate route types and run TypeScript checks. |
| `npm run lint` | Run ESLint. |
| `npm run setup` | Generate Prisma Client and apply migrations. |
| `npm run deploy` | Deploy the Shopify app configuration and extensions. |

## Configuration

Shopify CLI manages the development environment and provides the app credentials used by the server. The server reads the following values when running outside the normal Shopify CLI flow:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES` (comma-separated; the app configuration defaults to `read_products,read_orders`)
- `SHOP_CUSTOM_DOMAIN` (optional)

The checked-in `shopify.app.toml` contains the app name, scopes, API version, webhook subscriptions, and placeholder URLs. Replace placeholder deployment URLs through Shopify app configuration before deploying to a hosted environment.

## Deployment

Build and serve the application with:

```bash
npm run build
npm run start
```

For Shopify app configuration deployment, use:

```bash
npm run deploy
```

Production hosting must provide the environment variables above, a persistent database strategy, and public HTTPS URLs matching the Shopify app configuration. SQLite is suitable for local development; use a production-ready persistent database setup before running multiple application instances.

## Project structure

```text
app/
  routes/       React Router pages and Shopify webhooks
  services/     Server-side CRO and store analysis logic
  db.server.ts  Prisma client
  shopify.server.ts  Shopify authentication and API setup
prisma/
  schema.prisma  Database models and enums
  migrations/    Database migrations
extensions/     Shopify app extensions
public/         Static assets
```

## License

This project does not currently declare a public license.
