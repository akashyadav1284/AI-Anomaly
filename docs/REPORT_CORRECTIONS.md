# Formal Report Corrections & Audit Recommendations
# IoT Anomaly Guard — Academic Verification

This document catalogs every factual discrepancy, code divergence, unsupported metric, and structural flaw identified during the audit of `docs/FINAL_PROJECT_REPORT.md`, along with the exact corrective action taken to align the academic report with verified empirical evidence.

---

## 1. Summary of Identified Defects & Corrective Actions

### Defect 1: Misrepresentation of Benchmark Results & Threshold Sensitivity
- **Original Claim:** The report presented high benchmark metrics (Isolation Forest F1: 0.9275, Precision: 0.9412, Recall: 0.9143; Autoencoder Recall: 0.9714) as verified production outputs measured on a 1,500-sample, 8% anomaly dataset.
- **Actual Evidence:**
  - The actual saved evaluation artifact `data/reports/eval_iso_forest.json` records an F1-score of **0.0480** (Precision: 0.0812, Recall: 0.0340) on a 2,000-row synthetic dataset under a fixed unit threshold ($1.0$).
  - The actual demo dataset (`data/reports/demo-quality.json`) contains **2,000 observations and a 19.1% anomaly rate** (382 anomalies), not 1,500 rows at 8%.
  - The `experiments/` directory is completely empty; no serialized experiment configurations or raw execution logs exist for the claimed validation sweep.
  - Model weight files exist only for Isolation Forest, LOF, and One-Class SVM. Autoencoder, Random Forest, and Statistical detectors are instantiated dynamically in-memory without serialized disk checkpoints.
- **Correction Applied:**
  - Removed unsupported claims of verified production benchmarks.
  - Re-framed Table 11.1 as **Preliminary Reference Targets under Optimal Threshold Calibration**, explicitly distinguishing them from the saved uncalibrated evaluation artifact.
  - Added a dedicated subsection in Chapter 11 analyzing the **threshold calibration gap**: explaining why static thresholding on min-max normalized outlier scores yields poor recall (0.048) in streaming environments, and why dynamic quantile calibration is essential.
  - Clearly documented that 3 of the 6 models currently operate in dynamic memory rather than from serialized disk checkpoints.

---

### Defect 2: Inaccurate Test Suite Results
- **Original Claim:** The report stated "34 backend tests passing (100% success rate)" and implied all frontend tests pass.
- **Actual Evidence:**
  - Running pytest on `backend/tests/` yields **33 passed, 1 failed** (127s execution duration).
  - The failure occurs in `test_backend_phase7_8.py::test_path_traversal_prevention_on_import`, which receives `HTTP 405 Method Not Allowed` because `POST /api/v1/datasets/import` is not implemented in `backend/app/api/v1/datasets.py` (which only provides `/upload` and `/generate-synthetic`).
  - Running frontend `vitest` fails due to `TypeError: window.matchMedia is not a function` in JSDOM when rendering `SensorWaveBackground.tsx`.
- **Correction Applied:**
  - Updated Chapter 10 to document **33 passed and 1 failed backend test**.
  - Documented the exact HTTP 405 routing regression openly as an identified defect.
  - Documented the frontend JSDOM test failure in Chapter 10 and Chapter 13.

---

### Defect 3: Inaccurate Neural Network Architecture
- **Original Claim:** Chapter 6 claimed the Autoencoder uses standard `Linear -> ReLU -> Dropout(0.1)` with 50 epochs, Adam batch size 32, and latent dimension $Z=3$.
- **Actual Evidence:** `ml/models/autoencoder.py` implements:
  - Hidden layers: `Linear -> BatchNorm1d -> LeakyReLU(0.1)` (in both encoder and decoder).
  - Dynamic hidden dimensions: `[max(input_dim // 2, 4), max(input_dim // 4, 2)]`. For 5 input channels, this yields dimensions 5 $\to$ 4 $\to$ 2 $\to$ 4 $\to$ 5 (latent bottleneck $Z=2$, not 3).
  - Hyperparameters: `batch_size = 64`, `epochs = 25`, `early_stopping_patience = 5`, `weight_decay = 1e-5`, `learning_rate = 1e-3`.
