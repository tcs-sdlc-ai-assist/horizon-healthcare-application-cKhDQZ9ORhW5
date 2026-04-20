# Horizon Healthcare Dashboards

A comprehensive healthcare analytics platform built with React and Vite, featuring three specialized dashboards for clinical, operational, and financial insights. The application supports role-based access control (RBAC), CSV data import, and responsive design with Tailwind CSS.

## Tech Stack

- **Frontend Framework:** React 18 (JavaScript/JSX)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Charts:** Recharts
- **State Management:** React Context API
- **Testing:** Vitest + React Testing Library
- **Linting:** ESLint

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
git clone <repository-url>
cd horizon-healthcare-dashboards
npm install
```

### Development

```bash
npm run dev
```

The development server starts at `http://localhost:5173` by default.

### Build

```bash
npm run build
```

Outputs production-ready files to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Testing

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Linting

```bash
npm run lint
```

## Folder Structure

```
horizon-healthcare-dashboards/
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images, icons, fonts
│   ├── components/
│   │   ├── common/             # Shared/reusable components (Button, Card, Modal, Table, Spinner)
│   │   ├── charts/             # Chart components (LineChart, BarChart, PieChart, KPICard)
│   │   ├── layout/             # Layout components (Sidebar, Header, Footer, PageWrapper)
│   │   └── csv/                # CSV import/export components
│   ├── contexts/               # React Context providers (AuthContext, ThemeContext, DataContext)
│   ├── dashboards/
│   │   ├── clinical/           # Clinical Dashboard pages and components
│   │   ├── operational/        # Operational Dashboard pages and components
│   │   └── financial/          # Financial Dashboard pages and components
│   ├── hooks/                  # Custom hooks (useAuth, useFetch, useCSVImport, useDebounce)
│   ├── pages/                  # Top-level route pages (Login, NotFound, Unauthorized)
│   ├── services/               # API service modules and data utilities
│   ├── utils/                  # Helper functions (formatters, validators, constants)
│   ├── App.jsx                 # Root component with router and providers
│   ├── main.jsx                # Entry point — renders <App /> in StrictMode
│   └── index.css               # Tailwind directives and global styles
├── .env.example                # Environment variable template
├── index.html                  # HTML entry point
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Features

### Clinical Dashboard

The Clinical Dashboard provides healthcare professionals with real-time patient care analytics:

- **Patient Census:** Track current patient counts across departments, units, and care levels with trend visualizations.
- **Readmission Rates:** Monitor 30-day readmission rates by diagnosis, department, and time period. Identify high-risk patient cohorts.
- **Average Length of Stay (ALOS):** Compare length-of-stay metrics against benchmarks by service line and DRG code.
- **Clinical Quality Metrics:** View infection rates, mortality indices, patient satisfaction scores, and compliance indicators.
- **Alerts & Notifications:** Configurable threshold-based alerts for critical metric deviations.

### Operational Dashboard

The Operational Dashboard enables administrators to optimize facility performance:

- **Bed Occupancy & Utilization:** Real-time bed availability, occupancy percentages, and turnover rates by unit.
- **Staff Scheduling & Ratios:** Nurse-to-patient ratios, shift coverage analysis, and overtime tracking.
- **Emergency Department Metrics:** Door-to-provider times, left-without-being-seen rates, and throughput analysis.
- **Equipment & Resource Tracking:** Utilization rates for operating rooms, imaging equipment, and other critical resources.
- **Wait Time Analytics:** Patient wait times across departments with bottleneck identification.

### Financial Dashboard

The Financial Dashboard delivers actionable financial intelligence:

- **Revenue Cycle Overview:** Gross and net revenue trends, payer mix analysis, and revenue per encounter.
- **Claims & Denials Management:** Denial rates by payer, denial reason analysis, and days in accounts receivable.
- **Cost Analysis:** Cost per case, departmental expense tracking, and variance-to-budget reporting.
- **Profitability Metrics:** Margin analysis by service line, contribution margins, and break-even tracking.
- **Forecasting:** Predictive revenue and expense projections based on historical trends.

## Role-Based Access Control (RBAC)

The application implements role-based access control to ensure users only see data relevant to their responsibilities:

| Role | Clinical Dashboard | Operational Dashboard | Financial Dashboard | User Management |
|------|-------------------|-----------------------|--------------------|-----------------| 
| **Admin** | Full Access | Full Access | Full Access | Full Access |
| **Physician** | Full Access | Read-Only (limited) | No Access | No Access |
| **Nurse Manager** | Read-Only | Full Access | No Access | No Access |
| **Finance Analyst** | No Access | Read-Only (limited) | Full Access | No Access |
| **Executive** | Read-Only | Read-Only | Read-Only | No Access |
| **Viewer** | Read-Only (summary) | Read-Only (summary) | No Access | No Access |

### How RBAC Works

1. **Authentication:** Users log in with credentials. The `AuthContext` stores the authenticated user and their assigned role.
2. **Route Protection:** Protected routes check the user's role before rendering. Unauthorized users are redirected to the `/unauthorized` page.
3. **Component-Level Guards:** Individual UI elements (buttons, tabs, data columns) conditionally render based on the user's permissions.
4. **API-Level Enforcement:** Service modules include the user's role token in requests for server-side validation.

## CSV Import Guide

The application supports importing data via CSV files for populating dashboards with external data sources.

### Supported CSV Formats

- **Patient Data:** `patient_id, name, admission_date, discharge_date, department, diagnosis, payer`
- **Financial Records:** `record_id, date, category, amount, department, payer, claim_status`
- **Operational Metrics:** `metric_id, date, department, metric_name, metric_value, unit`

### Import Steps

1. Navigate to the desired dashboard.
2. Click the **Import Data** button in the toolbar.
3. Select a CSV file from your local file system (max 10 MB).
4. The application validates the file structure and displays a preview of the first 10 rows.
5. Map CSV columns to the expected data fields if column headers do not match automatically.
6. Click **Confirm Import** to process the data.
7. A summary displays the number of records imported, skipped, and any validation errors.

### CSV Requirements

- Files must be UTF-8 encoded.
- The first row must contain column headers.
- Date fields must use `YYYY-MM-DD` format.
- Numeric fields must not contain currency symbols or commas.
- Empty rows are automatically skipped.
- Duplicate records (matching on primary key) are flagged for review.

## Environment Variables

Create a `.env` file in the project root based on `.env.example`:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_BASE_URL` | Base URL for the backend API | `http://localhost:3001/api` | Yes |
| `VITE_APP_TITLE` | Application title displayed in the header | `Horizon Healthcare Dashboards` | No |
| `VITE_AUTH_TOKEN_KEY` | LocalStorage key for the auth token | `horizon_auth_token` | No |
| `VITE_ENABLE_MOCK_DATA` | Enable mock data mode for development | `true` | No |
| `VITE_SESSION_TIMEOUT_MS` | Session timeout in milliseconds | `1800000` (30 min) | No |
| `VITE_CSV_MAX_SIZE_MB` | Maximum CSV file size for import (MB) | `10` | No |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking | — | No |

