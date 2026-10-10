export const API_ENDPOINTS = Object.freeze({
  googleBooks: "https://www.googleapis.com/books/v1/volumes",
  openLibrary: "https://openlibrary.org/search.json",
  openLibraryWeb: "https://openlibrary.org",
  openLibraryCovers: "https://covers.openlibrary.org",
});

export const GOOGLE_BOOKS_API_KEY =
  import.meta.env?.VITE_GOOGLE_BOOKS_API_KEY?.trim() ?? "";

export const SEARCH_LIMITS = Object.freeze({
  googleBooks: 20,
  openLibrary: 20,
});

export const OPEN_LIBRARY_SEARCH_FIELDS = Object.freeze([
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "subject",
  "cover_i",
  "edition_count",
  "isbn",
  "publisher",
  "has_fulltext",
  "public_scan_b",
]);

export const APP_CONFIG = Object.freeze({
  defaultSearchType: "all",
  resultsPerPage: 20,
});
