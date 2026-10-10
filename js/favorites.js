import { initializeResourceDetails } from "./resourceDetails.js";
import { renderResources } from "./renderResources.js";
import { setMessageVisibility } from "./uiHelpers.js";

export const FAVORITES_STORAGE_KEY = "study-resource-finder:favorites:v1";
export const FAVORITES_CHANGE_EVENT = "study-resource-favorites-change";

const LINK_HOSTS = new Set([
  "books.google.com",
  "play.google.com",
  "www.google.com",
  "openlibrary.org",
]);
const IMAGE_HOSTS = new Set([...LINK_HOSTS, "covers.openlibrary.org"]);

function safeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeTextList(value) {
  return Array.isArray(value) ? value.map(safeText).filter(Boolean) : [];
}

function safeUrl(value, hosts) {
  const text = safeText(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hosts.has(url.hostname.toLowerCase())
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function normalizeFavorite(resource) {
  if (
    !resource ||
    typeof resource !== "object" ||
    typeof resource.id !== "string" ||
    !resource.id.includes(":") ||
    !["Google Books", "Open Library"].includes(resource.source)
  ) {
    return null;
  }

  return {
    id: resource.id,
    source: resource.source,
    sourceId: safeText(resource.sourceId),
    title: safeText(resource.title),
    authors: safeTextList(resource.authors),
    thumbnail: safeUrl(resource.thumbnail, IMAGE_HOSTS),
    publishedDate: safeText(resource.publishedDate),
    description: safeText(resource.description),
    publisher: safeText(resource.publisher),
    pageCount:
      Number.isInteger(resource.pageCount) && resource.pageCount > 0
        ? resource.pageCount
        : null,
    categories: safeTextList(resource.categories),
    isbn: safeTextList(resource.isbn),
    previewUrl: safeUrl(resource.previewUrl, LINK_HOSTS),
    infoUrl: safeUrl(resource.infoUrl, LINK_HOSTS),
    fullTextAvailable:
      typeof resource.fullTextAvailable === "boolean"
        ? resource.fullTextAvailable
        : null,
  };
}

function resolveStorage(storage) {
  return storage ?? globalThis.localStorage;
}

function parseStoredFavorites(storage) {
  const serialized = resolveStorage(storage).getItem(FAVORITES_STORAGE_KEY);
  if (serialized === null) {
    return { favorites: [], error: null };
  }
  const parsed = JSON.parse(serialized);
  if (!Array.isArray(parsed)) {
    return {
      favorites: [],
      error: new TypeError("Favorites data must be a list."),
    };
  }

  const favorites = [];
  const seen = new Set();
  for (const value of parsed) {
    const favorite = normalizeFavorite(value);
    if (favorite && !seen.has(favorite.id)) {
      favorites.push(favorite);
      seen.add(favorite.id);
    }
  }
  return { favorites, error: null };
}

export function getFavoritesState(storage) {
  try {
    return parseStoredFavorites(storage);
  } catch (error) {
    return {
      favorites: [],
      error:
        error instanceof Error
          ? error
          : new Error("Favorites storage is unavailable."),
    };
  }
}

export function getFavorites(storage) {
  return getFavoritesState(storage).favorites;
}

function persistFavorites(favorites, storage) {
  try {
    resolveStorage(storage).setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(favorites),
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}

export function addFavorite(resource, storage) {
  const favorite = normalizeFavorite(resource);
  if (!favorite) {
    return false;
  }
  const state = getFavoritesState(storage);
  if (state.error) {
    return persistFavorites([favorite], storage);
  }
  if (state.favorites.some((item) => item.id === favorite.id)) {
    return true;
  }
  return persistFavorites([...state.favorites, favorite], storage);
}

export function removeFavorite(id, storage) {
  if (typeof id !== "string" || !id) {
    return false;
  }
  const state = getFavoritesState(storage);
  if (state.error) {
    return false;
  }
  const updated = state.favorites.filter((favorite) => favorite.id !== id);
  if (updated.length === state.favorites.length) {
    return true;
  }
  return persistFavorites(updated, storage);
}

export function isFavorite(id, storage) {
  return getFavorites(storage).some((favorite) => favorite.id === id);
}

function announceStorageError(element, storage) {
  const state = getFavoritesState(storage);
  if (state.error) {
    element.textContent =
      "Favorites could not be loaded from this browser. Check your storage settings.";
    setMessageVisibility(element, true);
    return true;
  }
  return false;
}

export function initializeFavoritesPage({
  root = document,
  storage,
  render = renderResources,
  detailsController,
} = {}) {
  const list = root.querySelector("#favorites-list");
  const empty = root.querySelector("#favorites-empty");
  const count = root.querySelector("#favorites-count");
  const feedback = root.querySelector("#favorites-feedback");
  const details = detailsController ?? initializeResourceDetails({ root });
  if (!list || !empty || !count || !feedback) {
    throw new Error("The favorites page is missing required elements.");
  }

  function renderFavorites() {
    if (announceStorageError(feedback, storage)) {
      render(list, [], { favoriteMode: "remove" });
      setMessageVisibility(empty, false);
      count.textContent = "Favorites unavailable.";
      return;
    }

    const favorites = getFavorites(storage);
    render(list, favorites, {
      favoriteMode: "remove",
      favoriteIds: new Set(favorites.map((favorite) => favorite.id)),
    });
    count.textContent = `${favorites.length} ${
      favorites.length === 1 ? "favorite" : "favorites"
    }`;
    setMessageVisibility(empty, favorites.length === 0);
    feedback.textContent = "";
    setMessageVisibility(feedback, false);
  }

  list.addEventListener("click", (event) => {
    const detailsButton = event.target.closest?.(".resource-details-button");
    if (detailsButton) {
      const resource = getFavorites(storage).find(
        (item) => item.id === detailsButton.getAttribute("data-resource-id"),
      );
      if (resource) {
        details.open(resource, detailsButton);
      }
      return;
    }

    const removeButton = event.target.closest?.("[data-remove-favorite-id]");
    if (!removeButton) {
      return;
    }
    const id = removeButton.getAttribute("data-remove-favorite-id");
    if (removeFavorite(id, storage)) {
      feedback.textContent = "Removed from favorites.";
      setMessageVisibility(feedback, true);
      renderFavorites();
      feedback.textContent = "Removed from favorites.";
      setMessageVisibility(feedback, true);
    } else {
      feedback.textContent =
        "This favorite could not be removed. Check your browser storage settings.";
      setMessageVisibility(feedback, true);
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener(FAVORITES_CHANGE_EVENT, renderFavorites);
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === FAVORITES_STORAGE_KEY) {
        renderFavorites();
      }
    });
  }

  renderFavorites();
  return { renderFavorites };
}

if (
  typeof document !== "undefined" &&
  document.querySelector("#favorites-list")
) {
  initializeFavoritesPage();
}
