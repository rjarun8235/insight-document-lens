# COMPREHENSIVE_FIX_PLAN.md
_A 360-degree plan to eradicate TypeScript errors, React 18 incompatibilities, and architectural drift across **insight-document-lens**._

---

## 1. Goals & Success Criteria
| Goal | Success Metric |
|------|----------------|
| 💥 **Zero TS errors** | `pnpm tsc --noEmit` exits 0 |
| ⚛️ **React 18 compatibility** | App builds/runs without `@ts-nocheck` except in 3 whitelisted entry files |
| 🧩 **Consistent types & interfaces** | No `any` or `unknown` in `src/` except in explicit wrappers |
| 🛡 **Universal error boundaries** | Every page/component tree wrapped by an ErrorBoundary |
| 🔗 **Clean service integration** | Services imported **only** via `lib/services/*` barrel |

---

## 2. Work-Streams & Owners
| Stream | Lead | Key Tasks |
|--------|------|-----------|
| **A. Typing sweep** | `@typesquad` | Standardise interfaces, remove stale `Record<string, any>` |
| **B. React 18 patch** | `@frontend` | Apply @ts-nocheck pattern ↔ migrate to _react-18_ types where lib still lags |
| **C. Import sanity** | `@platform` | Auto-migration script to update deleted-module paths |
| **D. Error boundaries** | `@ux` | Create `<AppErrorBoundary>` HOC and wrap in `_app.tsx`, `App.tsx`, pages |
| **E. Service contracts** | `@backend` | Provide d.ts for service responses; add barrel `src/lib/services/index.ts` |

---

## 3. Standard Patterns & Recipes

### 3.1 React 18 TypeScript Compatibility
```
/*  REACT-18 TS GUARD  */
/**
 * @ts-nocheck – remove once upstream library updates
 * Reason  : <link to issue>
 * Affected: only UI files importing shadcn primitives.
 */
```
*   Allowed _only_ in: `App.tsx`, `DocumentProcessing.tsx`, `index.tsx`.  
*   CI rule: fail build if `@ts-nocheck` appears elsewhere.

### 3.2 Import/Export Hygiene
Pattern:
```
import { DocumentExtractorService } from '@/lib/services';
               ^ barrel path
```
* No deep relative imports such as `../../document-extractor.service`.
* ESLint rule `"no-restricted-imports"` to enforce barrel only.

### 3.3 Type Definition Standardisation
*   Single source: `src/types/*.d.ts` & `src/lib/models/*`.
*   All domain models exported via `src/lib/models/index.ts`.
*   Replace `Partial<Record<...>>` > unclear maps with explicit optional properties.
*   Never mutate service response types in UI – use adapters.

### 3.4 Component Interface Consistency
```
type FooProps = {
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;
```
*   All domain components extend a base.
*   No generic `props: any`.

### 3.5 Error Boundary Template
```tsx
export function withErrorBoundary<T>(
  Component: React.FC<T>,
  Fallback: React.FC<{error: Error}>
) {
  return function Wrapped(props: T) {
    return (
      <ErrorBoundary fallback={<Fallback/>}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```
*   Applied in layout wrappers only.

### 3.6 Service Integration Pattern
```
const extractor = useMemo(() => new DocumentExtractorService(api), []);
const { data, error } = useAsync(() => extractor.extract(docs), [docs]);
```
* No service instantiation inside render loops.
* All side-effects handled via `useEffect` / `useAsync`.

---

## 4. Detailed Task List

| # | File/Glob | Fix |
|---|-----------|-----|
| 1 | `src/**/*.tsx` | Replace invalid JSX component return types; align keys; add generic typing where missing |
| 2 | `src/lib/services/**/*.ts` | Remove dangling imports (`document-validation.ts`, `field-confidence.ts`); ensure `Partial<Record>` for optional maps |
| 3 | `src/templates/*.ts` | Export functions not classes where no state; update call-sites |
| 4 | `src/pages/**/*` | Import barrel services; wrap with ErrorBoundary; remove duplicate state |
| 5 | `src/components/ui/*.tsx` (3rd-party) | Add `// @ts-nocheck` header if library not yet typesafe |
| 6 | `tsconfig.json` | `"skipLibCheck": true`, path aliases for `@/lib/*` |
| 7 | CI | Add `pnpm type-check` step; fail on `.ts` errors; lint for no-unchecked‐files |
| 8 | Docs | Document pattern in `ARCHITECTURE.md` section **“Type Strategy”** |

---

## 5. Validation & QA

1. **Static**  
   `pnpm lint && pnpm type-check && pnpm test` must pass.

2. **Runtime**  
   `pnpm dev`, run end-to-end happy path: upload → extract → verify → download report.

3. **Regression**  
   Cypress tests for each document type with fixture files.

---

## 6. Timeline

| Day | Deliverable |
|-----|-------------|
| **D0** | Branch `fix/ts-cleanup`, code freeze legacy paths |
| **D1** | Import sweep script + barrel export; 50 % TS errors resolved |
| **D2** | React 18 guard applied; type models centralised |
| **D3** | Error boundaries implemented; all tests pass locally |
| **D4** | CI green; PR ready; review & merge to `main` |

---

## 7. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Upstream UI lib still untyped | Build fails | `@ts-nocheck` guard, track issue |
| Hidden deep import in legacy code | Runtime error | ESLint restricted-import rule |
| Large diff overwhelms reviewers | Delay | Split PR into stream-based stacks |

---

## 8. Definition of Done
- `[ ]` `pnpm type-check` returns **0 errors**  
- `[ ]` No `@ts-nocheck` outside whitelisted files  
- `[ ]` All runtime flows work (upload → insights)  
- `[ ]` Docs updated & team briefed  

> _“Measure twice, cut once.”  — Every successful refactor_  
