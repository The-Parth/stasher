# Stasher — Project Overview

## What this project is
Stasher is a private link vault built with Next.js. It helps users create personal “stashes” of links that are protected with password-based encryption and organized in a clean, fast interface.

## How it works (high level)
- The app UI is built with Next.js App Router and React components.
- Users can create a stash, open an existing stash, or clone a stash from the landing page.
- Link and section data is encrypted in the browser before being sent to the backend.
- Encrypted stash payloads are stored in Vercel Blob via API routes:
  - `POST /api/stash` creates a stash
  - `GET /api/stash/[id]` reads a stash payload
  - `PUT /api/stash/[id]` updates a stash payload
  - `DELETE /api/stash/[id]` deletes a stash
- The stash page decrypts data locally after password unlock, then supports editing, organizing, and auto-saving.

## Key features (plus points)
- End-to-end privacy design: stash content is encrypted, and robots/indexing are disabled.
- Strong encryption flow with schema-based payload handling and V2 key-wrapping architecture.
- Separate access modes: admin password for edits and optional read-only password for view access.
- Instant stash management: create, open, clone, edit, and delete workflows.
- Smart organization: nested sections, searchable links, and drag-and-drop reordering.
- Smooth UX: autosave, toasts, loading states, and responsive section navigation.
- Easy sharing model through stable stash IDs.
- Built-in theme customization for personalized UI.
- Version visibility in UI using commit hash build metadata.

## Deploy guide
### 1) Prerequisites
- Node.js 20+
- npm
- A Vercel project with Blob storage enabled
- Blob read/write token configured for the deployment environment

### 2) Local setup
```bash
npm ci
npm run dev
```
Open `http://localhost:3000`.

### 3) Production build check
```bash
npm run build
npm run start
```

### 4) Deploy on Vercel
1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add required environment variables (including Vercel Blob token).
4. Deploy.

## Why this implementation is strong
- Privacy-first architecture is integrated directly into product flow.
- Storage and API design are simple, scalable, and easy to maintain.
- The project combines strong security patterns with practical usability.
