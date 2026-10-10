import assert from "node:assert/strict";
import test from "node:test";
import {
  addFavorite,
  FAVORITES_STORAGE_KEY,
  getFavorites,
  getFavoritesState,
  initializeFavoritesPage,
  isFavorite,
  removeFavorite,
} from "../js/favorites.js";

function createStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) {
    values.set(FAVORITES_STORAGE_KEY, initialValue);
  }
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    get value() {
      return values.get(FAVORITES_STORAGE_KEY) ?? null;
    },
  };
}

const firstResource = {
  id: "google-books:one",
  source: "Google Books",
  sourceId: "one",
  title: "JavaScript",
  authors: ["A. Author"],
  thumbnail: "https://books.google.com/cover.jpg",
  publishedDate: "2024",
  description: "A guide.",
  publisher: "Example Press",
  pageCount: 220,
  categories: ["Programming"],
  isbn: ["9780000000000"],
  previewUrl: "https://books.google.com/books?id=one",
  infoUrl: "https://books.google.com/books?id=one&source=gbs_api",
  fullTextAvailable: true,
  ignoredProperty: "unnecessary",
};

const secondResource = {
  ...firstResource,
  id: "open-library:/works/OL123W",
  source: "Open Library",
  sourceId: "/works/OL123W",
  title: "Web Development",
  thumbnail: "https://covers.openlibrary.org/b/id/123-M.jpg",
  previewUrl: null,
  infoUrl: "https://openlibrary.org/works/OL123W",
};

class ElementStub {
  listeners = new Map();
  children = [];
  attributes = new Map();
  hidden = false;
  textContent = "";
  value = "";

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(...children) {
    this.children.push(...children);
  }
}

function createFavoritesPage() {
  const ids = [
    "#favorites-list",
    "#favorites-empty",
    "#favorites-count",
    "#favorites-feedback",
  ];
  const elements = new Map(ids.map((id) => [id, new ElementStub()]));
  return {
    elements,
    root: { querySelector: (id) => elements.get(id) ?? null },
  };
}

test("adding and retrieving favorites persists normalized useful properties", () => {
  const storage = createStorage();

  assert.equal(addFavorite(firstResource, storage), true);
  const [saved] = getFavorites(storage);
  assert.equal(saved.id, firstResource.id);
  assert.equal(saved.source, firstResource.source);
  assert.equal(saved.title, firstResource.title);
  assert.deepEqual(saved.authors, firstResource.authors);
  assert.equal(saved.thumbnail, firstResource.thumbnail);
  assert.equal(saved.publishedDate, firstResource.publishedDate);
  assert.equal(saved.description, firstResource.description);
  assert.deepEqual(saved.categories, firstResource.categories);
  assert.equal(saved.infoUrl, firstResource.infoUrl);
  assert.equal("ignoredProperty" in saved, false);
  assert.equal(storage.value.includes("unnecessary"), false);
  assert.equal(isFavorite(firstResource.id, storage), true);
});

test("multiple source-prefixed favorites persist independently without duplicates", () => {
  const storage = createStorage();

  assert.equal(addFavorite(firstResource, storage), true);
  assert.equal(addFavorite(secondResource, storage), true);
  assert.equal(addFavorite(firstResource, storage), true);
  assert.equal(getFavorites(storage).length, 2);
  assert.notEqual(getFavorites(storage)[0].id, getFavorites(storage)[1].id);
});

test("removing one favorite leaves other saved resources intact", () => {
  const storage = createStorage();
  addFavorite(firstResource, storage);
  addFavorite(secondResource, storage);

  assert.equal(removeFavorite(firstResource.id, storage), true);
  assert.deepEqual(
    getFavorites(storage).map((resource) => resource.id),
    [secondResource.id],
  );
  assert.equal(isFavorite(firstResource.id, storage), false);
});

