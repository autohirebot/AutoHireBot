# Frontend Migration Guide

## Current State
- Old site: `public/` (vanilla HTML, served by Firebase Hosting)
- New site: `frontend/` (Next.js + TypeScript + Tailwind)

## Migration Steps

1. Build the Next.js app: `cd frontend && npm run build`
2. Output goes to `frontend/out/` (static export)
3. To switch hosting, update `firebase.json`:
   - Change `"public": "public"` to `"public": "frontend/out"`
4. Deploy: `firebase deploy --only hosting`

## Pages Migrated
- [x] Landing page (`/`)
- [x] Jobs listing (`/jobs`)
- [x] Seeker registration (`/register/seeker`)
- [x] Recruiter registration (`/register/recruiter`)
- [ ] Admin dashboard
- [ ] Recruiter dashboard
- [ ] Blog pages

## Shared Config
Firebase config is in `src/lib/firebase.ts`
