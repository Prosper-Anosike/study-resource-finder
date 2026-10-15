# Study Resource Finder

Study Resource Finder makes it easier for students to discover books and learning resources in one place. Search across Google Books and Open Library, explore resource details, filter results, and save favorites to revisit later.

**[Visit the live application](https://study-resource-finder-spvl.onrender.com/)**

## Features

- **Search:** Find books and learning resources using Google Books and Open Library.
- **Resource details:** Explore available information, including authors, descriptions, publication dates, categories, and links to the original sources.
- **Filtering and sorting:** Narrow results by category, publication year, and full-text availability, then organize them using the available sorting options.
- **Favorites:** Save resources and revisit them on a dedicated Favorites page. Saved items remain available after refreshing the browser.
- **Responsive design:** Use the application on desktop computers, tablets, and mobile devices.
- **Accessible interface:** Navigate interactive elements using the keyboard and benefit from clear interface feedback and reduced-motion support.
- **Reliable search feedback:** Loading indicators, error messages, and provider-specific warnings help explain what is happening when a search succeeds or encounters a problem.

## Built With

- **HTML5** for semantic page structure.
- **CSS3** for styling, responsive layouts, and interface effects.
- **JavaScript ES modules** for application logic and interactive features.
- **Vite** for local development and production builds.
- **Google Books API** and **Open Library Search API** for book data.
- **LocalStorage** for saving favorites in the browser.

The application uses vanilla JavaScript without a JavaScript UI framework.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js 20.19+ or 22.12+
- npm
- A modern web browser

### Installation

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/Prosper-Anosike/study-resource-finder.git
cd study-resource-finder
```

Install the project dependencies:

```bash
npm install
```

### Configure Google Books

To enable Google Books API access during local development, create a `.env.local` file in the project root and add your API key:

```env
VITE_GOOGLE_BOOKS_API_KEY=your_google_books_api_key
```

Replace `your_google_books_api_key` with your own Google Books API key.

Keep `.env.local` out of version control. The project uses Vite environment variables, which are embedded into the client-side application and are therefore visible to users. Restrict your API key in Google Cloud instead of treating it as a secret.

Open Library does not require an API key.

### Start the Development Server

Run:

```bash
npm run dev
```

Vite will display the local development URL in the terminal. Open that address in your browser to use the application.

## Available Commands

The following commands are available for formatting, checking, testing, and building the project.

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the local development server.            |
| `npm run format`       | Format the project files.                      |
| `npm run format:check` | Check whether files meet the formatting rules. |
| `npm run lint`         | Run the code linter.                           |
| `npm test`             | Run the automated tests.                       |
| `npm run build`        | Create the production build.                   |

The production build is generated in the `dist/` directory.

## How Search Works

Study Resource Finder retrieves results from Google Books and Open Library and converts them into a consistent format that the interface can display.

The two providers return different data structures, so the application normalizes their responses before rendering resource cards and details.

Search requests run concurrently. When one provider fails, the application can still display results from the other provider and report the problem. If both providers fail, the search returns an error that the interface can communicate to the user.

Search results are filtered and sorted in the browser without requiring another API request for each change.

## Favorites

Favorites are stored locally in the browser using LocalStorage. This allows saved resources to remain available when the page is refreshed or the user returns to the application in the same browser.

Favorites are not synchronized between devices or browsers, and the application does not use an account or server-side storage for them.

## APIs

### Google Books

The Google Books Volumes API provides book information, including titles, authors, descriptions, publication details, and links where available.

API endpoint:

`https://www.googleapis.com/books/v1/volumes`

### Open Library

The Open Library Search API provides book search results and associated metadata.

API endpoint:

`https://openlibrary.org/search.json`

Both providers may return incomplete information for some resources. Available details therefore depend on the data supplied by the source.

## Deployment

The application is deployed as a static site on Render.

**Live application:** https://study-resource-finder-spvl.onrender.com/

To deploy your own instance, create a Render Static Site connected to the repository and use these settings:

| Setting              | Value                          |
| -------------------- | ------------------------------ |
| Build command        | `npm install && npm run build` |
| Publish directory    | `dist`                         |
| Environment variable | `VITE_GOOGLE_BOOKS_API_KEY`    |

Add the Google Books API key through the Render service's environment settings. Because Vite embeds its environment variables during the build, changes to the key require a new build and deployment.

For production, restrict the Google Books API key in Google Cloud to the required API and configure an HTTP referrer restriction for the deployed website. If you use a custom domain, include the appropriate domain restriction as well.

## Project Structure

```text
study-resource-finder/
├── css/
│   └── styles.css
├── js/
│   ├── apiClient.js
│   ├── config.js
│   ├── favorites.js
│   ├── filtersSort.js
│   ├── main.js
│   ├── renderResources.js
│   ├── resourceDetails.js
│   ├── resourceNormalizer.js
│   ├── search.js
│   └── uiHelpers.js
├── tests/
│   ├── apiClient.test.js
│   └── foundation.test.js
├── favorites.html
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Key Modules

- **`apiClient.js`** handles provider requests, combined searches, and successful-response caching.
- **`resourceNormalizer.js`** converts Google Books and Open Library responses into a consistent resource structure.
- **`search.js`** manages search form interactions and status messages.
- **`renderResources.js`** creates resource cards from search results.
- **`resourceDetails.js`** manages the resource-details dialog.
- **`filtersSort.js`** handles result filtering and sorting.
- **`favorites.js`** manages saved resources and the Favorites page.
- **`config.js`** centralizes API configuration and search settings.
- **`main.js`** initializes the home page.
- **`uiHelpers.js`** contains shared interface utilities.
- **`vite.config.js`** includes both the discover and favorites pages in production builds.

## Development Notes

The application treats data returned by external APIs as untrusted input. Resource information is inserted into the interface as text rather than interpreted as raw HTML, and external links are validated before being displayed.

Search responses can be incomplete, and either provider may be temporarily unavailable. The application is designed to handle partial failures where possible and communicate search problems through the interface.

Favorites are stored locally, so clearing browser storage also removes saved resources.

## License

No license has been specified for this project. Unless a license is added to the repository, reuse and redistribution are subject to the applicable copyright rules.