test("unsafe links and invalid resource records are not stored", () => {
  const storage = createStorage();
  const unsafe = {
    ...firstResource,
    thumbnail: "javascript:alert(1)",
    previewUrl: "https://evil.example/preview",
    infoUrl: "http://books.google.com/book",
  };

  assert.equal(addFavorite(unsafe, storage), true);
  const [saved] = getFavorites(storage);
  assert.equal(saved.thumbnail, null);
  assert.equal(saved.previewUrl, null);
  assert.equal(saved.infoUrl, null);
  assert.equal(addFavorite({ title: "No normalized ID" }, storage), false);
});

test("empty, malformed JSON, and malformed list data are handled without throwing", () => {
  assert.deepEqual(getFavorites(createStorage()), []);
  const invalidJson = createStorage("{invalid");
  const invalidState = getFavoritesState(invalidJson);
  assert.deepEqual(invalidState.favorites, []);
  assert.ok(invalidState.error instanceof Error);
  assert.equal(addFavorite(firstResource, invalidJson), true);
  assert.deepEqual(
    getFavorites(invalidJson).map(({ id }) => id),
    [firstResource.id],
  );

  const invalidShape = createStorage(JSON.stringify({ id: firstResource.id }));
  assert.deepEqual(getFavorites(invalidShape), []);
  assert.ok(getFavoritesState(invalidShape).error instanceof Error);
});

test("storage access and write failures are reported safely", () => {
  const brokenRead = {
    getItem() {
      throw new Error("blocked");
    },
  };
  const readState = getFavoritesState(brokenRead);
  assert.deepEqual(readState.favorites, []);
  assert.ok(readState.error instanceof Error);
  assert.equal(addFavorite(firstResource, brokenRead), false);

  const brokenWrite = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.equal(addFavorite(firstResource, brokenWrite), false);
});

test("favorites page initialization reads storage and removal updates its display", () => {
  const storage = createStorage();
  addFavorite(firstResource, storage);
  addFavorite(secondResource, storage);
  const { elements, root } = createFavoritesPage();
  const rendered = [];
  initializeFavoritesPage({
    root,
    storage,
    render: (_container, resources, options) => {
      rendered.push({ resources: [...resources], options });
    },
    detailsController: { open() {} },
  });

  assert.equal(rendered.at(-1).resources.length, 2);
  assert.equal(elements.get("#favorites-empty").hidden, true);
  assert.equal(elements.get("#favorites-count").textContent, "2 favorites");

  const list = elements.get("#favorites-list");
  const removeButton = {
    getAttribute: () => firstResource.id,
  };
  list.listeners.get("click")({
    target: {
      closest(selector) {
        return selector === "[data-remove-favorite-id]" ? removeButton : null;
      },
    },
  });

  assert.deepEqual(
    getFavorites(storage).map((resource) => resource.id),
    [secondResource.id],
  );
  assert.equal(rendered.at(-1).resources.length, 1);
  assert.equal(elements.get("#favorites-count").textContent, "1 favorite");
  assert.equal(
    elements.get("#favorites-feedback").textContent,
    "Removed from favorites.",
  );
});

test("favorites page displays the empty state after initialization and last removal", () => {
  const storage = createStorage();
  const { elements, root } = createFavoritesPage();
  const rendered = [];
  initializeFavoritesPage({
    root,
    storage,
    render: (_container, resources) => rendered.push([...resources]),
    detailsController: { open() {} },
  });

  assert.deepEqual(rendered.at(-1), []);
  assert.equal(elements.get("#favorites-empty").hidden, false);
  assert.equal(elements.get("#favorites-count").textContent, "0 favorites");

  addFavorite(firstResource, storage);
  const page = initializeFavoritesPage({
    root,
    storage,
    render: (_container, resources) => rendered.push([...resources]),
    detailsController: { open() {} },
  });
  assert.equal(rendered.at(-1).length, 1);
  removeFavorite(firstResource.id, storage);
  page.renderFavorites();
  assert.equal(elements.get("#favorites-empty").hidden, false);
});
