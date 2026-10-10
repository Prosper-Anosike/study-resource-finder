import { searchResources } from "./apiClient.js";
import * as favoritesApi from "./favorites.js";
import { applyFiltersAndSort, initializeFilters } from "./filtersSort.js";
import { renderResources } from "./renderResources.js";
import { initializeResourceDetails } from "./resourceDetails.js";
import { setMessageVisibility } from "./uiHelpers.js";

export function createSearchRequest(query, type) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (!normalizedQuery) {
    return null;
  }
  return { query: normalizedQuery, type };
}

export function initializeSearchPage({
  search = searchResources,
  render = renderResources,
  filters: suppliedFilters,
  favorites: favoriteStore = favoritesApi,
  detailsController,
  root = document,
} = {}) {
  const form = root.querySelector("#search-form");
  const queryInput = root.querySelector("#search-query");
  const searchType = root.querySelector("#search-type");
  const resultsSection = root.querySelector("#results-section");
  const resultsList = root.querySelector("#results-list");
  const resultCount = root.querySelector("#result-count");
  const loadingMessage = root.querySelector("#loading-message");
  const warningMessage = root.querySelector("#warning-message");
  const errorMessage = root.querySelector("#error-message");
  const emptyMessage = root.querySelector("#empty-message");
  const emptyHeading = root.querySelector("#empty-heading");
  const emptyCopy = root.querySelector("#empty-copy");
  const favoritesFeedback = root.querySelector("#favorites-feedback");
  const details = detailsController ?? initializeResourceDetails({ root });

  if (
    !form ||
    !queryInput ||
    !searchType ||
    !resultsSection ||
    !resultsList ||
    !resultCount ||
    !loadingMessage ||
    !warningMessage ||
    !errorMessage ||
    !emptyMessage ||
    !emptyHeading ||
    !emptyCopy ||
    !favoritesFeedback
  ) {
    throw new Error("The search page is missing required interface elements.");
  }

  let currentSearchId = 0;
  let currentResources = [];
  let visibleResources = [];
  let currentWarnings = [];
  let hasSearched = false;
  const filterController =
    suppliedFilters ??
    initializeFilters({
      root,
      onChange: (filters) => updateVisibleResults(filters),
    });

  function updateVisibleResults(filters = filterController.readFilters()) {
    if (!hasSearched) {
      return;
    }
    visibleResources = applyFiltersAndSort(currentResources, filters);
    renderCurrentResources();

    const count = visibleResources.length;
    const total = currentResources.length;
    resultCount.textContent =
      count === total
        ? `${total} ${total === 1 ? "resource" : "resources"} found`
        : `${count} of ${total} resources shown`;
    setMessageVisibility(emptyMessage, count === 0);
    if (count === 0) {
      emptyHeading.textContent =
        total === 0
          ? "No resources found."
          : "No resources match your filters.";
      emptyCopy.textContent =
        total === 0
          ? "Try a different title, author, or subject to broaden your search."
          : "Adjust or reset your filters to see more resources.";
    }

    warningMessage.textContent = currentWarnings
      .map((warning) => warning.message)
      .filter((message) => typeof message === "string" && message)
      .join(" ");
    setMessageVisibility(warningMessage, Boolean(warningMessage.textContent));
  }

  function renderCurrentResources() {
    const state = favoriteStore.getFavoritesState();
    render(resultsList, visibleResources, {
      favoriteIds: new Set(state.favorites.map((favorite) => favorite.id)),
    });
    if (state.error) {
      favoritesFeedback.textContent =
        "Favorites are unavailable. Check this browser's storage settings.";
      setMessageVisibility(favoritesFeedback, true);
    }
  }

  resultsList.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest?.("[data-favorite-id]");
    if (favoriteButton) {
      const id = favoriteButton.getAttribute("data-favorite-id");
      const resource = visibleResources.find((item) => item.id === id);
      if (!resource) {
        return;
      }
      const success = favoriteStore.isFavorite(id)
        ? favoriteStore.removeFavorite(id)
        : favoriteStore.addFavorite(resource);
      if (!success) {
        favoritesFeedback.textContent =
          "Favorites could not be updated. Check this browser's storage settings.";
        setMessageVisibility(favoritesFeedback, true);
        return;
      }
      favoritesFeedback.textContent = favoriteStore.isFavorite(id)
        ? `${resource.title || "Resource"} added to favorites.`
        : `${resource.title || "Resource"} removed from favorites.`;
      setMessageVisibility(favoritesFeedback, true);
      renderCurrentResources();
      return;
    }

    const detailsButton = event.target.closest?.(".resource-details-button");
    if (detailsButton) {
      const resource = visibleResources.find(
        (item) => item.id === detailsButton.getAttribute("data-resource-id"),
      );
      if (resource) {
        details.open(resource, detailsButton);
      }
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener(
      favoritesApi.FAVORITES_CHANGE_EVENT,
      renderCurrentResources,
    );
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === "study-resource-finder:favorites:v1") {
        renderCurrentResources();
      }
    });
  }

  queryInput.addEventListener("input", () => {
    if (queryInput.value.trim()) {
      queryInput.removeAttribute("aria-invalid");
      errorMessage.textContent = "";
      setMessageVisibility(errorMessage, false);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const searchId = ++currentSearchId;
    const request = createSearchRequest(queryInput.value, searchType.value);

    setMessageVisibility(loadingMessage, false);
    setMessageVisibility(warningMessage, false);
    setMessageVisibility(errorMessage, false);
    errorMessage.textContent = "";
    warningMessage.textContent = "";

    if (!request) {
      queryInput.setAttribute("aria-invalid", "true");
      errorMessage.textContent = "Enter a title, author, or subject to search.";
      setMessageVisibility(errorMessage, true);
      queryInput.focus();
      resultsSection.setAttribute("aria-busy", "false");
      return;
    }

    queryInput.removeAttribute("aria-invalid");
    setMessageVisibility(emptyMessage, false);
    resultsSection.setAttribute("aria-busy", "true");
    resultCount.textContent = "Searching resources…";
    setMessageVisibility(loadingMessage, true);

    try {
      const result = await search(request.query, { type: request.type });
      if (searchId !== currentSearchId) {
        return;
      }

      const resources = Array.isArray(result?.resources)
        ? result.resources
        : [];
      currentResources = resources;
      currentWarnings = Array.isArray(result?.warnings) ? result.warnings : [];
      hasSearched = true;
      filterController.setResources(currentResources);
      setMessageVisibility(loadingMessage, false);
      resultsSection.setAttribute("aria-busy", "false");
    } catch (error) {
      if (searchId !== currentSearchId) {
        return;
      }

      currentResources = [];
      visibleResources = [];
      currentWarnings = [];
      hasSearched = true;
      filterController.setResources([]);
      render(resultsList, []);
      resultCount.textContent = "Search could not be completed.";
      errorMessage.textContent =
        error instanceof Error
          ? `We couldn't search resources. ${error.message}`
          : "We couldn't search resources. Please try again.";
      setMessageVisibility(loadingMessage, false);
      setMessageVisibility(emptyMessage, false);
      setMessageVisibility(errorMessage, true);
      resultsSection.setAttribute("aria-busy", "false");
    }
  });
}
