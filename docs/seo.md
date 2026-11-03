# Search visibility

The app is deployed as a single-page application on GitHub Pages. Search metadata for the current
canonical app URL lives in `index.html`; public static assets such as the sitemap and favicon live in
`public/` and are copied to the deployment root by Vite.

## Current URL policy

- Canonical URL: `https://web-tollings.github.io/sql-viewer/`.
- The sitemap lists only that canonical URL. Shared query state is stored in the URL hash, so query
  links are not separate pages and should not be added to the sitemap.
- No marketing landing page or separate educational pages are part of the current site.
- Structured data describes the website only. Do not add ratings, reviews, or other claims unless
  they are genuine and visible to users.

## Updating metadata

When changing the public app identity or deployment URL, update the matching title, description,
canonical URL, Open Graph and Twitter metadata, and JSON-LD in `index.html`. Keep the visible app
heading consistent with the page title. Update `public/sitemap.xml` whenever the site gains a new
canonical, indexable URL.

The project is hosted under a GitHub Pages path (`/sql-viewer/`). A `robots.txt` in this repository
would be served at `/sql-viewer/robots.txt`, while crawlers look for it at the host root. Managing a
host-root `robots.txt` requires control of the `web-tollings.github.io` Pages site, so this project
does not publish a misleading project-level robots file.

## Scope and limitations

The application renders its interface with JavaScript. Search engines that render JavaScript can
inspect the app after rendering, and the HTML includes a useful no-JavaScript fallback. The current
single app URL and lack of indexable educational content limit the range of searches it can target.
Technical metadata improves discovery and sharing but cannot replace useful content or guarantee
search rankings.

After deploying metadata changes, verify the canonical URL and sitemap in Google Search Console and
use its URL Inspection tool to check the rendered page. Search Console ownership verification is
account-specific and must be configured by a repository/site administrator.
