import {
  API_ENDPOINTS,
  GOOGLE_BOOKS_API_KEY,
  OPEN_LIBRARY_SEARCH_FIELDS,
  SEARCH_LIMITS,
} from "./config.js";
import {
  normalizeGoogleBook,
  normalizeOpenLibraryDocument,
} from "./resourceNormalizer.js";

const SEARCH_TYPES = new Set(["general", "all", "title", "author", "subject"]);
let requestCaches = new WeakMap();

export class ApiRequestError extends Error {
  constructor(source, message, status = null) {
    super(`${source} request failed: ${message}`);
    this.name = "ApiRequestError";
    this.source = source;
    this.status = status;
  }
}

export class CombinedSearchError extends Error {
  constructor(failures) {
    const summary = failures
      .map(({ source, error }) => `${source}: ${error.message}`)
      .join("; ");
    super(`All resource providers failed. ${summary}`);
    this.name = "CombinedSearchError";
    this.failures = failures;
  }
}

function normalizeSearchType(type = "general") {
  const normalizedType = String(type).trim().toLowerCase();
  if (!SEARCH_TYPES.has(normalizedType)) {
    throw new TypeError(`Unsupported resource search type: ${type}`);
  }
  return normalizedType === "all" ? "general" : normalizedType;
}

function normalizeQuery(query) {
  if (typeof query !== "string") {
    throw new TypeError("Search query must be a string.");
  }
  return query.trim();
}

function getFetch(fetchImpl) {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (typeof resolvedFetch !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }
  return resolvedFetch;
}

function getRequestCache(fetchImpl) {
  let cache = requestCaches.get(fetchImpl);
  if (!cache) {
    cache = new Map();
    requestCaches.set(fetchImpl, cache);
  }
  return cache;
}

function redactValues(value, values) {
  return values.reduce(
    (message, secret) =>
      secret ? message.split(secret).join("[redacted]") : message,
    value,
  );
}

