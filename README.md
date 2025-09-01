# Warehouse Management System (Minimal)

A simple, web-based warehouse management system using Node.js, Express, and SQLite.

## Features
- Item management: add, search, edit, delete
- Floor/room management
- Image upload for items
- Responsive web UI (desktop/mobile)

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