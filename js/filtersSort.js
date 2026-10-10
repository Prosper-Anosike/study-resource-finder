const SORT_OPTIONS = new Set(["relevance", "title", "newest", "oldest"]);
const AVAILABILITY_OPTIONS = new Set(["all", "preview", "full-text"]);

function publishedYear(resource) {
  if (typeof resource.publishedDate !== "string") {
    return null;
  }
  const match = resource.publishedDate.trim().match(/^(\d{4})(?:\D|$)/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return year >= 1000 && year <= 9999 ? year : null;
}

function validYear(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const year = Number(value);
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

function compareText(left, right) {
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function getResourceCategories(resources) {
  const categories = new Set();
  for (const resource of resources) {
    if (!Array.isArray(resource.categories)) {
      continue;
    }
    for (const category of resource.categories) {
      if (typeof category === "string" && category.trim()) {
        categories.add(category.trim());
      }
    }
  }
  return [...categories].sort(compareText);
}

export function applyFiltersAndSort(resources, filters = {}) {
  const category =
    typeof filters.category === "string" ? filters.category.trim() : "";
  const yearFrom = validYear(filters.yearFrom);
  const yearTo = validYear(filters.yearTo);
  const availability = AVAILABILITY_OPTIONS.has(filters.availability)
    ? filters.availability
    : "all";
  const sort = SORT_OPTIONS.has(filters.sort) ? filters.sort : "relevance";

  const matching = resources
    .map((resource, index) => ({ resource, index }))
    .filter(({ resource }) => {
      if (category && !Array.isArray(resource.categories)) {
        return false;
      }
      if (
        category &&
        !resource.categories.some(
          (item) =>
            typeof item === "string" &&
            item.toLocaleLowerCase() === category.toLocaleLowerCase(),
        )
      ) {
        return false;
      }

      const year = publishedYear(resource);
      if (yearFrom !== null && (year === null || year < yearFrom)) {
        return false;
      }
      if (yearTo !== null && (year === null || year > yearTo)) {
        return false;
      }

      if (availability === "preview" && !resource.previewUrl) {
        return false;
      }
      if (availability === "full-text" && resource.fullTextAvailable !== true) {
        return false;
      }
      return true;
    });

  if (sort !== "relevance") {
    matching.sort((left, right) => {
      if (sort === "title") {
        const leftTitle =
          typeof left.resource.title === "string"
            ? left.resource.title.trim()
            : "";
        const rightTitle =
          typeof right.resource.title === "string"
            ? right.resource.title.trim()
            : "";
        if (!leftTitle || !rightTitle) {
          return leftTitle ? -1 : rightTitle ? 1 : left.index - right.index;
        }
        return compareText(leftTitle, rightTitle) || left.index - right.index;
      }

      const leftYear = publishedYear(left.resource);
      const rightYear = publishedYear(right.resource);
      if (leftYear === null || rightYear === null) {
        return leftYear === rightYear
          ? left.index - right.index
          : leftYear === null
            ? 1
            : -1;
      }
      const yearOrder =
        sort === "newest" ? rightYear - leftYear : leftYear - rightYear;
      return yearOrder || left.index - right.index;
    });
  }

  return matching.map(({ resource }) => resource);
}

export function initializeFilters({
  root = document,
  onChange = () => {},
} = {}) {
  const category = root.querySelector("#category-filter");
  const yearFrom = root.querySelector("#year-from");
  const yearTo = root.querySelector("#year-to");
  const availability = root.querySelector("#availability-filter");
  const sort = root.querySelector("#sort-order");
  const reset = root.querySelector("#reset-filters");
  if (!category || !yearFrom || !yearTo || !availability || !sort || !reset) {
    throw new Error("The search page is missing filter controls.");
  }

  const readFilters = () => ({
    category: category.value,
    yearFrom: yearFrom.value,
    yearTo: yearTo.value,
    availability: availability.value,
    sort: sort.value,
  });

  const notifyChange = () => onChange(readFilters());
  for (const control of [yearFrom, yearTo]) {
    control.addEventListener("input", notifyChange);
  }
  for (const control of [category, availability, sort]) {
    control.addEventListener("change", notifyChange);
  }

  reset.addEventListener("click", () => {
    category.value = "";
    yearFrom.value = "";
    yearTo.value = "";
    availability.value = "all";
    sort.value = "relevance";
    notifyChange();
  });

  function setResources(resources) {
    const placeholder = category.options?.[0];
    category.replaceChildren();
    if (placeholder) {
      category.append(placeholder);
      placeholder.value = "";
      placeholder.textContent = "All subjects";
    } else {
      const allOption = root.createElement("option");
      allOption.value = "";
      allOption.textContent = "All subjects";
      category.append(allOption);
    }

    for (const item of getResourceCategories(resources)) {
      const option = root.createElement("option");
      option.value = item;
      option.textContent = item;
      category.append(option);
    }
    category.value = "";
    yearFrom.value = "";
    yearTo.value = "";
    availability.value = "all";
    sort.value = "relevance";
    notifyChange();
  }

  return { readFilters, setResources };
}
