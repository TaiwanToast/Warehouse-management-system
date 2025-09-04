# Warehouse Management System (Minimal)

A simple, web-based warehouse management system using Node.js, Express, and SQLite.

## Features
- Item management: add, search, edit, delete
- Floor/room management
- Image upload for items
- Responsive web UI (desktop/mobile)
- User auth (header x-user-id), role "開發人員" (admin)
- Item history log, quantity/borrow/dispatch
- iOS-like UI, floor/room filters, image preview

## Quick Start

### 1. Downlowd Nodejs v20.19.4
link [text](https://nodejs.org/en/download)

### 2. Downlowd and install cloudflared
link [text](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

### 3. cd to Warehouse management system
```bash
cd Warehouse management system
```
```bash
node .\src\server.js
```
```
cloudflared tunnel --url http://localhost:3000
```

- The app runs at: http://localhost:3000
- Uploaded images are stored in the `uploads/` folder.
- Data is stored in `warehouse.db` (SQLite).

## Safe Update (do not touch warehouse.db/uploads)

Use the provided batch script on Windows:

```bat
update-wms.bat
:: or specify a port
update-wms.bat /PORT=3001
```

What it does:
- Stop old node process
- Backup `warehouse.db` and `uploads/` to `backup/YYYYMMDD_HHMMSS/`
- `git fetch` + `git reset --hard origin/main`
- `npm ci` and start server

Make sure `.gitignore` contains:
```
warehouse.db
uploads/
```

## API Changes (pagination)

`GET /api/items` now returns paginated result:

```json
{
  "data": [ { /* item */ } ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 123,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Query params: `q`, `floor_id`, `room_id`, `page`, `limit`.

Item history endpoint `GET /api/items/:id/history` also supports pagination with `page`, `limit` and returns the same structure.

## Admin Stats

`GET /api/stats` (admin only, user "開發人員") returns:

```json
{
  "items": { "total": 0, "available": 0, "borrowed": 0, "returned": 0 },
  "users": { "total": 0 },
  "locations": { "floors": 0, "rooms": 0 },
  "history": { "total": 0 },
  "inventory": { "total_quantity": 0, "total_borrowed": 0, "available_quantity": 0, "low_stock_items": 0 }
}
```

## Performance

- Added indexes for common filters and joins (owner_user_id, status, floor_id+room_id, created_at, etc.)
- Pagination on heavy list endpoints
- Simple read-cache (5 min) with cache invalidation on writes

## Project Structure
- `src/` — Backend (Express server, DB logic, schema)
- `public/` — Frontend (HTML, JS, CSS)
- `uploads/` — Uploaded images
- `package.json` — Project config & dependencies

## Deployment
- For production, use Docker or deploy to a server/NAS.
- To expose to the internet, use a tunnel tool (e.g., cloudflared) or set up port forwarding.

## Notes
- Deleting an item will also delete its image from `uploads/`.
- For backup, copy `warehouse.db` and `uploads/`.