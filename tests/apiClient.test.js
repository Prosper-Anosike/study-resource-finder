import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";
import {
  ApiRequestError,
  CombinedSearchError,
  clearApiCache,
  searchGoogleBooks,
  searchOpenLibrary,
  searchResources,
} from "../js/apiClient.js";
import { OPEN_LIBRARY_SEARCH_FIELDS } from "../js/config.js";
import {
  normalizeGoogleBook,
  normalizeOpenLibraryDocument,
} from "../js/resourceNormalizer.js";

const TEST_GOOGLE_BOOKS_API_KEY = "test-key with&reserved=chars";

function mockResponse(
  payload,
  { ok = true, status = 200, statusText = "OK" } = {},
) {
  return {
    ok,
    status,
    statusText,
    json: async () => payload,
  };
}

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url));
    return handler(calls.at(-1), calls.length);
  };
  return { fetchImpl, calls };
}

function googleVolume(overrides = {}) {
  return {
    id: "google-id-42",
    volumeInfo: {
      title: "Learning JavaScript",
      authors: ["A. Author"],
      description: "A useful guide.",
      publisher: "Example Press",
      publishedDate: "2024",
      pageCount: 250,
      categories: ["Computers"],
      industryIdentifiers: [{ identifier: "9780000000000" }],
      imageLinks: { thumbnail: "http://books.google.com/cover?id=42" },
      previewLink: "https://books.google.com/books?id=42",
      infoLink: "https://books.google.com/books?id=42&source=gbs_api",
    },
    accessInfo: { pdf: { isAvailable: true } },
    ...overrides,
  };
}

function openLibraryDocument(overrides = {}) {
  return {
    key: "/works/OL123W",
    title: "Learning JavaScript",
    author_name: ["A. Author"],
    first_publish_year: 2024,
    subject: ["Computers"],
    cover_i: 12345,
    edition_count: 3,
    isbn: ["9780000000000"],
    publisher: ["Example Press"],
    has_fulltext: true,
    public_scan_b: true,
    ...overrides,
  };
}

test("Google Books constructs safe general, title, author, and subject queries", async () => {
  const { fetchImpl, calls } = mockFetch(() => mockResponse({ items: [] }));
  const cases = [
    ["general", "q", "biology & design"],
    ["title", "q", "intitle:biology & design"],
    ["author", "q", "inauthor:biology & design"],
    ["subject", "q", "subject:biology & design"],
  ];

  for (const [type, key, value] of cases) {
    await searchGoogleBooks(" biology & design ", {
      type,
      fetchImpl,
      apiKey: TEST_GOOGLE_BOOKS_API_KEY,
    });
    const url = calls.at(-1);
    assert.equal(
      url.origin + url.pathname,
      "https://www.googleapis.com/books/v1/volumes",
    );
    assert.equal(url.searchParams.get(key), value);
    assert.equal(url.searchParams.get("maxResults"), "20");
    assert.equal(url.searchParams.get("key"), TEST_GOOGLE_BOOKS_API_KEY);
    assert.ok(
      url.search.includes(
        new URLSearchParams({ key: TEST_GOOGLE_BOOKS_API_KEY }).toString(),
      ),
    );
  }
});

test("Open Library uses documented query parameters and explicitly selected fields", async () => {
  const { fetchImpl, calls } = mockFetch(() => mockResponse({ docs: [] }));
  const cases = [
    ["general", "q"],
    ["title", "title"],
    ["author", "author"],
    ["subject", "subject"],
  ];

  for (const [type, parameter] of cases) {
    await searchOpenLibrary("biology & design", { type, fetchImpl });
    const url = calls.at(-1);
    assert.equal(
      url.origin + url.pathname,
      "https://openlibrary.org/search.json",
    );
    assert.equal(url.searchParams.get(parameter), "biology & design");
    assert.equal(url.searchParams.get("limit"), "20");
    assert.deepEqual(url.searchParams.get("fields").split(","), [
      ...OPEN_LIBRARY_SEARCH_FIELDS,
    ]);
    assert.equal(url.searchParams.has("key"), false);
  }
});

test("Google Books reports missing key configuration without making a request", async () => {
  const { fetchImpl, calls } = mockFetch(() => mockResponse({ items: [] }));

  await assert.rejects(
    searchGoogleBooks("javascript", { fetchImpl, apiKey: "" }),
    /Google Books API key is not configured/,
  );
  assert.equal(calls.length, 0);
});

