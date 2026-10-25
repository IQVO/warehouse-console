// Test stand-in for every federated remote (`<name>_mfe/App`), aliased in
// vitest.config.ts. Evaluating it throws, so a lazy() import of any remote
// rejects the way an unreachable remoteEntry.js would.
throw new Error("remote unavailable (unit test stub)");
