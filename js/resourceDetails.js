const ALLOWED_LINK_HOSTS = new Set([
  "books.google.com",
  "play.google.com",
  "www.google.com",
  "openlibrary.org",
]);
const ALLOWED_IMAGE_HOSTS = new Set([
  ...ALLOWED_LINK_HOSTS,
  "covers.openlibrary.org",
]);

function validExternalUrl(value, hosts) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !hosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function appendMetadata(parent, label, value, doc) {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }
  const term = doc.createElement("dt");
  term.textContent = label;
  const description = doc.createElement("dd");
  description.textContent = value;
  parent.append(term, description);
}

function listText(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).join(", ")
    : "";
}

function appendResourceDetails(container, resource, doc) {
  const fragment = doc.createDocumentFragment();
  const title = doc.createElement("h3");
  title.className = "details-title";
  title.textContent = resource.title || "Title unavailable";
  fragment.append(title);

  const coverUrl = validExternalUrl(resource.thumbnail, ALLOWED_IMAGE_HOSTS);
  if (coverUrl) {
    const image = doc.createElement("img");
    image.className = "details-cover";
    image.src = coverUrl;
    image.alt = resource.title ? `Cover of ${resource.title}` : "Book cover";
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        image.remove();
      },
      { once: true },
    );
    fragment.append(image);
  }

  const metadata = doc.createElement("dl");
  metadata.className = "details-metadata";
  appendMetadata(metadata, "Authors", listText(resource.authors), doc);
  appendMetadata(metadata, "Publisher", resource.publisher, doc);
  appendMetadata(metadata, "Publication date", resource.publishedDate, doc);
  appendMetadata(
    metadata,
    "Page count",
    Number.isInteger(resource.pageCount) && resource.pageCount > 0
      ? String(resource.pageCount)
      : "",
    doc,
  );
  appendMetadata(metadata, "ISBNs", listText(resource.isbn), doc);
  appendMetadata(metadata, "Source", resource.source, doc);
  appendMetadata(metadata, "Categories", listText(resource.categories), doc);
  appendMetadata(metadata, "Description", resource.description, doc);
  if (metadata.childElementCount > 0) {
    fragment.append(metadata);
  }

  const links = doc.createElement("div");
  links.className = "details-links";
  for (const [label, value] of [
    ["More information", resource.infoUrl],
    ["Preview", resource.previewUrl],
  ]) {
    const href = validExternalUrl(value, ALLOWED_LINK_HOSTS);
    if (!href) {
      continue;
    }
    const link = doc.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    links.append(link);
  }
  if (links.childElementCount > 0) {
    fragment.append(links);
  }

  if (
    !metadata.childElementCount &&
    !coverUrl &&
    links.childElementCount === 0
  ) {
    const fallback = doc.createElement("p");
    fallback.className = "details-placeholder";
    fallback.textContent =
      "No additional details are available for this resource.";
    fragment.append(fallback);
  }

  container.replaceChildren(fragment);
}

export function getResourceDetailsDialog(root = document) {
  return root.querySelector("#resource-details");
}

export function initializeResourceDetails({ root = document } = {}) {
  const doc = root.ownerDocument ?? root;
  const dialog = getResourceDetailsDialog(root);
  const content = root.querySelector("#details-content");
  const closeButton = root.querySelector("#details-close");
  if (!dialog || !content || !closeButton) {
    throw new Error(
      "The resource details dialog is missing required elements.",
    );
  }

  let opener = null;
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    if (opener?.isConnected) {
      opener.focus();
    }
    opener = null;
  });

  function open(resource, trigger) {
    opener = trigger;
    appendResourceDetails(content, resource, doc);
    try {
      dialog.showModal();
      closeButton.focus();
      return true;
    } catch {
      content.replaceChildren();
      const message = doc.createElement("p");
      message.className = "details-placeholder";
      message.textContent = "Resource details could not be opened.";
      content.append(message);
      opener = null;
      if (trigger?.isConnected) {
        trigger.focus();
      }
      return false;
    }
  }

  return { dialog, open };
}