- **Correction Applied:** Updated mathematical equations, layer diagrams, and hyperparameter tables in Chapter 6 to accurately describe `BatchNorm1d`, `LeakyReLU(0.1)`, 25 epochs, batch size 64, and the dynamic bottleneck dimension $Z=2$.

---

### Defect 4: Inaccurate Statistical Detector Configuration
- **Original Claim:** Chapter 6 claimed the statistical detector uses a mandatory sliding window of $W=50$ samples and a fixed threshold of $3.0\sigma$.
- **Actual Evidence:** `ml/models/statistical.py` defaults to `rolling_window=None` (global z-score across fitted baseline mean and standard deviation). Causal rolling window is supported only when `rolling_window > 1` is explicitly passed. The normalized threshold defaults to 0.5.
- **Correction Applied:** Corrected Chapter 6 to reflect the actual implementation: global baseline z-score by default, with optional causal rolling-window calculation, combining channels via maximum z-score.

---

### Defect 5: Missing Anomaly Injection Type in Taxonomy
- **Original Claim:** Claimed 6 anomaly injection types.
- **Actual Evidence:** `ml/data/generators/anomaly_injector.py` implements **7 types**: `POINT_SPIKE`, `CONTEXTUAL`, `COLLECTIVE`, `GRADUAL_DRIFT`, `STUCK_SENSOR`, `NOISE_BURST`, and `MISSING_CORRUPTED`.
- **Correction Applied:** Expanded Table 5.2 and Chapter 5 text to document all 7 implemented fault profiles, including `MISSING_CORRUPTED` (sensor dropout and telemetry corruption).

---

### Defect 6: Inappropriate Feature Attribution Citation
- **Original Claim:** Cited Lundberg & Lee (SHAP 2017) [9] as the basis for real-time feature attribution.
- **Actual Evidence:** `ml/explainability/feature_contributions.py` does not compute Shapley values. It computes **normalized absolute Z-score deviation** per channel relative to baseline mean/std, or per-channel **squared reconstruction error residuals** from the Autoencoder.
- **Correction Applied:** Removed the inappropriate SHAP citation and accurately formulated the actual empirical deviation attribution equations in Chapter 6.

---

### Defect 7: Incorrect API Paths and Rate Limiting Values
- **Original Claim:** Routers cited at `backend/app/routers/` and rate limiting reported as 60 requests/minute.
- **Actual Evidence:** Routers are located at `backend/app/api/v1/*.py`. Rate limiting in `backend/app/core/middleware.py` is configured to `max_requests = 150`, `window_seconds = 60` (**150 requests per 60 seconds**).
- **Correction Applied:** Corrected directory paths to `backend/app/api/v1/` and updated rate limiting parameters to 150 requests per 60 seconds throughout the report.

---

### Defect 8: Database Counts and UI Count Context
- **Original Claim:** Database counts presented without context, leading to confusion when the Dataset Explorer UI previously showed zero datasets.
- **Actual Evidence:** Atlas collections (`sensor_readings`: 25,144; `anomalies`: 1,421) reflect dynamic simulation and testing writes, not a static benchmark partition. The UI displays zero datasets when connected to an unseeded database until synthetic data is generated or uploaded.
- **Correction Applied:** Added explicit provenance notes in Chapter 4, Chapter 9, and Chapter 11 explaining that database counts reflect dynamic operational writes and clarifying the dynamic population lifecycle in the Dataset Explorer.

---

### Defect 9: Exposure of Insecure Defaults and Development Placeholders
- **Original Claim:** Appendix B and configuration sections listed `CORS_ORIGINS = *` and referenced development secret placeholders without security context.
- **Actual Evidence:** Development configuration in `config.py` uses permissive defaults for local prototyping.
- **Correction Applied:** Removed all references to specific credential values and hardcoded strings. Re-framed insecure defaults as security findings, with clear documentation of mandatory production environment variable overrides.

---

### Defect 10: Machine-Specific Paths and Formatting Inconsistencies
- **Original Claim:** Contained local absolute Windows file paths (e.g., `c:\Users\akash\...`) and uncaptioned figures/tables.
- **Actual Evidence:** Machine-specific paths reduce academic readability and portability.
- **Correction Applied:** Replaced all local paths with standard relative repository paths (`docs/`, `backend/`, `frontend/`, `ml/`). Added proper captions to all figures, tables, and Mermaid architecture diagrams.
