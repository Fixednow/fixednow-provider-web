# FixedNow Provider Web App

Standalone deployable version of the provider app — connects to the real
FixedNow API over both HTTP and a live WebSocket (via `socket.io-client`),
so it receives genuine job offers pinged from real customer requests rather
than the "Simulate incoming job" demo buttons the artifact version used.

## Identity

There's no provider login yet (see the API's known gaps), so this app acts
as one hardcoded demo provider — **Davey Quinn**, the provider seeded by
`seed.sql` (id `11111111-1111-1111-1111-111111111111`), who offers Mechanic,
Tyre Fitter, Roadside Assistance, and Handyman near Rathmines, Dublin.

## How the real-time flow works

1. On load, connects to the API's Socket.IO server and identifies as this
   provider.
2. Toggling "Go Online" emits `provider:setOnline` — this is what makes the
   backend's matching engine actually consider this provider when
   broadcasting a job.
3. When a real customer request broadcasts to this provider, a `job:offer`
   socket event arrives with the offer/job IDs; the app then fetches the
   full job details over HTTP to show the category, address, and any
   attached photos.
4. Accept/Decline call the real `POST /jobs/:jobId/offers/:offerId/accept`
   or `.../decline` endpoints.
5. "Mark as Arrived/In progress" calls `POST /jobs/:jobId/status`; the final
   "Mark complete" calls `POST /jobs/:jobId/complete` with placeholder photo
   URLs (there's no real camera/upload wired up — see "Not yet built" below).

## Deploy

Push this whole folder to a new GitHub repo, then create a **Static Site**
on Render pointing at it:

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## Not yet built

- Real provider login (multiple providers, not just the one hardcoded demo)
- Real photo capture/upload (still placeholder URLs)
- Real GPS location streaming (the backend supports `provider:location`
  events, but this app doesn't emit them)
