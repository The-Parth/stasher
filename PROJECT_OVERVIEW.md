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

## Technical architecture (deeper view)
### Frontend runtime
- `src/app/page.tsx` handles stash discovery and clone orchestration.
- `src/app/stash/[id]/page.tsx` is the primary workspace for unlock, navigation, mutation, autosave, search navigation, and drag-drop ordering.
- UI behavior is split into focused components in `src/components` (section tree, link cards, forms, settings, theme modal, search, toasts).

### Data model
- Core domain types are in `src/lib/types.ts`:
  - `Stash` root object with metadata timestamps and `schemaVersion`
  - recursive `StashSection` structure (`children` + local `links`)
  - `StashLink` records with URL/label/preview metadata
- Utility constructors and immutable helpers in `src/lib/stash.ts` drive ID generation, path-based traversal, and deterministic view targeting.

### Encryption and access control flow
- Crypto primitives are in `src/lib/crypto.ts`, using WebCrypto APIs:
  - PBKDF2 key derivation (`250,000` iterations)
  - AES-GCM for stash content encryption
  - AES-KW for wrapping/unwrapping master keys
- V2 payload design separates concerns cleanly:
  - encrypted payload (`iv`, `ciphertext`)
  - wrapped master key metadata (`masterSalt`, `masterWrappedKey`)
  - auth verification metadata (`authSalt`, `authVerifyHash`)
  - optional read-only key wrapping (`readSalt`, `readWrappedKey`)
- Unlock path supports both schema versions:
  - V1 legacy decrypt path retained for compatibility
  - V2 supports role-aware decrypt (`admin` and optional `read`)

### API and persistence layer
- `src/app/api/stash/route.ts`:
  - validates stash IDs
  - prevents collisions through existence checks
  - stores encrypted payloads in Vercel Blob
- `src/app/api/stash/[id]/route.ts`:
  - fetches payloads with no-store semantics
  - verifies authorization hash for update/delete actions
  - supports overwrite updates and permanent deletion
- Blob key scheme is stable and simple (`stashes/{id}.json`), making retrieval predictable and maintenance-friendly.

### Mutation and autosave pipeline
- Stash mutations are applied immutably in page-level helpers and timestamped with `touchStash`.
- Autosave is debounced and payload-size aware, improving responsiveness while protecting persistence reliability.
- For V2 payloads, updates can reuse the unlocked master key path for efficient re-encryption on content changes.

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
- Backward-compatible schema handling enables smooth evolution without losing existing stash accessibility.
- Cleanly separated frontend, crypto, and API layers make the project straightforward to extend.

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
3. Add required environment variables (including Vercel Blob token) and ensure Blob access is enabled for server routes.
4. Deploy.

### 5) Runtime behavior after deployment
- Stash create/read/update/delete API routes execute in Next.js server runtime and persist encrypted JSON blobs.
- `NEXT_PUBLIC_APP_VERSION` is injected from git commit hash via `next.config.ts` and surfaced in the UI for build traceability.
- `robots.ts` + metadata configuration keep the app intentionally non-indexed for privacy-focused usage.

## Why this implementation is strong
- Privacy-first architecture is integrated directly into product flow.
- Storage and API design are simple, scalable, and easy to maintain.
- The project combines strong security patterns with practical usability.
