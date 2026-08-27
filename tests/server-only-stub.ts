// Vitest runs modules directly under Node, not through Next's bundler, which
// is normally what makes the bare `import "server-only"` specifier resolve
// to a no-op on the server and throw on the client. This stub is aliased in
// vitest.config.ts so those imports are inert during tests instead of
// failing to resolve.
export {};
