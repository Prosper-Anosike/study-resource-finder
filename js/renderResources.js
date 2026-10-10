const GOOGLE_BOOKS_HOSTS = new Set([
  "books.google.com",
  "play.google.com",
  "www.google.com",
]);
const OPEN_LIBRARY_HOSTS = new Set(["openlibrary.org"]);
const RESOURCE_IMAGE_HOSTS = new Set([
  ...GOOGLE_BOOKS_HOSTS,
  ...OPEN_LIBRARY_HOSTS,
  "covers.openlibrary.org",
]);
const RESOURCE_LINK_HOSTS = new Set([
  ...GOOGLE_BOOKS_HOSTS,
  ...OPEN_LIBRARY_HOSTS,
]);

export function isSafeResourceLink(value) {
  return isSafeResourceUrl(value, RESOURCE_LINK_HOSTS);
}

function isSafeResourceImage(value) {
  return isSafeResourceUrl(value, RESOURCE_IMAGE_HOSTS);
}

function isSafeResourceUrl(value, allowedHosts) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      allowedHosts.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function createCover(resource) {
  const cover = document.createElement("div");
  cover.className = "resource-cover";
  const fallback = document.createElement("span");
  fallback.className = "cover-fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.textContent = "Book cover unavailable";

  if (resource.thumbnail && isSafeResourceImage(resource.thumbnail)) {
    const image = document.createElement("img");
    image.src = resource.thumbnail;
    image.alt = resource.title ? `Cover of ${resource.title}` : "Book cover";
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        image.remove();
        cover.classList.add("resource-cover-missing");
        cover.setAttribute("aria-label", "Cover image unavailable");
        fallback.hidden = false;
      },
      { once: true },
    );
    cover.append(image);
    fallback.hidden = true;
  } else {
    cover.classList.add("resource-cover-missing");
    cover.setAttribute("aria-label", "No cover image available");
  }
  cover.append(fallback);

  return cover;
}

function appendResourceLink(parent, label, href) {
  if (!isSafeResourceLink(href)) {
    return;
  }

  const link = document.createElement("a");
  link.className = "resource-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  parent.append(link);
}

function createResourceCard(resource, { favoriteIds, favoriteMode }) {
  const card = document.createElement("article");
  card.className = "resource-card";

  const cover = createCover(resource);
  const content = document.createElement("div");
  content.className = "resource-card-content";
  const source = appendTextElement(
    content,
    "span",
    "source-badge",
    resource.source || "Source unavailable",
  );
  source.setAttribute("aria-label", `Source: ${source.textContent}`);

  appendTextElement(
    content,
    "h3",
    "resource-title",
    resource.title || "Title unavailable",
  );

  const authors = Array.isArray(resource.authors)
    ? resource.authors.filter(
        (author) => typeof author === "string" && author.trim(),
      )
    : [];
  appendTextElement(
    content,
    "p",
    "resource-authors",
    authors.length > 0 ? authors.join(", ") : "Author not listed",
  );

  if (typeof resource.publishedDate === "string" && resource.publishedDate) {
    appendTextElement(
      content,
      "p",
      "resource-date",
      `Published ${resource.publishedDate}`,
    );
  }
  if (typeof resource.description === "string" && resource.description) {
    appendTextElement(
      content,
      "p",
      "resource-description",
      resource.description,
    );
  }
  const categories = Array.isArray(resource.categories)
    ? resource.categories.filter(
        (category) => typeof category === "string" && category.trim(),
      )
    : [];
  if (categories.length > 0) {
    appendTextElement(
      content,
      "p",
      "resource-categories",
      categories.join(" · "),
    );
  }

  const links = document.createElement("div");
  links.className = "resource-links";
  appendResourceLink(links, "More information", resource.infoUrl);
  appendResourceLink(links, "Preview", resource.previewUrl);
  if (links.childElementCount > 0) {
    content.append(links);
  }

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "resource-favorite-button";
  favoriteButton.type = "button";
  if (favoriteMode === "remove") {
    favoriteButton.textContent = "Remove from Favorites";
    favoriteButton.setAttribute(
      "aria-label",
      `Remove ${resource.title || "resource"} from favorites`,
    );
    favoriteButton.setAttribute("data-remove-favorite-id", resource.id);
  } else {
    const favorite = favoriteIds.has(resource.id);
    favoriteButton.textContent = favorite ? "Favorited" : "Add to Favorites";
    favoriteButton.setAttribute(
      "aria-label",
      favorite
        ? `Remove ${resource.title || "resource"} from favorites`
        : `Add ${resource.title || "resource"} to favorites`,
    );
    favoriteButton.setAttribute("aria-pressed", String(favorite));
    favoriteButton.setAttribute("data-favorite-id", resource.id);
    favoriteButton.classList.toggle("is-favorited", favorite);
  }
  content.append(favoriteButton);

  const detailsButton = document.createElement("button");
  detailsButton.className = "resource-details-button";
  detailsButton.type = "button";
  detailsButton.textContent = "Details";
  detailsButton.setAttribute(
    "aria-label",
    `Details for ${resource.title || "resource"}`,
  );
  detailsButton.setAttribute("data-resource-id", resource.id);
  content.append(detailsButton);

  card.append(cover, content);
  return card;
}

export function renderResources(
  container,
  resources,
  { favoriteIds = new Set(), favoriteMode = "toggle" } = {},
) {
  const fragment = document.createDocumentFragment();
  for (const resource of resources) {
    fragment.append(
      createResourceCard(resource, { favoriteIds, favoriteMode }),
    );
  }
  container.replaceChildren(fragment);
}
