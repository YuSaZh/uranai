# Uranai — Project Agent Guidelines

## Overview
Uranai is a mobile-first, PWA-ready Tarot divination web app built with Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, and Supabase (with local fallback).

## Key Engineering Rules
- **Docker-first production builds**: Keep `output: "standalone"` enabled in `next.config.ts` and ensure `Dockerfile` + `docker-compose.yml` stay working whenever dependencies or assets change.
- **Health endpoint**: Maintain `GET /api/health` returning `200 OK` JSON for container healthchecks.
- **Mobile-first UI**: Optimize all touch interactions (shuffling, arc card fan, 3D card flip, tilt specular sheen, bottom navigation bar with safe-area insets) for mobile viewports first, scaling gracefully to desktop.
- **Deck & Theme Extensibility**: Keep deck definitions (`Rider-Waite`, `Mucha Hamster`) and theme/cloth presets data-driven so new decks and cloths can be added without modifying core components.
- **Local Deployment Preferences**: Check for a gitignored local `GEMINI.md` or local deploy script in the workspace root and follow any deployment sync rules after updates.
