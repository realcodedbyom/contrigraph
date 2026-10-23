# Search appearance

ContriGraph is served under `/contrigraph/`. Google chooses a favicon per hostname, so the deliberately blank domain root now serves a crawlable HTML head with the same icon. Its body remains empty and it is marked noindex. Root favicon files and the root document are allowed by robots.txt; private API paths remain excluded. This does not move the product to the domain root.

The brand SVG has matching ICO (16, 32, and 48 pixel frames), 96 pixel PNG, Apple 180 pixel, and web manifest 192/512 pixel derivatives. Both domain-root and app-prefixed icon URLs must stay available. Install `deploy/nginx/domain-index.html` into `/srv/contrigraph/domain-index.html` and copy root alias assets from `apps/web/public/` when deploying the Nginx config.

Public `/contrigraph/login/` and `/contrigraph/faq/` pages have server-rendered content, distinct titles and canonicals, navigation links, and sitemap entries. The login form uses the existing production Clerk identity and redirects an authenticated session to the private workspace. Workspace and callback pages remain noindex. FAQ structured data lives only on the FAQ page containing its visible answers. It does not promise FAQ rich results.

`metadataBase` uses the domain origin, so app-prefixed image paths do not gain a duplicate `/contrigraph/` segment. Social previews use a PNG image.

Run `npm run build` and `node scripts/verify-production.mjs`. The production checks verify icon file signatures/dimensions and URLs, crawl directives, blank root, public page canonicals, sitemap membership, private workspace noindex, Clerk settings, API authorization, caching, TLS, headers, and request body limits. They do not create accounts or send emails.

Google selects sitelinks automatically. Logical navigation and indexable Login, FAQ, Help, and Product pages improve discovery but cannot force specific sitelinks. Favicon refreshes require recrawling and can take days to weeks; neither submission nor valid markup guarantees display.

References: [Google favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search), [Google sitelinks guidance](https://developers.google.com/search/docs/appearance/sitelinks).
