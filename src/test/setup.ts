// Global vitest setup.
// Tell React this is a test environment so `act` is available on the React
// namespace import. Required for @testing-library/react@16 + React 19
// compatibility (without this, RTL throws "React.act is not a function" when
// rendering on Vercel's CI even though tests pass locally).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
