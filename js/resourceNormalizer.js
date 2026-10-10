import { API_ENDPOINTS } from "./config.js";

const OPEN_LIBRARY_KEY_PATTERN = /^\/works\/OL\d+W$/;
const OPEN_LIBRARY_COVER_BASE = new URL(API_ENDPOINTS.openLibraryCovers);
const OPEN_LIBRARY_WEB_BASE = new URL(API_ENDPOINTS.openLibraryWeb);
const OPEN_LIBRARY_COVER_HOSTS = new Set([OPEN_LIBRARY_COVER_BASE.hostname]);
const OPEN_LIBRARY_WEB_HOSTS = new Set([OPEN_LIBRARY_WEB_BASE.hostname]);

function optionalText(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function textArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(optionalText).filter(Boolean);
}

function safeHttpsUrl(value, allowedHosts, upgradeKnownHttp = false) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    if (upgradeKnownHttp && url.protocol === "http:") {
      url.protocol = "https:";
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function safeGoogleUrl(value) {
  return safeHttpsUrl(value, GOOGLE_URL_HOSTS, true);
}

const GOOGLE_URL_HOSTS = new Set([
  "books.google.com",
  "play.google.com",
  "www.google.com",
]);

function googleIsbn(volumeInfo) {
  const identifiers = Array.isArray(volumeInfo.industryIdentifiers)
    ? volumeInfo.industryIdentifiers
    : [];
  return identifiers
    .map((identifier) => optionalText(identifier?.identifier))
    .filter(Boolean);
}

function googleThumbnail(volumeInfo) {
  const imageLinks = volumeInfo.imageLinks;
  if (!imageLinks || typeof imageLinks !== "object") {
    return null;
  }
  return safeGoogleUrl(imageLinks.thumbnail ?? imageLinks.smallThumbnail);
}

function googleFullText(accessInfo) {
  if (!accessInfo || typeof accessInfo !== "object") {
    return null;
  }
  if (
    typeof accessInfo.webReaderLink === "string" &&
    accessInfo.webReaderLink
  ) {
    return true;
  }
  const pdfAvailable = accessInfo.pdf?.isAvailable;
  const epubAvailable = accessInfo.epub?.isAvailable;
  if (pdfAvailable === true || epubAvailable === true) {
    return true;
  }
  if (pdfAvailable === false && epubAvailable === false) {
    return false;
  }
  return null;
}

function optionalNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function normalizeGoogleBook(volume) {
  if (!volume || typeof volume !== "object" || Array.isArray(volume)) {
    return null;
  }

  const sourceId = optionalText(volume.id);
  if (!sourceId) {
    return null;
  }
  const info = volume.volumeInfo;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    return null;
  }

  return {
    id: `google-books:${sourceId}`,
    source: "Google Books",
    sourceId,
    title: optionalText(info.title),
    authors: textArray(info.authors),
    description: optionalText(info.description),
    publisher: optionalText(info.publisher),
    publishedDate: optionalText(info.publishedDate),
    pageCount: optionalNonNegativeInteger(info.pageCount),
    categories: textArray(info.categories),
    isbn: googleIsbn(info),
    thumbnail: googleThumbnail(info),
    previewUrl: safeGoogleUrl(info.previewLink),
    infoUrl: safeGoogleUrl(info.infoLink),
    fullTextAvailable: googleFullText(volume.accessInfo),
  };
}

function openLibraryCover(coverId) {
  if (!Number.isSafeInteger(coverId) || coverId <= 0) {
    return null;
  }
  const url = new URL(`/b/id/${coverId}-M.jpg`, OPEN_LIBRARY_COVER_BASE);
  return safeHttpsUrl(url.href, OPEN_LIBRARY_COVER_HOSTS);
}

function openLibraryInfoUrl(key) {
  if (typeof key !== "string" || !OPEN_LIBRARY_KEY_PATTERN.test(key)) {
    return null;
  }
  const url = new URL(key, OPEN_LIBRARY_WEB_BASE);
  return safeHttpsUrl(url.href, OPEN_LIBRARY_WEB_HOSTS);
}

function firstText(value) {
  if (Array.isArray(value)) {
    return value.map(optionalText).find(Boolean) ?? null;
  }
  return optionalText(value);
}

function openLibraryFullText(document) {
  if (typeof document.has_fulltext === "boolean") {
    return document.has_fulltext;
  }
  if (typeof document.public_scan_b === "boolean") {
    return document.public_scan_b;
  }
  return null;
}

export function normalizeOpenLibraryDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }

  const sourceId = optionalText(document.key);
  if (!sourceId) {
    return null;
  }

  const year = optionalNonNegativeInteger(document.first_publish_year);
  return {
    id: `open-library:${sourceId}`,
    source: "Open Library",
    sourceId,
    title: optionalText(document.title),
    authors: textArray(document.author_name),
    description: null,
    publisher: firstText(document.publisher),
    publishedDate: year === null ? null : String(year),
    pageCount: null,
    categories: textArray(document.subject),
    isbn: textArray(document.isbn),
    thumbnail: openLibraryCover(document.cover_i),
    previewUrl: null,
    infoUrl: openLibraryInfoUrl(sourceId),
    fullTextAvailable: openLibraryFullText(document),
  };
}
