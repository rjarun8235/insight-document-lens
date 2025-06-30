# Cleanup Plan – Legacy File Removal (Phase 3)

After completing Phases 1 & 2 of the refactor, the project now contains **two parallel implementations**:  
the new, modular architecture (`/services`, `/contexts`, `/components/domain`, `/pages/DocumentProcessing.tsx`) **and** the legacy monolithic code.  
To eliminate confusion, shorten build times, and reduce maintenance cost, we must delete the redundant files listed below.

---

## 1. Removal Criteria

| Criterion | Description |
|-----------|-------------|
| Replaced | Functionality is fully re-implemented in the new service / context / component layer. |
| Duplicated | Logic duplicated across multiple legacy helpers; new single-source module exists. |
| Obsolete | Experimental, mock, or debug code that is no longer used. |
| Superseded UI | Old UI components/pages replaced by slimmer domain components. |

Only files that **meet at least one criterion** and have **zero imports in the new code-paths** are scheduled for deletion.

---

## 2. Redundant Files to Delete

| Legacy File | Lines | Criterion | New Replacement |
|-------------|------:|-----------|-----------------|
| **src/lib/LLMExtractionService.ts** | 1 789 | Replaced | `src/lib/services/document-extractor.service.ts` + `claude-api.service.ts` |
| **src/lib/document-verification-service.ts** | 285 | Replaced | `src/lib/services/document-verification.service.ts` |
| **src/lib/document-field-comparator.ts** | 744 | Duplicated | Comparator logic merged into `document-verification.service.ts` |
| **src/lib/document-relationship-validator.ts** | 403 | Duplicated | All cross-doc validation handled by new verification service |
| **src/lib/document-validation.ts** | 394 | Duplicated | Rules migrated to `services/validation` (coming Phase 4) |
| **src/lib/logistics-validation.ts** | 384 | Duplicated | Superseded by upcoming `ValidationRegistry` |
| **src/lib/enhanced-field-extraction.ts** | 513 | Replaced | Incorporated into extractor service & prompt builder |
| **src/lib/hsn-code-validator.ts** | 457 | Duplicated | Will become individual validator module under `services/validation/validators` |
| **src/lib/field-confidence.ts** | 145 | Duplicated | Confidence scoring now in extractor service |
| **src/lib/extraction-logger.ts** | 191 | Obsolete | Superseded by centralized logger (TBD) or browser console |
| **src/lib/parsers.ts** | 675 | Obsolete | Generic parsers not referenced in new flow |
| **src/lib/report-exporter.ts** | 325 | Obsolete | Export logic to be re-implemented per context hook |
| **src/pages/DocumentProcessingDemo.tsx** | 412 | Superseded UI | Replaced by `src/pages/DocumentProcessing.tsx` |
| **src/components/DocumentProcessingUpload.tsx** | 171 | Superseded UI | Replaced by `components/domain/DocumentUpload.tsx` |
| **src/components/SmartDocumentUpload.tsx** | 352 | Superseded UI | Same replacement as above |
| **src/components/DocumentExtraction.tsx** | 416 | Superseded UI | Replaced by `ExtractionResults.tsx` |
| **src/components/ValidationResults.tsx** | 422 | Superseded UI | Incorporated into new results & report views |
| **src/components/DocumentComparisonResults.tsx** | 279 | Superseded UI | Comparison now inside VerificationReport |
| **src/components/DocumentVerificationReport.tsx** | 239 | Superseded UI | Replaced by domain `VerificationReport.tsx` |
| **src/components/PerformanceDashboard.tsx** | 618 | Obsolete | No longer required; metrics handled by context hooks |

*Count ≈ 7 ,000 legacy LOC scheduled for removal.*

---

## 3. Tasks & Order of Execution

1. **Ensure zero imports**  
   Run a tree-shake or `tsc --noEmit` after temporarily renaming each target file; if compilation passes, proceed.

2. **Delete files** (git `rm`) in small, reviewable commits:  
   a. Core monolithic services  
   b. Validation/comparator duplicates  
   c. Deprecated UI components & pages  
   d. Misc utilities

3. **Update tsconfig & Jest mocks**  
   – Remove path aliases if any reference the deleted modules.  
   – Delete obsolete test files.

4. **Run full test & build pipeline**  
   `npm run lint && npm run test && npm run build` – must succeed.

5. **Create Pull Request**  
   Title: “Phase 3 – Legacy Code Cleanup”  
   Reviewers verify no runtime paths reference removed files.

6. **Tag and document**  
   Update `ARCHITECTURE.md` & `REFACTORING_PLAN.md` to mark legacy removal complete.

---

## 4. Precautions

- **Incremental deletion**: remove in logical groups to simplify rollback.  
- **Feature parity check**: QA the new flow (upload → extract → verify) after each group.  
- **Git history**: Deleting files doesn’t erase history – use `git log -- src/lib/LLMExtractionService.ts` to view old implementation if needed.  

Once this cleanup is merged, the codebase will reflect **one canonical implementation**, greatly reducing cognitive load and improving future velocity.
