// Read-only production smoke checks. Never creates users or sends mail.
import assert from "node:assert/strict";
const origin = "https://dsvv.live";
const paths = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/contrigraph/",
  "/contrigraph/help/",
  "/contrigraph/faq/",
  "/contrigraph/login/",
  "/contrigraph/privacy/",
  "/contrigraph/app/",
  "/contrigraph/favicon.svg",
  "/contrigraph/robots.txt",
  "/contrigraph/sitemap.xml",
  "/contrigraph/api/health",
];
const responses = await Promise.all(
  paths.map(async (path) => {
    const response = await fetch(origin + path, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, path);
    assert.ok(
      response.headers.get("x-content-type-options") === "nosniff",
      path,
    );
    assert.ok(response.headers.get("strict-transport-security"), path);
    return [path, response, await response.text()];
  }),
);
const [, homepage, html] = responses.find(([path]) => path === "/contrigraph/");
const health = JSON.parse(
  responses.find(([path]) => path === "/contrigraph/api/health")[2],
);
assert.equal(health.identity, "clerk");
assert.equal(health.database, "postgres");
assert.equal(health.sandbox, false);
assert.match(
  homepage.headers.get("content-security-policy"),
  /https:\/\/clerk\.dsvv\.live/,
);
assert.doesNotMatch(
  homepage.headers.get("content-security-policy"),
  /clerk\.accounts\.dev/,
);
assert.match(homepage.headers.get("cache-control"), /no-cache/);
assert.equal(homepage.headers.get("x-powered-by"), null);
assert.match(html, /Know what/);
assert.match(html, /id="walkthrough"/);
assert.match(html, /Explore the team workflow/);
assert.match(html, /application\/ld\+json/);
assert.match(html, /og:title/);
assert.match(html, /rel="canonical"/);
assert.match(html, /https:\/\/dsvv\.live\/contrigraph\/og-image\.png/);
assert.doesNotMatch(html, /contrigraph\/contrigraph\//);
assert.match(html, /href="\/contrigraph\/favicon-96x96\.png"/);
const rootHtml = responses.find(([path]) => path === "/")[2];
assert.match(rootHtml, /<body><\/body>/, "Domain root remains visibly blank");
assert.match(rootHtml, /rel="icon" href="\/favicon.ico"/);
const robots = responses.find(([path]) => path === "/robots.txt")[2];
assert.match(robots, /Allow: \/\$/);
assert.match(robots, /Allow: \/favicon.ico/);
const sitemap = responses.find(([path]) => path === "/sitemap.xml")[2];
for (const slug of ["login", "faq"]) {
  const page = responses.find(([path]) => path === `/contrigraph/${slug}/`)[2];
  assert.doesNotMatch(page, /content="noindex/);
  assert.match(
    page,
    new RegExp(
      `<link rel="canonical" href="https://dsvv.live/contrigraph/${slug}/"`,
    ),
  );
  assert.ok(sitemap.includes(`https://dsvv.live/contrigraph/${slug}/`));
}
const faq = responses.find(([path]) => path === "/contrigraph/faq/")[2];
assert.match(faq, /Frequently asked questions/);
assert.match(faq, /single-specialist/);
assert.match(faq, /"@type":"FAQPage"/);
assert.doesNotMatch(
  html,
  /"@type":"FAQPage"/,
  "FAQ schema stays on the page containing the full answers",
);
assert.match(
  responses.find(([path]) => path === "/contrigraph/app/")[2],
  /content="noindex/,
);
for (const path of [
  "/favicon.ico",
  "/contrigraph/favicon.ico",
  "/favicon-96x96.png",
  "/contrigraph/favicon-96x96.png",
  "/apple-touch-icon.png",
  "/contrigraph/apple-touch-icon.png",
  "/contrigraph/og-image.png",
]) {
  const icon = await fetch(origin + path, {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(icon.status, 200, path);
  const data = new Uint8Array(await icon.arrayBuffer());
  assert.ok(data.length > 100, path);
  if (path.endsWith(".png")) {
    assert.match(icon.headers.get("content-type"), /image\/png/);
    assert.deepEqual(
      Array.from(data.slice(0, 8)),
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    const view = new DataView(data.buffer);
    const expected = path.includes("96x96")
      ? 96
      : path.includes("apple-touch")
        ? 180
        : 1200;
    assert.equal(view.getUint32(16), expected, path);
  } else assert.deepEqual(Array.from(data.slice(0, 4)), [0, 0, 1, 0]);
}
const manifest = await (
  await fetch(origin + "/contrigraph/site.webmanifest")
).json();
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith("/contrigraph/"));
  assert.equal((await fetch(origin + icon.src)).status, 200);
}
const asset = html.match(/\/contrigraph\/_next\/static\/[^" ]+\.js/)?.[0];
assert.ok(asset, "Hashed JavaScript asset is linked");
const staticResponse = await fetch(origin + asset, {
  signal: AbortSignal.timeout(20000),
});
assert.equal(staticResponse.status, 200);
assert.match(
  staticResponse.headers.get("cache-control"),
  /max-age=31536000.*immutable/,
);
const www = await fetch("https://www.dsvv.live/contrigraph/", {
  redirect: "manual",
  signal: AbortSignal.timeout(20000),
});
assert.equal(www.status, 301);
assert.equal(www.headers.get("location"), origin + "/contrigraph/");
const alias = await fetch(origin + "/contrigraph/LOGIN/", {
  redirect: "manual",
});
assert.equal(alias.status, 301);
assert.equal(
  new URL(alias.headers.get("location"), origin).pathname,
  "/contrigraph/login/",
);
const body = await fetch(origin + "/contrigraph/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "x".repeat(17000),
});
assert.equal(body.status, 413);
assert.equal((await body.json()).detail, "Request too large.");
const me = await fetch(origin + "/contrigraph/api/auth/me");
assert.equal(me.status, 401);
const notifications = await fetch(origin + "/contrigraph/api/notifications");
assert.equal(notifications.status, 401);
const settings = await fetch("https://clerk.dsvv.live/v1/environment", {
  signal: AbortSignal.timeout(20000),
});
assert.equal(settings.status, 200);
const identity = await settings.json();
assert.equal(identity.display_config.instance_environment_type, "production");
assert.equal(
  identity.user_settings.attributes.email_address.verify_at_sign_up,
  true,
);
assert.equal(identity.user_settings.social.oauth_google.enabled, true);
const callback = await fetch(origin + "/contrigraph/app/sso-callback/");
assert.equal(callback.status, 200);
assert.match(await callback.text(), /noindex/);
console.log(
  `${paths.length} public routes passed; production Clerk, Google/email settings, unauthorized access, callback indexing, caching, TLS, headers, metadata, alias, and body limit passed.`,
);
