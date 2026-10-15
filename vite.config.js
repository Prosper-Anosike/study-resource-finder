import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        favorites: resolve(root, "favorites.html"),
      },
    },
  },
};
