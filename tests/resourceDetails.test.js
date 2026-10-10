import assert from "node:assert/strict";
import test from "node:test";
import { initializeResourceDetails } from "../js/resourceDetails.js";

class ElementStub {
  attributes = new Map();
  children = [];
  listeners = new Map();
  textContent = "";
  isConnected = true;
  focused = false;
  open = false;

  constructor(tagName = "") {
    this.tagName = tagName;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children.flatMap((child) =>
      child.isFragment ? child.children : [child],
    );
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
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

  get childElementCount() {
    return this.children.length;
  }
}

class FragmentStub extends ElementStub {
  isFragment = true;
}

function createDialogFixture() {
  const selectors = ["#resource-details", "#details-content", "#details-close"];
  const elements = new Map(
    selectors.map((selector) => [selector, new ElementStub()]),
  );
  const root = {
    querySelector: (selector) => elements.get(selector) ?? null,
    createElement: (tagName) => new ElementStub(tagName),
    createDocumentFragment: () => new FragmentStub(),
  };
  return { elements, root };
}

function allText(node) {
  return [
    node.textContent,
    ...node.children.flatMap((child) => allText(child)),
  ].join(" ");
}

test("details show available normalized metadata as text and safe provider links", () => {
  const { elements, root } = createDialogFixture();
  const details = initializeResourceDetails({ root });
  const opener = new ElementStub();
  const unsafeDescription = '<img src=x onerror="alert(1)">';
  const resource = {
    title: "JavaScript",
    authors: ["A. Author"],
    thumbnail: "https://covers.openlibrary.org/b/id/123-M.jpg",
    description: unsafeDescription,
    publisher: "Example Press",
    publishedDate: "2024",
    pageCount: 321,
    categories: ["Programming", "Web"],
    isbn: ["9780000000000"],
    source: "Open Library",
    infoUrl: "https://openlibrary.org/works/OL123W",
    previewUrl: "https://evil.example/preview",
  };

  assert.equal(details.open(resource, opener), true);
  const content = elements.get("#details-content");
  assert.match(allText(content), /JavaScript/);
  assert.match(allText(content), /A\. Author/);
  assert.match(allText(content), /Example Press/);
  assert.match(allText(content), /321/);
  assert.match(allText(content), /9780000000000/);
  assert.match(allText(content), /Open Library/);
  assert.match(
    allText(content),
    new RegExp(unsafeDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(
    content.children.some((child) => child.innerHTML),
    false,
  );

  const metadata = content.children.find(
    (child) => child.className === "details-metadata",
  );
  const labels = metadata.children
    .filter((child) => child.tagName === "dt")
    .map((child) => child.textContent);
  assert.ok(labels.includes("Description"));
  const links = content.children.find(
    (child) => child.className === "details-links",
  );
  assert.equal(links.children.length, 1);
  assert.equal(links.children[0].href, "https://openlibrary.org/works/OL123W");
  assert.equal(links.children[0].rel, "noopener noreferrer");
});

test("details omit missing fields, fall back for title, and close with focus restoration", () => {
  const { elements, root } = createDialogFixture();
  const details = initializeResourceDetails({ root });
  const opener = new ElementStub();

  details.open(
    {
      id: "open-library:/works/OL123W",
      title: null,
      authors: [],
      thumbnail: null,
      description: null,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      categories: [],
      isbn: [],
      source: "Open Library",
      infoUrl: null,
      previewUrl: null,
    },
    opener,
  );

  const content = elements.get("#details-content");
  const metadata = content.children.find(
    (child) => child.className === "details-metadata",
  );
  const labels = metadata.children
    .filter((child) => child.tagName === "dt")
    .map((child) => child.textContent);
  assert.equal(content.children[0].textContent, "Title unavailable");
  assert.deepEqual(labels, ["Source"]);
  assert.equal(elements.get("#details-close").focused, true);

  elements.get("#details-close").listeners.get("click")();
  assert.equal(elements.get("#resource-details").open, false);
  assert.equal(opener.focused, true);
});

test("dialog close event restores the invoking control after native dismissal", () => {
  const { elements, root } = createDialogFixture();
  const details = initializeResourceDetails({ root });
  const opener = new ElementStub();
  details.open({ title: "Minimal", source: "Google Books" }, opener);

  elements.get("#resource-details").close();

  assert.equal(opener.focused, true);
});

test("Escape key dismissal closes the dialog and restores focus", () => {
  const { elements, root } = createDialogFixture();
  const details = initializeResourceDetails({ root });
  const opener = new ElementStub();
  details.open({ title: "Keyboard dismissal" }, opener);
  let prevented = false;

  elements.get("#resource-details").listeners.get("keydown")({
    key: "Escape",
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(elements.get("#resource-details").open, false);
  assert.equal(opener.focused, true);
});

test("dialog open failure is handled without throwing", () => {
  const { elements, root } = createDialogFixture();
  elements.get("#resource-details").showModal = () => {
    throw new Error("Dialog unavailable");
  };
  const details = initializeResourceDetails({ root });

  assert.equal(details.open({ title: "Book" }, new ElementStub()), false);
  assert.match(
    allText(elements.get("#details-content")),
    /could not be opened/,
  );
});
