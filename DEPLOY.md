# Deploying Court Piece

The app has two pieces, deployed separately:

```
React client (Vercel)  ←──Socket.io──→  Node server (Render)
```

Deploy the **server first** so you have its URL for the client.

---

## 1. Server → Render

1. Go to <https://dashboard.render.com> and sign in with GitHub.
2. **New ➜ Blueprint**, pick the `25nandar/Court-Piece` repo. Render reads
   [`render.yaml`](render.yaml) and proposes the `court-piece-server` web service.
3. Click **Apply**. First build takes a couple of minutes.
4. When it's live, copy the URL — it looks like
   `https://court-piece-server.onrender.com`. Open `…/health` in a browser; you
   should see `{"ok":true}`.

> The free plan sleeps after ~15 min idle, so the first request after a nap
> takes ~50s to wake (cold start). Fine for casual play.

You'll set `CLIENT_ORIGIN` on Render in step 3 (after you have the Vercel URL).

---

## 2. Client → Vercel

1. Go to <https://vercel.com> and sign in with GitHub.
2. **Add New ➜ Project**, import `25nandar/Court-Piece`.
3. Set **Root Directory** to `client`. Vercel auto-detects Vite (build
   `npm run build`, output `dist`) via [`client/vercel.json`](client/vercel.json).
4. Under **Environment Variables**, add:
   - `VITE_SERVER_URL` = your Render URL from step 1
     (e.g. `https://court-piece-server.onrender.com`)
5. **Deploy**. You'll get a URL like `https://court-piece.vercel.app`.

> `VITE_*` vars are baked in at **build** time. If you change `VITE_SERVER_URL`
> later, trigger a redeploy.

---

## 3. Lock down CORS (recommended)

Back on Render, open the service ➜ **Environment** ➜ add:

- `CLIENT_ORIGIN` = your Vercel URL (e.g. `https://court-piece.vercel.app`)

Save; Render redeploys. Now only your frontend can connect. (Leaving it unset
allows all origins, which is fine for testing.)

---

## 4. Play

Share your Vercel URL with friends. One person creates a room, others join with
the 6-character code. Done.

---

## Local development

```bash
# terminal 1 — server
cd server && npm install && npm run dev      # http://localhost:3001

# terminal 2 — client
cd client && npm install && npm run dev      # http://localhost:5173
```

The client defaults to `http://localhost:3001` when `VITE_SERVER_URL` is unset,
so no `.env` is needed locally. See the `.env.example` files for reference.