test("normalizes Google Books volumes and reports a stable source-prefixed ID", () => {
  const resource = normalizeGoogleBook(googleVolume());

  assert.deepEqual(resource, {
    id: "google-books:google-id-42",
    source: "Google Books",
    sourceId: "google-id-42",
    title: "Learning JavaScript",
    authors: ["A. Author"],
    description: "A useful guide.",
    publisher: "Example Press",
    publishedDate: "2024",
    pageCount: 250,
    categories: ["Computers"],
    isbn: ["9780000000000"],
    thumbnail: "https://books.google.com/cover?id=42",
    previewUrl: "https://books.google.com/books?id=42",
    infoUrl: "https://books.google.com/books?id=42&source=gbs_api",
    fullTextAvailable: true,
  });
});

test("normalizes Open Library documents and reports a provider-prefixed ID", () => {
  const resource = normalizeOpenLibraryDocument(openLibraryDocument());

  assert.deepEqual(resource, {
    id: "open-library:/works/OL123W",
    source: "Open Library",
    sourceId: "/works/OL123W",
    title: "Learning JavaScript",
    authors: ["A. Author"],
    description: null,
    publisher: "Example Press",
    publishedDate: "2024",
    pageCount: null,
    categories: ["Computers"],
    isbn: ["9780000000000"],
    thumbnail: "https://covers.openlibrary.org/b/id/12345-M.jpg",
    previewUrl: null,
    infoUrl: "https://openlibrary.org/works/OL123W",
    fullTextAvailable: true,
  });
});

test("missing or malformed optional metadata has consistent fallbacks", () => {
  const google = normalizeGoogleBook({
    id: "incomplete",
    volumeInfo: {
      authors: [null, "", 1],
      description: "",
      publisher: null,
      pageCount: -1,
      categories: null,
      industryIdentifiers: null,
      imageLinks: { thumbnail: "javascript:alert(1)" },
      previewLink: "https://attacker.example/preview",
      infoLink: "https://user:pass@books.google.com/book",
    },
  });
  const openLibrary = normalizeOpenLibraryDocument({
    key: "/works/OL123W",
    author_name: null,
    first_publish_year: "not-a-year",
    subject: [null, "History"],
    cover_i: "12345",
    isbn: null,
    publisher: [],
  });

  assert.equal(google.title, null);
  assert.deepEqual(google.authors, []);
  assert.equal(google.description, null);
  assert.equal(google.publisher, null);
  assert.equal(google.publishedDate, null);
  assert.equal(google.pageCount, null);
  assert.deepEqual(google.categories, []);
  assert.deepEqual(google.isbn, []);
  assert.equal(google.thumbnail, null);
  assert.equal(google.previewUrl, null);
  assert.equal(google.infoUrl, null);
  assert.equal(google.fullTextAvailable, null);
  assert.deepEqual(openLibrary.authors, []);
  assert.equal(openLibrary.publishedDate, null);
  assert.deepEqual(openLibrary.categories, ["History"]);
  assert.deepEqual(openLibrary.isbn, []);
  assert.equal(openLibrary.publisher, null);
  assert.equal(openLibrary.thumbnail, null);
  assert.equal(openLibrary.infoUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(openLibrary.fullTextAvailable, null);
});

test("malformed records without stable provider IDs are skipped", () => {
  assert.equal(normalizeGoogleBook({ volumeInfo: { title: "No ID" } }), null);
  assert.equal(normalizeGoogleBook(null), null);
  assert.equal(normalizeOpenLibraryDocument({ title: "No key" }), null);
  assert.equal(normalizeOpenLibraryDocument([]), null);
});

test("empty or absent result collections return an empty array", async () => {
  const { fetchImpl } = mockFetch(() => mockResponse({}));
  assert.deepEqual(
    await searchGoogleBooks("empty", {
      fetchImpl,
      apiKey: TEST_GOOGLE_BOOKS_API_KEY,
    }),
    [],
  );
  assert.deepEqual(await searchOpenLibrary("empty", { fetchImpl }), []);
  assert.deepEqual(await searchGoogleBooks(" ", { fetchImpl }), []);
});

test("HTTP, network, and malformed JSON failures are explicit", async () => {
  const httpFailure = mockFetch(() =>
    mockResponse(
      {},
      {
        ok: false,
        status: 429,
        statusText: `${TEST_GOOGLE_BOOKS_API_KEY} Too Many Requests`,
      },
    ),
  );
  await assert.rejects(
    searchGoogleBooks("http-error", {
      fetchImpl: httpFailure.fetchImpl,
      apiKey: TEST_GOOGLE_BOOKS_API_KEY,
    }),
    (error) =>
      error instanceof ApiRequestError &&
      error.source === "Google Books" &&
      error.status === 429 &&
      !error.message.includes(TEST_GOOGLE_BOOKS_API_KEY),
  );

  const networkFailure = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    searchOpenLibrary("network-error", { fetchImpl: networkFailure }),
    /Open Library request failed: offline/,
  );

  const malformedJson = mockFetch(() => ({
    ok: true,
    json: async () => {
      throw new SyntaxError("unexpected token");
    },
  }));
  await assert.rejects(
    searchOpenLibrary("malformed-json", { fetchImpl: malformedJson.fetchImpl }),
    /The response was not valid JSON/,
  );
});

