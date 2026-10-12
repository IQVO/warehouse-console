import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static drift guards for packaging and repo hygiene: facts that live in
 * two files at once (what CI publishes vs what the chart pulls, what the
 * Dockerfile builds on vs what its comment says) and drifted apart before.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("Helm chart image default", () => {
  it("pulls the repository CI publishes", () => {
    const published = [
      ...read(".github/workflows/ci.yml").matchAll(/(ghcr\.io\/iqvo\/warehouse-console):/g),
    ].map((m) => m[1]);
    expect(published.length).toBeGreaterThan(0);
    const values = read("charts/warehouse-console/values.yaml");
    const repository = values.match(/^image:\n(?:\s+#.*\n)*\s+repository:\s*(\S+)$/m)?.[1];
    expect(repository).toBe("ghcr.io/iqvo/warehouse-console");
    expect(new Set(published)).toEqual(new Set([repository]));
  });
});

describe("Dockerfile", () => {
  it("names the node builder image its FROM lines actually use", () => {
    const dockerfile = read("Dockerfile");
    const fromImages = new Set(
      [...dockerfile.matchAll(/^FROM (node:[^@\s]+)/gm)].map((m) => m[1]),
    );
    expect(fromImages.size).toBe(1);
    const [builder] = [...fromImages];
    // The numbered rationale comment names the builder base explicitly.
    expect(dockerfile).toMatch(new RegExp(`^# 1\\. ${builder.replace(/[.]/g, "\\.")},`, "m"));
  });
});

describe(".gitignore", () => {
  it("ignores the developer's untracked public/config.json", () => {
    expect(read(".gitignore").split("\n")).toContain("public/config.json");
  });
});

describe("src/config.ts", () => {
  it("does not claim Kong lacks a reports route", () => {
    const config = read("src/config.ts");
    expect(config).not.toMatch(/INFRA GAP/);
    expect(config).not.toMatch(/404s\s+against today's cluster/);
    expect(config).not.toMatch(/nothing in\s+\*?\s*warehouse-infra points a Kong route/);
  });
});
