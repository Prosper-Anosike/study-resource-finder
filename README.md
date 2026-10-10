# Study Resource Finder

A responsive student-facing resource discovery app. The project uses semantic HTML, CSS, and native JavaScript ES modules to search Google Books and Open Library, inspect resources, filter and sort results, and save favorites locally.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- A modern browser
- No JavaScript UI framework

## Setup

```sh
npm install
npm run dev
```

Vite prints the local development URL after startup. Use these commands for checks and a production build:

```sh
npm run format
npm run format:check
npm run lint
npm test
npm run build
```

The static production output is written to `dist/`.

## Architecture

```text
index.html                 Home and search-page structure
favorites.html              Saved-resources page structure
css/styles.css              Design tokens, shared components, responsive layout
js/config.js                API endpoint and application configuration
js/apiClient.js             Provider requests, caching, and combined search
js/resourceNormalizer.js    Google Books and Open Library normalization
js/search.js                Search form handling and accessible status states
js/renderResources.js       Safe, dynamic resource-card rendering
js/resourceDetails.js       Accessible resource-details dialog shell
js/favorites.js             Favorites storage and saved-resources page
js/filtersSort.js            Result category/year/availability filtering and sorting
js/uiHelpers.js             Shared UI helpers
js/main.js                  Home-page entry point
tests/foundation.test.js    Checks for the initial document structure
tests/apiClient.test.js     Mocked API and normalization tests
```

The API client is independent of the DOM. It accepts an injectable `fetch` implementation, runs both providers concurrently, returns successful results with provider-specific warnings when one source fails, and throws `CombinedSearchError` if both fail. Successful identical requests are cached in memory per fetch implementation; failed requests are not cached. The home search form uses this combined API, and resource cards and details are built with DOM methods and `textContent`. Filters and sort order are applied to the current normalized collection without additional API calls.

## APIs

- **Google Books Volumes API:** `GET https://www.googleapis.com/books/v1/volumes?q={query}&maxResults={count}`. General queries use `q`; title, author, and subject queries use the provider syntax `intitle:`, `inauthor:`, and `subject:`.
- **Open Library Search API:** `GET https://openlibrary.org/search.json`. General searches use `q`; title, author, and subject searches use their respective query parameters. The request explicitly selects the application fields and asks for a limited number of results.

Endpoints, result limits, and requested Open Library fields are centralized in `js/config.js`. Configure `VITE_GOOGLE_BOOKS_API_KEY` in the ignored `.env.local` file for local development, then restart Vite to load it. Vite exposes `VITE_` variables to browser code, so this key is not a secret and should be restricted using the provider's key settings. Never commit `.env.local` or place the key in tracked source.

### Common resource schema

Both providers normalize into the same resource shape:

```text
{
  id, source, sourceId, title, authors, description, publisher,
  publishedDate, pageCount, categories, isbn, thumbnail,
  previewUrl, infoUrl, fullTextAvailable
}
```

`id` is source-prefixed to prevent provider collisions; `source` is `Google Books` or `Open Library`. Missing scalar metadata is `null`, missing authors/categories/ISBNs are empty arrays, and `fullTextAvailable` is `true`, `false`, or `null` when unknown. Open Library Search does not provide a description or page count in the selected fields, so those values remain `null`. External URLs are HTTPS-only and host-validated before being included. API-provided text remains data; UI code must render it as text, never raw HTML.

### Favorites storage

Favorites are stored as a JSON array under the versioned key `study-resource-finder:favorites:v1`. Each entry contains the normalized provider ID/source plus available title, authors, cover, publication date, description, publisher, page count, categories, ISBNs, preview/information URLs, and full-text availability. Entries are deduplicated by source-prefixed ID. Malformed records are ignored; unreadable storage is reported in the interface. No account or server storage is used.

## Project requirements

- Use semantic HTML, responsive CSS, and vanilla JavaScript ES modules.
- Do not add React, Vue, Angular, Svelte, or another JavaScript UI framework.
- Use the proposal palette: primary `#4F46E5`, secondary `#10B981`, background `#F9FAFB`, text `#111827`, and accent `#F59E0B`.
- Use Inter with sans-serif system fallbacks.
- Keep resource metadata safe to render; never assume external API content is trusted.
- Avoid hardcoded sample resource records or claiming unfinished API features work.

## Implemented project phases

Phase 1 set up the project structure, page shells, shared visual system, responsive layout, accessible dialog shell, and lightweight development tooling. Phase 2 adds API requests, result normalization, concurrent combined search, partial-failure status, and in-memory request caching. Phase 3 connects the search form to the combined API and renders accessible, responsive resource cards. Phase 4 adds resource details, category/year/availability filtering, sorting, and reset controls. Phase 5 adds localStorage-backed favorites and a persistent Favorites page.
