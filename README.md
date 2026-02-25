# Pharma Press Releases Search Platform

A full-stack press release intelligence app that scrapes pharma company newsrooms, indexes content in Elasticsearch, and provides a modern React UI for search, filtering, highlighting, and deep reading.

## What this project does

- Scrapes press releases from multiple pharma websites (AstraZeneca, Johnson & Johnson, Merck, Novo Nordisk, Pfizer).
- Normalizes and stores content in a relational DB layer.
- Indexes documents into Elasticsearch for full-text search and filtering.
- Exposes FastAPI endpoints for list, search, filter config, detail fetch, and paginated retrieval.
- Provides a React frontend with advanced UX for filtering and discovery.

## Core functionalities

### Data ingestion & indexing

- Multi-source scraping with site-specific selectors in `scrape_press_releases.py`.
- Date parsing and normalization.
- Main content extraction/cleanup for article text.
- Elasticsearch indexing and query service via `elasticsearch_service.py` and `es_indexer.py`.

### Backend API (FastAPI)

Defined in `services.py`:

- `GET /health` — health check.
- `GET /api/initial-data` — initial releases + filter config.
- `GET /api/filter-config` — dynamic filter schema/options.
- `GET /api/press-releases` — full list.
- `GET /api/query-press-releases` — query + company + date filtering.
- `GET /api/press-releases/detail?url=...` — full text for selected release.
- `GET /api/filter-press-releases` — title/company/date filtering.
- `GET /api/search` — query search endpoint.
- `GET /press-releases/all?page=&size=` — paginated API.

### Frontend features (React)

Implemented under `frontend/src`:

- Dynamic Search & Filters panel driven by backend filter config.
- Company multi-select, date range filters, and search query input.
- Result cards with:
  - Highlighted matched snippets.
  - “Matched in press release” quick-jump actions.
  - Full text open action.
- Detail modal with:
  - Full-text rendering and structure cleanup.
  - Query-term highlighting.
  - Scroll-to-match behavior on snippet click.
- Modern UI/UX polish:
  - High-tech visual theme, responsive layout.
  - Hover transitions and card entrance animations.
  - Styled pagination and modal interactions.
- Client-side productivity features:
  - Sort results (relevance, newest, oldest, company A–Z, title A–Z).
  - CSV export for currently filtered/sorted results.
  - Saved filter presets (persist across refresh via localStorage).
  - Delete saved preset support.
  - Recent searches (session-level; cleared on refresh).

## Project structure

- `scrape_press_releases.py` — data collection and extraction.
- `database.py` — DB schema and insert helpers.
- `elasticsearch_service.py` — ES connection/query/index logic.
- `es_indexer.py` — indexing pipeline helper.
- `services.py` — FastAPI server.
- `press_releases.json` — exported/collected dataset snapshot.
- `frontend/` — React application.

## Run locally

## 1) Backend

From project root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn elasticsearch sqlalchemy beautifulsoup4 playwright python-dateutil
python -m playwright install
python services.py 8000
```

Backend runs at: `http://localhost:8000`

## 2) Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000`

## 3) Build frontend

```bash
cd frontend
npm run build
```

## Notes

- Elasticsearch should be running before backend queries are executed.
- Frontend expects backend on `localhost:8000`.
- Snapshot HTML files from website crawling are organized under `website_html_sources/`.