function sanitizeErrorText(value, sensitiveValues) {
  if (typeof value !== "string") {
    return "";
  }

  return redactValues(value, sensitiveValues)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(
      /\b(?:api[_-]?key|key|access[_-]?token|token|client[_-]?secret|secret)\s*[:=]\s*["']?[^&,\s"'<>]+["']?/gi,
      "[credential redacted]",
    )
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[credential redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[credential redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[credential redacted]")
    .replace(/\bya29\.[A-Za-z0-9._-]+/g, "[credential redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function getGoogleBooksErrorDetails(payload, sensitiveValues) {
  const error = payload?.error;
  if (!error || typeof error !== "object") {
    return { message: "", reason: "" };
  }

  const message = sanitizeErrorText(error.message, sensitiveValues);
  const reasons = Array.isArray(error.errors)
    ? error.errors
        .map((item) => sanitizeErrorText(item?.reason, sensitiveValues))
        .filter(Boolean)
    : [];
  return { message, reason: reasons[0] ?? "" };
}

function formatHttpError(source, status, statusText, payload, sensitiveValues) {
  const httpStatus = Number.isFinite(status) ? status : null;
  if (source !== "Google Books") {
    const detail = sanitizeErrorText(statusText, sensitiveValues);
    return httpStatus === null
      ? detail || "HTTP error."
      : `HTTP ${httpStatus}${detail ? `: ${detail}` : " error."}`;
  }

  const messages = {
    400: "The search request was not accepted. Check the search terms and try again.",
    403: "API access was denied. Check the Google Books API key restrictions and API configuration.",
    429: "A rate or quota limit was reached. Wait before trying again; requests are not retried automatically.",
    503: "Google Books is temporarily unavailable. Try again later.",
  };
  const baseMessage =
    messages[httpStatus] ??
    (httpStatus === null
      ? "The provider returned an unsuccessful response."
      : "The provider returned an unsuccessful response.");
  const { message, reason } = getGoogleBooksErrorDetails(
    payload,
    sensitiveValues,
  );
  const details = [];
  if (message) {
    details.push(`Google message: ${message}`);
  }
  if (reason) {
    details.push(`reason: ${reason}`);
  }
  const statusLabel = httpStatus === null ? "" : `HTTP ${httpStatus}: `;
  return `${statusLabel}${baseMessage}${
    details.length ? ` ${details.join("; ")}` : ""
  }`;
}

async function fetchJson(url, source, fetchImpl, sensitiveValues = []) {
  const cache = getRequestCache(fetchImpl);
  const cacheKey = url.href;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const request = (async () => {
    let response;
    try {
      response = await fetchImpl(url.href);
    } catch (error) {
      throw new ApiRequestError(
        source,
        sanitizeErrorText(
          error instanceof Error ? error.message : "Network error.",
          sensitiveValues,
        ),
      );
    }

    if (!response?.ok) {
      let errorPayload = null;
      if (source === "Google Books" && typeof response?.json === "function") {
        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = null;
        }
      }
      throw new ApiRequestError(
        source,
        formatHttpError(
          source,
          response?.status,
          response?.statusText,
          errorPayload,
          sensitiveValues,
        ),
        Number.isFinite(response?.status) ? response.status : null,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new ApiRequestError(source, "The response was not valid JSON.");
    }
  })();

  cache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
}

function createGoogleBooksUrl(query, type, apiKey) {
  const url = new URL(API_ENDPOINTS.googleBooks);
  const googleQuery =
    type === "title"
      ? `intitle:${query}`
      : type === "author"
        ? `inauthor:${query}`
        : type === "subject"
          ? `subject:${query}`
          : query;
  url.search = new URLSearchParams({
    q: googleQuery,
    maxResults: String(SEARCH_LIMITS.googleBooks),
    key: apiKey,
  }).toString();
  return url;
}

function createOpenLibraryUrl(query, type) {
  const url = new URL(API_ENDPOINTS.openLibrary);
  const parameters = new URLSearchParams({
    [type === "general" ? "q" : type]: query,
    limit: String(SEARCH_LIMITS.openLibrary),
    fields: OPEN_LIBRARY_SEARCH_FIELDS.join(","),
  });
  url.search = parameters.toString();
  return url;
}

export async function searchGoogleBooks(
  query,
  { type = "general", fetchImpl, apiKey = GOOGLE_BOOKS_API_KEY } = {},
) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedType = normalizeSearchType(type);
  if (!normalizedQuery) {
    return [];
  }
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error(
      "Google Books API key is not configured. Set VITE_GOOGLE_BOOKS_API_KEY in .env.local and restart Vite.",
    );
  }

  const resolvedFetch = getFetch(fetchImpl);
  const url = createGoogleBooksUrl(
    normalizedQuery,
    normalizedType,
    apiKey.trim(),
  );
  const payload = await fetchJson(url, "Google Books", resolvedFetch, [
    apiKey.trim(),
  ]);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map(normalizeGoogleBook).filter(Boolean);
}

export async function searchOpenLibrary(
  query,
  { type = "general", fetchImpl } = {},
) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedType = normalizeSearchType(type);
  if (!normalizedQuery) {
    return [];
  }

  const resolvedFetch = getFetch(fetchImpl);
  const url = createOpenLibraryUrl(normalizedQuery, normalizedType);
  const payload = await fetchJson(url, "Open Library", resolvedFetch);
  const documents = Array.isArray(payload?.docs) ? payload.docs : [];
  return documents.map(normalizeOpenLibraryDocument).filter(Boolean);
}

export async function searchResources(
  query,
  { type = "general", fetchImpl, apiKey = GOOGLE_BOOKS_API_KEY } = {},
) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedType = normalizeSearchType(type);
  if (!normalizedQuery) {
    return { resources: [], warnings: [] };
  }

  const resolvedFetch = getFetch(fetchImpl);
  const results = await Promise.allSettled([
    searchGoogleBooks(normalizedQuery, {
      type: normalizedType,
      fetchImpl: resolvedFetch,
      apiKey,
    }),
    searchOpenLibrary(normalizedQuery, {
      type: normalizedType,
      fetchImpl: resolvedFetch,
    }),
  ]);
  const providers = ["Google Books", "Open Library"];
  const resources = [];
  const warnings = [];
  const failures = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      resources.push(...result.value);
    } else {
      const failure = { source: providers[index], error: result.reason };
      failures.push(failure);
      warnings.push({
        source: failure.source,
        message: failure.error.message,
      });
    }
  });

  if (failures.length === results.length) {
    throw new CombinedSearchError(failures);
  }

  return { resources, warnings };
}

export function clearApiCache() {
  requestCaches = new WeakMap();
}

export { API_ENDPOINTS };
