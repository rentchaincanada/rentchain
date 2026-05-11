# Rule: TypeScript Only (applies to rentchain-frontend/**, rentchain-api/**)

- All new files must use `.ts` or `.tsx` extension
- No `.js` or `.jsx` files in src directories
- No `any` type without an inline `// TODO: type this` comment
- Node version is pinned to 20.11.1 - do not use Node 22+ APIs
- Do not add npm dependencies without noting them in the session handoff block
