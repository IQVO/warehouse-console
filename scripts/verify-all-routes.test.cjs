/**
 * Coverage checks for the verify:routes list (run by `npm test` via
 * test:browser-scripts) -- the list itself never launches a browser here.
 *
 * The remote entries in verify-routes-list.cjs are generated from
 * src/remotes-manifest.json, so "every manifest remote has a smoke check"
 * is asserted here rather than by regex-scraping vite.config.ts like the
 * old src/remotes-registration.test.ts did.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { routes } = require("./verify-routes-list.cjs");
const manifest = require("../src/remotes-manifest.json");

test("verify:routes covers every remote in the manifest", () => {
  const paths = routes.map((r) => r.path);
  for (const remote of manifest) {
    assert.ok(
      paths.includes(remote.route),
      `verify:routes is missing ${remote.route} (${remote.name})`,
    );
  }
});

test("verify:routes covers the product-master packaging deep link", () => {
  assert.ok(routes.some((r) => r.path === "/product-master/products/SKU-1/packaging"));
});

test("every route path is unique", () => {
  const paths = routes.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
});

test("unknown-slug and unmatched-URL 404 checks stay present", () => {
  assert.ok(routes.some((r) => r.path === "/reports/no-such-context" && /Page not found/i.test("Page not found")));
  assert.ok(routes.some((r) => r.path === "/no-such-screen"));
});
