# Hooks TDZ Guardrail

Avoid referencing later-declared `const` values in hook dependency arrays. This can trigger runtime TDZ crashes (`Cannot access <x> before initialization`) in production bundles.

Approved patterns:

1. Move derived values above hooks that depend on them.
2. Compute dependency values in variables declared before the hook.
3. Avoid module-scope computed constants that depend on values declared later.

Before:

```tsx
useEffect(() => {
  syncData(filterState)
}, [filterState])

const filterState = buildFilterState(input)
```

After:

```tsx
const filterState = buildFilterState(input)

useEffect(() => {
  syncData(filterState)
}, [filterState])
```
