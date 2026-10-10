import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const root = new URL("../", import.meta.url);

test("the required project modules and pages exist", async () => {
  const files = [
    "index.html",
    "favorites.html",
    "css/styles.css",
    "js/config.js",
    "js/apiClient.js",
    "js/search.js",
    "js/renderResources.js",
    "js/resourceDetails.js",
    "js/favorites.js",
    "js/filtersSort.js",
    "js/uiHelpers.js",
    "js/main.js",
  ];

  await Promise.all(files.map((file) => access(new URL(file, root))));
});

test("the home page exposes accessible search, status, results, and dialog landmarks", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /<main\b/);
  assert.match(html, /<form id="search-form"/);
  assert.match(html, /id="search-query"/);
  assert.match(html, /id="search-type"/);
  assert.match(html, /id="category-filter"/);
  assert.match(html, /id="year-from"/);
  assert.match(html, /id="year-to"/);
  assert.match(html, /id="availability-filter"/);
  assert.match(html, /id="sort-order"/);
  assert.match(html, /id="reset-filters"/);
  assert.match(html, /id="loading-message"[^>]*role="status"/);
  assert.match(html, /id="warning-message"[^>]*role="status"/);
  assert.match(html, /id="error-message"[^>]*role="alert"/);
  assert.match(html, /id="empty-message"[^>]*role="status"/);
  assert.match(html, /id="results-section"[^>]*aria-busy="false"/);
  assert.match(html, /id="result-count"[^>]*aria-live="polite"/);
  assert.match(html, /id="results-list"[^>]*class="resource-grid"/s);
  assert.match(html, /<dialog\b[^>]*id="resource-details"/s);
  assert.match(html, /id="details-close"[^>]*>\s*Close/s);
  assert.match(html, /id="details-content"/);
});

test("the favorites page has an accessible empty state and discover navigation", async () => {
  const html = await readFile(new URL("favorites.html", root), "utf8");

  assert.match(html, /<main\b/);
  assert.match(html, /id="favorites-empty"[^>]*role="status"/);
  assert.match(html, /href="\/">Discover resources<\/a>/);
  assert.match(html, /<div id="favorites-list"[^>]*aria-live="polite"/);
});

test("the shared stylesheet declares the proposal design tokens", async () => {
  const css = await readFile(new URL("css/styles.css", root), "utf8");

  for (const token of ["#4f46e5", "#10b981", "#f9fafb", "#111827", "#f59e0b"]) {
    assert.ok(css.includes(token), `Expected stylesheet to declare ${token}`);
  }
});

test("the stylesheet provides purposeful effects and honors reduced motion", async () => {
  const css = await readFile(new URL("css/styles.css", root), "utf8");

  assert.match(css, /\.resource-card:hover\s*\{[^}]*transform:\s*translateY/s);
  assert.match(
    css,
    /\.resource-card:hover \.resource-cover img\s*\{[^}]*scale/s,
  );
  assert.match(css, /\.resource-favorite-button\.is-favorited\s*\{/);
  assert.match(css, /\.details-dialog\[open\]\s*\{\s*animation:/);
  assert.match(css, /\.loading-spinner\s*\{[^}]*animation:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms !important/);
  assert.match(css, /@media \(min-width: 701px\) and \(max-width: 960px\)/);
  assert.match(
    css,
    /\.resource-card-content > \.resource-details-button\s*\{[^}]*min-height:\s*40px/s,
  );
});

test("the pages expose focusable navigation and a labeled search form", async () => {
  const [home, favorites, css] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("favorites.html", root), "utf8"),
    readFile(new URL("css/styles.css", root), "utf8"),
  ]);

  assert.match(home, /<a class="skip-link" href="#main-content">/);
  assert.match(home, /<nav class="primary-nav" aria-label="Main navigation">/);
  assert.match(home, /<label class="visually-hidden"\s+for="search-query"\s*>/);
  assert.match(home, /<label class="visually-hidden"\s+for="search-type"\s*>/);
  assert.match(home, /aria-current="page"/);
  assert.match(favorites, /aria-current="page"/);
  assert.match(css, /\.button:focus-visible/);
  assert.match(css, /\.resource-favorite-button:focus-visible/);
  assert.match(css, /\.resource-link:focus-visible/);
});

test("missing book-cover fallback text remains available to assistive technology", async () => {
  const renderer = await readFile(
    new URL("js/renderResources.js", root),
    "utf8",
  );

  assert.match(renderer, /fallback\.textContent = "Book cover unavailable"/);
  assert.doesNotMatch(
    renderer,
    /fallback\.setAttribute\("aria-hidden", "true"\)/,
  );
});
