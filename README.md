# Medimoc

Medimoc is a full-stack starter application for consuming data from a Primavera Microsoft SQL Server database. It includes an Express REST API, a reusable SQL Server connection service, and a Vite React dashboard.

## Stack

- Backend: Node.js, Express, `mssql`, Helmet, CORS, Winston, Zod
- Frontend: React, Vite, Lucide icons
- Database: Microsoft SQL Server

## Project Structure

```text
.
├── backend
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── middleware
│   │   ├── routes
│   │   ├── services
│   │   ├── utils
│   │   └── validators
│   └── .env.example
├── frontend
│   ├── src
│   │   └── services
│   └── .env.example
└── package.json
```

## Prerequisites

- Node.js 20 or newer
- Access to a Microsoft SQL Server instance
- Primavera database credentials

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create backend environment file:

```bash
cp backend/.env.example backend/.env
```

3. Fill in the SQL Server values in `backend/.env`:

```env
DB_SERVER=YOUR_SQL_SERVER_HOST
DB_INSTANCE=YOUR_SQL_SERVER_INSTANCE
DB_DATABASE=YOUR_PRIMAVERA_DATABASE
DB_USER=YOUR_DATABASE_USER
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_PORT=YOUR_SQL_SERVER_PORT
```

Use `DB_PORT` for fixed-port SQL Server connections. Use `DB_INSTANCE` when connecting through a named instance. If both are present, the backend uses `DB_PORT`.

4. Create frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

5. Start both applications:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## API Endpoints

### Health Check

```http
GET /api/health
```

Returns API status, uptime, and timestamp.

### SQL Server Connectivity Test

```http
GET /api/database/test
```

Uses the backend environment configuration to connect to SQL Server and returns the active database name.

### Safe SELECT Query Runner

```http
POST /api/database/select
Content-Type: application/json
```

Example payload:

```json
{
  "query": "SELECT TOP (@limit) * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = @tableType",
  "parameters": {
    "limit": 20,
    "tableType": "BASE TABLE"
  },
  "maxRows": 100
}
```

The endpoint only accepts single `SELECT` statements, rejects mutation keywords, and binds named parameters through the `mssql` request API.

### Database Table Browser

List tables from the configured Primavera database:

```http
GET /api/database/tables?search=customer&limit=200
```

Inspect table columns:

```http
GET /api/database/columns?schemaName=dbo&tableName=YourTable
```

Preview table rows:

```http
GET /api/database/rows?schemaName=dbo&tableName=YourTable&limit=100
```

These endpoints validate the table against SQL Server metadata before querying and only return read-only previews.

## Security Notes

- Database credentials are read only by the backend from `backend/.env`.
- Frontend environment variables only contain public client configuration such as `VITE_API_BASE_URL`.
- Helmet is enabled for HTTP security headers.
- CORS is controlled by `CORS_ORIGIN`.
- Request payloads are validated with Zod before controller execution.
- SQL execution is restricted to parameterized SELECT statements.

## Production Scripts

Build the frontend:

```bash
npm run build
```

Start the backend:

```bash
npm run start
```

Build frontend and start backend:

```bash
npm run start:prod
```

In production, set environment variables through the host platform or a secure secret manager. Do not commit `.env` files.

## Extending Primavera Modules

The backend exposes `/api/primavera/modules` as a placeholder module registry. Add future Primavera ERP modules by creating new route, controller, validator, and service files under the backend structure, then mount the route in `backend/src/routes/index.js`.
