import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFiltersAndSort,
  getResourceCategories,
  initializeFilters,
} from "../js/filtersSort.js";

const resources = [
  {
    id: "google-books:one",
    title: "Zebra JavaScript",
    publishedDate: "2020-01-01",
    categories: ["Programming", "Web"],
    previewUrl: "https://books.google.com/preview",
    fullTextAvailable: true,
  },
  {
    id: "open-library:two",
    title: "alpha guide",
    publishedDate: "1999",
    categories: ["Programming"],
    previewUrl: null,
    fullTextAvailable: false,
  },
  {
    id: "google-books:three",
    title: "JavaScript Essentials",
    publishedDate: "not-a-date",
    categories: ["Web"],
    previewUrl: "https://books.google.com/preview/three",
    fullTextAvailable: null,
  },
  {
    id: "open-library:four",
    title: null,
    publishedDate: null,
    categories: [],
    previewUrl: null,
    fullTextAvailable: true,
  },
  {
    id: "google-books:five",
    title: "Another JavaScript",
    publishedDate: "2020",
    categories: ["Programming"],
    previewUrl: null,
    fullTextAvailable: true,
  },
];

class ControlStub {
  listeners = new Map();
  options = [];
  value = "";

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(option) {
    this.options.push(option);
  }

  replaceChildren() {
    this.options = [];
  }
}

test("category choices are distinct, trimmed, and sorted", () => {
  assert.deepEqual(
    getResourceCategories([
      { categories: [" Web ", "Programming"] },
      { categories: ["Web", null, ""] },
      { categories: null },
    ]),
    ["Programming", "Web"],
  );
});

test("category, publication year, and availability filters combine", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, {
      category: "Programming",
      yearFrom: "2000",
      yearTo: "2021",
      availability: "full-text",
      sort: "relevance",
    }).map(({ id }) => id),
    ["google-books:one", "google-books:five"],
  );
});

test("unknown dates and availability do not match constrained filters", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, { yearFrom: "2000" }).map(({ id }) => id),
    ["google-books:one", "google-books:five"],
  );
  assert.deepEqual(
    applyFiltersAndSort(resources, { availability: "preview" }).map(
      ({ id }) => id,
    ),
    ["google-books:one", "google-books:three"],
  );
  assert.deepEqual(
    applyFiltersAndSort(resources, { availability: "full-text" }).map(
      ({ id }) => id,
    ),
    ["google-books:one", "open-library:four", "google-books:five"],
  );
});

test("filters can produce an empty collection for the no-matches state", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, {
      category: "Astronomy",
      availability: "full-text",
    }),
    [],
  );
});

test("relevance preserves original result order", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources).map(({ id }) => id),
    resources.map(({ id }) => id),
  );
});

test("title sorting is case-insensitive, stable, and places absent titles last", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, { sort: "title" }).map(({ id }) => id),
    [
      "open-library:two",
      "google-books:five",
      "google-books:three",
      "google-books:one",
      "open-library:four",
    ],
  );
});

test("newest and oldest sorting keep undated resources at the end stably", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, { sort: "newest" }).map(({ id }) => id),
    [
      "google-books:one",
      "google-books:five",
      "open-library:two",
      "google-books:three",
      "open-library:four",
    ],
  );
  assert.deepEqual(
    applyFiltersAndSort(resources, { sort: "oldest" }).map(({ id }) => id),
    [
      "open-library:two",
      "google-books:one",
      "google-books:five",
      "google-books:three",
      "open-library:four",
    ],
  );
});

test("invalid date bounds and sort values fall back safely", () => {
  assert.deepEqual(
    applyFiltersAndSort(resources, {
      yearFrom: "invalid",
      yearTo: "also-invalid",
      sort: "unexpected",
    }),
    resources,
  );
});

test("filter controls build category choices and reset all active criteria", () => {
  const selectors = [
    "#category-filter",
    "#year-from",
    "#year-to",
    "#availability-filter",
    "#sort-order",
    "#reset-filters",
  ];
  const controls = new Map(
    selectors.map((selector) => [selector, new ControlStub()]),
  );
  controls.get("#availability-filter").value = "all";
  controls.get("#sort-order").value = "relevance";
  const root = {
    querySelector: (selector) => controls.get(selector),
    createElement: () => ({ value: "", textContent: "" }),
  };
  const changes = [];
  const filters = initializeFilters({
    root,
    onChange: (value) => changes.push(value),
  });

  filters.setResources(resources);
  assert.deepEqual(
    controls.get("#category-filter").options.map(({ value }) => value),
    ["", "Programming", "Web"],
  );

  controls.get("#category-filter").value = "Programming";
  controls.get("#year-from").value = "2000";
  controls.get("#year-to").value = "2022";
  controls.get("#availability-filter").value = "full-text";
  controls.get("#sort-order").value = "newest";
  controls.get("#reset-filters").listeners.get("click")();

  assert.deepEqual(filters.readFilters(), {
    category: "",
    yearFrom: "",
    yearTo: "",
    availability: "all",
    sort: "relevance",
  });
  assert.equal(changes.length, 2);
});
