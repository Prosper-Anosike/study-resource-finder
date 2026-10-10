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

## Render static-site deployment

Create a **Static Site** in Render connected to this GitHub repository and configure:

| Setting              | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| Build command        | `npm install && npm run build`                          |
| Publish directory    | `dist`                                                  |
| Environment variable | `VITE_GOOGLE_BOOKS_API_KEY` = your Google Books API key |

Add the environment variable in the Render service dashboard; do not commit it to the repository. Vite embeds `VITE_` variables into the browser bundle at build time, so changing this value requires a new build/deploy. The key is visible to users of the deployed site and must be restricted in Google Cloud: limit the key to the **Google Books API** and configure an HTTP referrer website restriction for the final site, such as `https://<your-service-name>.onrender.com/*`. If using a custom domain, include its HTTPS referrer pattern as well. Keep localhost referrers only if they are still needed for local development, and never use an unrestricted production key.

After deployment, open the assigned site domain, check the browser Network panel for a successful Google Books request and an Open Library search response, then exercise search, resource details, filters, and Favorites. Deployment and a final domain/key restriction have not been completed by this repository setup; those steps require access to your Render and Google Cloud accounts.

## Trello planning evidence

For course submission, provide the real Trello board link and make the planning trail reviewable. The board should show the project goal, phase/feature cards, acceptance criteria or checklists, progress/status, and completed work. Keep useful evidence such as links to the repository/deployed site and dated screenshots or a short completion note on the relevant cards. Do not claim Trello work is complete until the board has been updated and its link is ready to submit.

## Five-minute demonstration outline

Use this as a timed recording guide; it is an outline, not a recorded video:

| Time      | Demonstration                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Introduce Study Resource Finder and its purpose: helping students discover study books and learning resources.                                                   |
| 0:30–1:05 | Identify Google Books and Open Library, then explain that their responses are normalized into one resource shape with provider-specific IDs and metadata arrays. |
| 1:05–1:55 | Search for a topic, show dynamic results from both sources, source labels, useful metadata, and the loading/result feedback.                                     |
| 1:55–2:35 | Open a resource's Details dialog, show available metadata and safe provider links, then close it with Escape.                                                    |
| 2:35–3:20 | Demonstrate a subject/category or year filter, availability, sorting, and reset; show the no-match state if time permits.                                        |
| 3:20–4:05 | Save a couple of resources, open Favorites, refresh to demonstrate LocalStorage persistence, then remove one.                                                    |
| 4:05–4:40 | Resize or switch to mobile layout; point out responsive cards, keyboard focus, and restrained effects/reduced-motion support.                                    |
| 4:40–5:00 | Summarize the result and identify the repository, deployed site, Trello board, and video as submission artifacts.                                                |

Before recording, verify the deployed API key restriction against the final domain, use a reliable search query, avoid exposing credentials in browser tools, and confirm the Favorites page is in the intended demo state.

## Final submission checklist

- [ ] GitHub repository contains the final project and is accessible to the instructor.
- [ ] Render static site is deployed; its real URL is recorded for submission and both API integrations are checked there.
- [ ] Google Cloud API key is restricted to Google Books and to the final Render/custom-domain HTTP referrers.
- [ ] Trello board contains the project plan, acceptance/progress evidence, and is accessible to the instructor.
- [ ] Approximately five-minute demonstration video is recorded, reviewed for accidental credentials, and its real link is ready to submit.

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

Phase 1 set up the project structure, page shells, shared visual system, responsive layout, accessible dialog shell, and lightweight development tooling. Phase 2 adds API requests, result normalization, concurrent combined search, partial-failure status, and in-memory request caching. Phase 3 connects the search form to the combined API and renders accessible, responsive resource cards. Phase 4 adds resource details, category/year/availability filtering, sorting, and reset controls. Phase 5 adds localStorage-backed favorites and a persistent Favorites page. Phase 6 refines the visual hierarchy, responsive layouts, focus states, cover fallbacks, and motion effects with reduced-motion support.
