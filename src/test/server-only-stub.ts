// Vitest stub for the `server-only` package. The real module throws on import
// when bundled into a Client Component, which is the wrong signal in a node
// unit-test runner. Mapping the bare specifier here makes the side-effect
// import a no-op so server-side lib modules can be tested directly.
export {}
