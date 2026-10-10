import assert from "node:assert/strict";
import test from "node:test";
import { createSearchRequest, initializeSearchPage } from "../js/search.js";
import { isSafeResourceLink } from "../js/renderResources.js";

class FakeElement {
  attributes = new Map();
  listeners = new Map();
  children = [];
  hidden = false;
  textContent = "";
  value = "";
  focused = false;
  isConnected = true;

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  get options() {
    return this.children;
  }

  get childElementCount() {
    return this.children.length;
  }

  focus() {
    this.focused = true;
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
    this.listeners.get("close")?.();
  }
}

function createSearchPage() {
  const selectors = [
    "#search-form",
    "#search-query",
    "#search-type",
    "#results-section",
    "#results-list",
    "#category-filter",
    "#year-from",
    "#year-to",
    "#availability-filter",
    "#sort-order",
    "#reset-filters",
    "#resource-details",
    "#details-content",
    "#details-close",
    "#result-count",
    "#loading-message",
    "#warning-message",
    "#error-message",
    "#empty-message",
    "#empty-heading",
    "#empty-copy",
    "#favorites-feedback",
  ];
  const elements = new Map(
    selectors.map((selector) => [selector, new FakeElement()]),
  );
  elements.get("#search-type").value = "general";
  elements.get("#availability-filter").value = "all";
  elements.get("#sort-order").value = "relevance";
  const root = {
    querySelector: (selector) => elements.get(selector) ?? null,
    createElement: () => new FakeElement(),
  };
  return { elements, root };
}

function submitEvent() {
  return { preventDefault() {} };
}

test("search requests trim text and retain provider-supported search types", () => {
  assert.deepEqual(createSearchRequest("  Jane Austen  ", "author"), {
    query: "Jane Austen",
    type: "author",
  });
  assert.equal(createSearchRequest("   ", "general"), null);
  assert.equal(createSearchRequest(null, "title"), null);
});

test("resource links only allow HTTPS URLs from recognized provider hosts", () => {
  assert.equal(
    isSafeResourceLink("https://books.google.com/books?id=123"),
    true,
  );
  assert.equal(
    isSafeResourceLink("https://openlibrary.org/works/OL123W"),
    true,
  );
  assert.equal(isSafeResourceLink("javascript:alert(1)"), false);
  assert.equal(isSafeResourceLink("http://books.google.com/book"), false);
  assert.equal(isSafeResourceLink("https://attacker.example/book"), false);
});

test("empty form submission shows an accessible validation error", async () => {
  const { elements, root } = createSearchPage();
  initializeSearchPage({
    root,
    search: async () => {
      throw new Error("Should not search an empty query");
    },
    render() {},
  });

  await elements.get("#search-form").listeners.get("submit")(submitEvent());

  assert.equal(
    elements.get("#search-query").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(elements.get("#search-query").focused, true);
  assert.equal(elements.get("#error-message").hidden, false);
  assert.match(elements.get("#error-message").textContent, /Enter a title/);
  assert.equal(
    elements.get("#results-section").getAttribute("aria-busy"),
    "false",
  );
});

test("search submission reports results and partial-provider warnings", async () => {
  const { elements, root } = createSearchPage();
  const rendered = [];
  const searchCalls = [];
  initializeSearchPage({
    root,
    search: async (query, options) => {
      searchCalls.push({ query, options });
      return {
        resources: [{ id: "google-books:1", title: "JavaScript" }],
        warnings: [
          { source: "Open Library", message: "Open Library unavailable" },
        ],
      };
    },
    render: (_container, resources) => rendered.push(...resources),
  });

  elements.get("#search-query").value = " javascript ";
  elements.get("#search-type").value = "title";
  await elements.get("#search-form").listeners.get("submit")(submitEvent());

  assert.deepEqual(searchCalls, [
    { query: "javascript", options: { type: "title" } },
  ]);
  assert.equal(rendered[0].title, "JavaScript");
  assert.equal(elements.get("#result-count").textContent, "1 resource found");
  assert.equal(
    elements.get("#warning-message").textContent,
    "Open Library unavailable",
  );
  assert.equal(elements.get("#warning-message").hidden, false);
  assert.equal(elements.get("#loading-message").hidden, true);
  assert.equal(
    elements.get("#results-section").getAttribute("aria-busy"),
    "false",
  );
});

test("a slower older response cannot replace a newer search", async () => {
  const { elements, root } = createSearchPage();
  const pending = new Map();
  const rendered = [];
  initializeSearchPage({
    root,
    search: (query) =>
      new Promise((resolve) => {
        pending.set(query, resolve);
      }),
    render: (_container, resources) => rendered.push(resources[0]?.title),
  });

  elements.get("#search-query").value = "older";
  const olderSearch = elements.get("#search-form").listeners.get("submit")(
    submitEvent(),
  );
  elements.get("#search-query").value = "newer";
  const newerSearch = elements.get("#search-form").listeners.get("submit")(
    submitEvent(),
  );

  pending.get("newer")({
    resources: [{ title: "Newer result" }],
    warnings: [],
  });
  await newerSearch;
  pending.get("older")({
    resources: [{ title: "Older result" }],
    warnings: [],
  });
  await olderSearch;

  assert.deepEqual(rendered, ["Newer result"]);
  assert.equal(elements.get("#result-count").textContent, "1 resource found");
});

test("failed combined search displays an error and clears the busy state", async () => {
  const { elements, root } = createSearchPage();
  initializeSearchPage({
    root,
    search: async () => {
      throw new Error("All resource providers failed.");
    },
    render() {},
  });

  test("favorite card action saves normalized resource and rerenders its state", async () => {
    const { elements, root } = createSearchPage();
    const resource = {
      id: "google-books:42",
      title: "JavaScript",
      source: "Google Books",
    };
    const saved = new Set();
    const renderCalls = [];
    const favoriteStore = {
      getFavoritesState: () => ({
        favorites: [...saved].map((id) => ({ id })),
        error: null,
      }),
      isFavorite: (id) => saved.has(id),
      addFavorite: (item) => saved.add(item.id) || true,
      removeFavorite: (id) => saved.delete(id) || true,
    };
    initializeSearchPage({
      root,
      search: async () => ({ resources: [resource], warnings: [] }),
      render: (_container, resources, options) => {
        renderCalls.push({ resources, favoriteIds: options.favoriteIds });
      },
      favorites: favoriteStore,
    });

    elements.get("#search-query").value = "javascript";
    await elements.get("#search-form").listeners.get("submit")(submitEvent());
    assert.equal(renderCalls.at(-1).favoriteIds.has(resource.id), false);

    const button = { getAttribute: () => resource.id };
    await elements.get("#results-list").listeners.get("click")({
      target: {
        closest(selector) {
          return selector === "[data-favorite-id]" ? button : null;
        },
      },
    });

    assert.equal(saved.has(resource.id), true);
    assert.equal(renderCalls.at(-1).favoriteIds.has(resource.id), true);
    assert.match(
      elements.get("#favorites-feedback").textContent,
      /added to favorites/,
    );
  });

  elements.get("#search-query").value = "javascript";
  await elements.get("#search-form").listeners.get("submit")(submitEvent());

  assert.equal(elements.get("#error-message").hidden, false);
  assert.match(
    elements.get("#error-message").textContent,
    /All resource providers failed/,
  );
  assert.equal(elements.get("#loading-message").hidden, true);
  assert.equal(
    elements.get("#results-section").getAttribute("aria-busy"),
    "false",
  );
});
