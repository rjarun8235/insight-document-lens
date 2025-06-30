# Refactoring Plan – insight-document-lens

## 1. Current Issues

| Area | Problems Observed | Impact |
|------|------------------|--------|
| **Monolithic Services** | `LLMExtractionService.ts` (≈1 800 LOC) mixes React hooks, Claude API calls, extraction, validation, comparison. | Hard to reason, test, or extend. |
| **Validation Duplication** | `document-validation.ts`, `document-relationship-validator.ts`, `document-field-comparator.ts`, etc. repeat field-checking logic. | Inconsistent rules, bloated code (>2 000 LOC). |
| **Complex UI Components** | Pages such as `DocumentProcessingDemo.tsx` own global state, orchestration, and presentation. | Prop-drilling, tight coupling, difficult UI changes. |
| **Scattered Utilities / Error-Handling** | Helper functions live in many files; errors handled ad-hoc with `console.error`. | Reuse hindered, unreadable logs. |
| **Legacy / Dead Code** | Mock-mode code, commented blocks, outdated prototypes. | Noise, larger bundle size, higher maintenance cost. |

---

## 2. Target Architecture Overview

```
src/
├── components/            # Pure presentation (React/TSX)
│   ├── shared/            # Generic UI atoms/molecules
│   └── domain/            # Document-specific widgets
├── contexts/              # React Context providers (App, DocumentProcessing)
├── services/              # Business logic (no React)
│   ├── claude/            # ClaudeApiService
│   ├── extraction/        # DocumentExtractorService
│   ├── validation/        # ValidationRegistry, validators/*
│   └── verification/      # DocumentVerificationService, FieldComparator
├── models/                # TS interfaces & types
├── utils/                 # Pure utilities (error-handler, data-utils, safeGetStringValue)
└── pages/                 # Next/React Router pages – thin, call hooks/contexts
```

Key principles  
• **Separation of Concerns** – UI ↔ business logic ↔ API isolation.  
• **Single-responsibility services** – each folder encapsulates one bounded context.  
• **Composable validators** – plug-and-play functions registered centrally.  
• **Typed contracts** – models are the only dependency between layers.

---

## 3. Service Layer Refactor

| New Service | Responsibility | Key Files |
|-------------|----------------|-----------|
| **ClaudeApiService** | HTTP proxy wrapper; retries, auth, rate-limit. | `/services/claude/claude-api.service.ts` |
| **DocumentExtractorService** | ① Pre-process text ② build prompt (via `PromptBuilder`) ③ call ClaudeApiService ④ parse & return `ExtractionResult`. | `/services/extraction/` |
| **ValidationRegistry** | Holds `Map<validatorId, ValidatorFn>`; executes validators in sequence; aggregates `ValidationResults`. | `/services/validation/validation-registry.ts` |
| **DocumentVerificationService** | Cross-doc field mapping, calls `FieldComparator`, produces `VerificationReport`. | `/services/verification/` |

Support classes  
* `PromptBuilder`, `ExtractionResultParser` → keep files tiny (≤150 LOC).  
* `validators/*` – each rule in its own file, unit-tested.

---

## 4. UI Component Simplification

1. **Presentation-only components** in `components/shared` – `ResultCard`, `DataTable`, `JsonViewer`.
2. **Domain widgets** in `components/domain` – `DocumentUpload`, `ExtractionStatus`, `VerificationSummary`.
3. **Context-based state**  
   * `DocumentProcessingContext` supplies: `documents`, `extractionResults`, `verificationReport`, dispatch actions.  
   * Pages merely render and subscribe.

Benefits: zero prop-drilling, testable UI, SSR friendly.

---

## 5. Code Cleanup & Redundancy Removal

- Delete mock data generators, unused imports, commented blocks.
- Consolidate all “safe get” helpers into `utils/data-utils.ts`.
- Standardize error handling via `utils/error-handler.ts`; no raw `console.*`.
- Enforce single logger (`ExtractionLogger` or external library).

---

## 6. Implementation Roadmap

| Phase | Scope | Concrete Steps | Estimated Effort |
|-------|-------|---------------|------------------|
| **1. Skeleton & Utilities** | Folder restructure; move type defs. | • Create `models`, `utils`.<br>• Migrate interfaces.<br>• Add global `ErrorHandler`. | 0.5 day |
| **2. Core Services** | Claude + extraction isolate. | • Extract `ClaudeApiService`.<br>• Split `LLMExtractionService` into `DocumentExtractorService`, `PromptBuilder`, `ExtractionResultParser`.<br>• Unit tests. | 1 – 2 days |
| **3. Validation Layer** | Registry + modular rules. | • Implement `ValidationRegistry`.<br>• Port existing rules; remove duplicates.<br>• Add HSN, business-rules validators. | 1 day |
| **4. Verification Layer** | Cross-doc comparison. | • Create `FieldComparator` config map.<br>• Rebuild `DocumentVerificationService` using new models. | 1 day |
| **5. UI Refactor** | Components & context. | • Build `DocumentProcessingContext`.<br>• Convert pages to hooks.<br>• Extract reusable `ResultCard`, `StatusBadge`, etc. | 1 – 1.5 days |
| **6. Cleanup & Removal** | Delete legacy code. | • Remove old monolith services & mocks.<br>• Run linter, tree-shake. | 0.5 day |
| **7. Documentation & CI** | Docs + quality gates. | • Update `ARCHITECTURE.md` and storybook docs.<br>• Add unit/integration tests in CI. | 0.5 day |

Parallelization: phases 2–4 independent of UI; team can work concurrently.

---

## 7. Expected Benefits

1. **Maintainability** – smaller files (<300 LOC), predictable folder layout.  
2. **Testability** – pure services and validators → straightforward Jest tests.  
3. **Scalability** – add new document types by registering extractors/validators, no core modifications.  
4. **Developer Onboarding** – clearer boundaries, up-to-date docs.  
5. **Performance** – tree-shaken bundles, removal of dead code reduces size.  
6. **Reliability** – centralized error handling & retries lower runtime failures.

---

## 8. Definition of Done

- All monolithic files removed or ≤300 LOC.
- All API calls routed through `ClaudeApiService`.
- ≥80 % unit-test coverage for services/validators.
- CI pipeline green; lint, build, tests pass.
- `ARCHITECTURE.md` updated; `REFACTORING_PLAN.md` merged to `main`.