Access environment variables in code via `import.meta.env.VITE_*`:

```js
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
```

> **Note:** Never prefix sensitive secrets with `VITE_` — Vite exposes all `VITE_` variables to the client bundle.

## Deployment

### Static Hosting (Recommended)

The production build outputs static files suitable for any static hosting provider:

```bash
npm run build
```

Deploy the `dist/` directory to:

- **Nginx:** Configure a catch-all rule to serve `index.html` for client-side routing.
- **Apache:** Use `.htaccess` with `FallbackResource /index.html`.
- **AWS S3 + CloudFront:** Upload `dist/` to an S3 bucket with CloudFront distribution. Set error document to `index.html`.
- **Vercel / Netlify:** Connect the repository and set the build command to `npm run build` with output directory `dist`.

### Docker

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### SPA Routing Configuration

Since this is a single-page application using client-side routing, the server must be configured to return `index.html` for all routes. Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Health Checks

The application renders a root `<div id="root">` element. A basic health check can verify the HTML response at `/` returns a 200 status code.

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with HMR |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run test suite with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint across the codebase |

## Browser Support

- Chrome >= 90
- Firefox >= 90
- Safari >= 15
- Edge >= 90

## License

**Private** — This software is proprietary and confidential. Unauthorized copying, distribution, or use of this software is strictly prohibited. All rights reserved.