test("combined search retains successful results and reports the failed provider", async () => {
  const { fetchImpl } = mockFetch((url) => {
    if (url.hostname === "openlibrary.org") {
      return mockResponse({ docs: [openLibraryDocument()] });
    }
    return mockResponse(
      {},
      { ok: false, status: 503, statusText: "Unavailable" },
    );
  });

  const result = await searchResources("partial-success", {
    fetchImpl,
    apiKey: TEST_GOOGLE_BOOKS_API_KEY,
  });
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].source, "Open Library");
  assert.deepEqual(result.warnings, [
    {
      source: "Google Books",
      message: "Google Books request failed: Unavailable",
    },
  ]);
});

test("combined search throws a consistent error when both providers fail", async () => {
  const { fetchImpl } = mockFetch(() =>
    mockResponse({}, { ok: false, status: 503, statusText: "Unavailable" }),
  );

  await assert.rejects(
    searchResources("total-failure", {
      fetchImpl,
      apiKey: TEST_GOOGLE_BOOKS_API_KEY,
    }),
    (error) =>
      error instanceof CombinedSearchError &&
      error.failures.length === 2 &&
      /All resource providers failed/.test(error.message),
  );
});

test("repeated identical searches reuse successful provider responses", async () => {
  clearApiCache();
  const { fetchImpl, calls } = mockFetch((url) =>
    url.hostname === "openlibrary.org"
      ? mockResponse({ docs: [openLibraryDocument()] })
      : mockResponse({ items: [googleVolume()] }),
  );

  const first = await searchResources("cached query", {
    fetchImpl,
    apiKey: TEST_GOOGLE_BOOKS_API_KEY,
  });
  const second = await searchResources("cached query", {
    fetchImpl,
    apiKey: TEST_GOOGLE_BOOKS_API_KEY,
  });

  assert.equal(calls.length, 2);
  assert.equal(first.resources.length, 2);
  assert.equal(second.resources.length, 2);
  assert.notEqual(first.resources[0].id, first.resources[1].id);
});

test("normalization treats metadata as text and rejects unsafe external URLs", () => {
  const hostileMarkup = '<img src=x onerror="alert(1)">';
  const google = normalizeGoogleBook(
    googleVolume({
      volumeInfo: {
        title: hostileMarkup,
        description: hostileMarkup,
        imageLinks: { thumbnail: "https://evil.example/image.jpg" },
        previewLink: "javascript:alert(1)",
        infoLink: "//evil.example/book",
      },
    }),
  );
  const openLibrary = normalizeOpenLibraryDocument({
    key: "https://evil.example/works/OL123W",
    cover_i: 123,
  });

  assert.equal(google.title, hostileMarkup);
  assert.equal(google.description, hostileMarkup);
  assert.equal(google.thumbnail, null);
  assert.equal(google.previewUrl, null);
  assert.equal(google.infoUrl, null);
  assert.equal(openLibrary.infoUrl, null);
  assert.equal(
    openLibrary.thumbnail,
    "https://covers.openlibrary.org/b/id/123-M.jpg",
  );
});
