# DocLens AI – Executive Insights Guide  
*Getting actionable intelligence from your logistics documents*

---

## 1 . What Are “Executive Insights”?

After documents are **extracted** DocLens runs a **Verification** pass that:

1. Cross-matches critical fields (invoice, AWB/HAWB, parties, weights, values) across all related documents.  
2. Calculates **consistency & risk scores**.  
3. Generates a concise **Expert Summary**, **Business Insights** and **Actionable Recommendations**.

These outputs help field executives decide **“Can this shipment move?”** and **“What must be fixed first?”**

---

## 2 . How to Generate Insights

| Step | UI action (DocumentProcessing page) | Owner |
|------|-------------------------------------|-------|
| 1 | **Upload** documents › assign types | Field exec |
| 2 | Click **Extract Documents** | System extracts & scores |
| 3 | When green ✅ appears beside at least **two** documents, click **Verify Documents** | DocLens runs cross-check |
| 4 | Switch to **“Verification Report”** tab | View insights |

> Tip: Verification button is disabled until ≥2 documents extracted successfully.

---

## 3 . What You Will See

### 3.1 Shipment Summary  
```
Shipment ID       : 098 80828764
Docs Processed    : 3  (Invoice, HAWB, Bill of Entry)
Consistency Score : 78.5 %
Risk Assessment   : MEDIUM
```

### 3.2 Expert Summary  *(AI-generated 2–3 sentences)*
> “All three documents reference the same commercial invoice **CD970077514** and
> waybill **448765 / 098 80828764**. Values and parties are consistent, but the
> Bill of Entry lists an outdated consignee address that may trigger a customs query.”

### 3.3 Business Insights
| Severity | Category | Insight |
|----------|----------|---------|
| ⚠️ **Critical** | Compliance | `Consignee.address` mismatch between HAWB and Bill of Entry. |
| ⚠️ **Warning**  | Financial | Total invoice value differs by **USD 137** between Invoice & Bill of Entry. |
| ℹ️ **Info**     | Operational | File names are generic; rename to include doc-type to speed pre-clearance. |

### 3.4 Recommendations
| Priority | Action | Reasoning |
|----------|--------|-----------|
| 🔴 **High** | Align consignee address across all docs and re-issue Bill of Entry. | Customs desk rejects address mismatches. |
| 🟡 **Medium** | Correct total value in Bill of Entry to **USD 18 640.00**. | Avoid duty recalculation delays. |
| 🟢 **Low** | Adopt naming convention `<DocType>_<InvoiceNo>.pdf`. | Improves auto-classification accuracy. |

### 3.5 Field-Match Accuracy Table

| Field | Invoice | HAWB | Bill of Entry | Match |
|-------|---------|------|---------------|-------|
| Invoice No. | **CD970077514** | **CD970077514** | **CD970077514** | ✅ 100 % |
| HAWB | – | **448765** | **448765** | ✅ 100 % |
| AWB | **098 80828764** | **098 80828764** | **098 80828764** | ✅ 100 % |
| Consignee.Name | **SKI MANUFACTURING** | **SKI MANUFACTURING** | **SKI Manufacturing** | ⚠️ 97 % (case variation) |
| Consignee.Address | *N/A* | **No 5, Elm Rd…** | **3 Market St…** | ❌ 0 % |
| Total Value | **USD 18 640.00** | n/a | **USD 18 503.00** | ❌ –137 |

Colour codes  
• ✅ exact match • ⚠️ near match (>90 %) • ❌ mismatch

### 3.6 Confidence vs. Accuracy

* **Extraction Confidence** (per-document) – how sure the model is about each field.  
* **Match Accuracy**          (cross-doc) – how well fields agree between documents.

DocLens combines both to produce the **Consistency Score**.

---

## 4 . Acting on the Insights

| Role | Immediate Action |
|------|------------------|
| **Documentation team** | Correct consignee address & value, re-upload corrected Bill of Entry. |
| **Customs liaison** | Pre-alert broker of potential value discrepancy; provide corrected docs. |
| **Operations lead** | Use high confidence on weights & parties to proceed with booking while docs updated. |

---

## 5 . Frequently Asked Questions

**Q:** *Can I download the full verification JSON?*  
**A:** Click **Export › JSON** in Verification tab.

**Q:** *How is risk level calculated?*  
**A:** Weighted by number & severity of mismatches (critical × 3, important × 2, minor × 1) versus total checks.

**Q:** *What if a document shows low extraction confidence?*  
**A:** Re-scan or provide a clearer copy; confidence < 0.5 will lower overall consistency.

---

## 6 . Best Practices for Field Executives

1. **Upload complete document sets** (Invoice + HAWB + Bill of Entry + Packing List) – more docs → better cross-checks.  
2. **Assign correct document type** before extraction if auto-detection fails.  
3. **Review critical mismatches immediately**; medium/low issues can be queued.  
4. **Use recommendations** to guide quick fixes and reduce clearance time.

---

> **DocLens AI turns raw document data into actionable intelligence – enabling faster, more accurate field decisions.**  
> Have questions? Ping the product team on Slack **#doclens-support**.
