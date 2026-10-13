# Bajaj Manju Motors — cloud database + backend

This version uses a hosted PostgreSQL database instead of a local SQLite file. That makes it suitable for a cloud deployment where the app's filesystem may be temporary.

## Deploy using an Android phone

1. Create a **private** GitHub repository and upload the contents of this folder (not the ZIP file itself).
2. Create a PostgreSQL database with a provider such as Neon. Copy its connection string; keep it private.
3. Create a Node web service on a host such as Render and connect it to the GitHub repository.
4. Set the build command to `npm install` and start command to `npm start`.
5. Add environment variables in the host dashboard:
   - `DATABASE_URL` = your PostgreSQL connection string
   - `ADMIN_TOKEN` = a long, random secret (at least 32 characters; do not use the example value)
   - `NODE_VERSION` = `20`
6. Deploy. Open the service URL and append `/api/health` to test the backend. It should show `ok: true` and `database: postgresql`.
7. Open the site's Bookings section and enter the same `ADMIN_TOKEN`, then choose **Connect shared database**.

## Security notes

- Never put `DATABASE_URL` or `ADMIN_TOKEN` into `public/index.html`, source code, screenshots, or a public repository.
- Use a private GitHub repository and HTTPS.
- The booking API does not import incoming WhatsApp chats. Customers must still send their WhatsApp message themselves.
- Add spam/rate limiting and regular backups before relying on this for important business records.
- Existing browser-local bookings are not automatically imported into the hosted database.
- Review the database provider's free-plan limits and backups; availability and pricing can change.

## API
- `GET /api/health`
- `POST /api/bookings`
- `GET /api/bookings` (admin bearer token required)
- `PATCH /api/bookings/:id` (admin bearer token required)
- `DELETE /api/bookings/:id` and `DELETE /api/bookings` (admin bearer token required)
