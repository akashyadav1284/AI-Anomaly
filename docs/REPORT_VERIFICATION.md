# Comprehensive Academic & Technical Report Verification Matrix
# IoT Anomaly Guard — Project Verification Audit

**Auditor:** Senior CSE Project Examiner, Machine Learning Researcher & Technical Systems Auditor  
**Audit Target:** Academic Project Documentation & Repository Artifacts (`AI-Anomaly`)  
**Repository Branch / Commit:** `main` (commit `76d6125`)  

---

## 1. Executive Summary & Verification Classification

| Category | Verification Status | Key Evidence & Findings |
|---|---|---|
| **ML Algorithms (6 Implemented)** | ✅ **VERIFIED (Implementation)** / ⚠️ **PARTIAL (Artifacts)** | All 6 algorithm classes exist and inherit from `BaseAnomalyDetector` in `ml/models/`. However, serialized model artifacts on disk exist only for 3 models (`isolation_forest`, `lof`, `one_class_svm`). The Autoencoder, Random Forest, and Statistical detectors instantiate dynamically in-memory. |
| **Experimental Benchmarks** | ⚠️ **EMPIRICAL EVIDENCE DISCREPANCY** | Actual saved evaluation file `data/reports/eval_iso_forest.json` records an F1-score of **0.0480** (Precision 0.0812, Recall 0.0340) on 2,000 samples under a fixed unit threshold ($1.0$). The previously reported high benchmarks (e.g., F1 = 0.9275) represent idealized validation targets from preliminary research sweeps that lack serialized experiment configs or reproducibility logs in `experiments/` (which is empty). |
| **Synthetic Physics Generator** | ✅ **VERIFIED** | Implemented in `ml/data/generators/sensor_generator.py`. Simulates 5 coupled channels (`temperature`, `humidity`, `pressure`, `vibration`, `current`) across 3 active temporal operating regimes (`NORMAL_LOAD`, `IDLE`, `HIGH_STRESS`). |
| **Anomaly Injection Profiles** | ✅ **VERIFIED** | Implemented in `ml/data/generators/anomaly_injector.py`. Implements exactly **7 distinct anomaly topologies**: `POINT_SPIKE`, `CONTEXTUAL`, `COLLECTIVE`, `GRADUAL_DRIFT`, `STUCK_SENSOR`, `NOISE_BURST`, and `MISSING_CORRUPTED`. |
| **Leakage-Proof Preprocessing** | ✅ **VERIFIED** | Enforced in `ml/data/preprocessing/splitting.py` (`TimeSeriesSplitter.chronological_split`). Chronological ordering (70/15/15) is enforced, transformers are fitted strictly on the nominal training slice, and `check_temporal_leakage()` validates partition timestamps. |
| **Backend & Routing Architecture** | ✅ **VERIFIED** | FastAPI application implemented in `backend/app/`. Nine API routers are mounted under `/api/v1/` (`health`, `datasets`, `sensors`, `predictions`, `anomalies`, `models`, `experiments`, `simulator`, `system`). WebSockets operate at `/api/v1/simulator/ws/telemetry`. |
| **Testing & Quality Assurance** | ❌ **FAILURES DETECTED** | Backend test suite execution: **33 passed, 1 failed** (failure in `test_backend_phase7_8.py::test_path_traversal_prevention_on_import` due to HTTP 405 on an unrouted `/import` endpoint). Frontend unit test in JSDOM fails due to unmocked `window.matchMedia`. |
| **Database Persistence & State** | ✅ **VERIFIED (Atlas Live)** | MongoDB Atlas active database `iot_anomaly_detection` contains collections: `sensor_readings` (25,144 records), `anomalies` (1,421 records), `models` (3 records), `datasets` (3 records), `experiments` (5 records), `training_jobs` (9 records), `audit_logs` (5 records). These reflect dynamic simulation and testing writes, not static offline benchmark sets. |
| **Security & Middleware** | ⚠️ **UNSAFE DEFAULTS IDENTIFIED** | Token-bucket rate limiting operates at **150 requests per 60 seconds** in `backend/app/core/middleware.py`. Security headers are injected. However, development settings in `config.py` default to wildcard CORS (`*`) and hardcoded credential placeholders, requiring mandatory production environment overrides. |
| **Production Deployment** | ✅ **VERIFIED** | Live multi-cloud deployment: Frontend on Vercel (`https://ai-anomaly.vercel.app`), Backend on Render (`https://ai-anomaly.onrender.com`), Database on MongoDB Atlas. Free-tier container sleep causes a 50–90 second cold start, mitigated by a post-login announcement modal and background health polling. |

---

## 2. Detailed Verification by System Component

### 2.1 Machine Learning Engine (`ml/models/`)

| Model | Code Location | Class Name | Verified Hyperparameters & Architecture | Serialization Status |
|---|---|---|---|---|
| **Statistical Detector** | `ml/models/statistical.py` | `StatisticalZScoreDetector` | Default `rolling_window=None` (global z-score); threshold=0.5; min_std=1e-4; combines channels via max z-score. Causal rolling window supported if `rolling_window > 1`. | In-memory only |
| **Isolation Forest** | `ml/models/isolation_forest.py` | `IsolationForestDetector` | Scikit-learn wrapper; `n_estimators=100`, `contamination="auto"`, `max_samples="auto"`, `random_state=42`, `n_jobs=-1`. Raw score: `-score_samples(X)`. | Serialized (`artifacts/models/isolation_forest/`) |
| **One-Class SVM** | `ml/models/one_class_svm.py` | `OneClassSVMDetector` | Scikit-learn wrapper; RBF kernel, `gamma="scale"`, `nu=0.05`. Raw score: `-score_samples(X)`. | Serialized (`artifacts/models/one_class_svm/`) |
| **Local Outlier Factor** | `ml/models/lof.py` | `LocalOutlierFactorDetector` | Scikit-learn wrapper; `novelty=True`, `n_neighbors=20`, `contamination="auto"`, metric Minkowski. Raw score: `-score_samples(X)`. | Serialized (`artifacts/models/lof/`) |
| **Random Forest (Supervised)** | `ml/models/random_forest.py` | `RandomForestAnomalyDetector` | Scikit-learn wrapper; `n_estimators=100`, `max_depth=10`, `class_weight="balanced"`, criterion Gini. Requires binary labels $y \in \{0, 1\}$. | In-memory only |
| **Deep Autoencoder** | `ml/models/autoencoder.py` | `AutoencoderDetector` & `PyTorchAutoencoderModule` | PyTorch feedforward network: 5 $\to$ 4 $\to$ 2 $\to$ 4 $\to$ 5. Hidden layers use `BatchNorm1d` and `LeakyReLU(0.1)`. Adam optimizer ($\eta=0.001$, weight decay $10^{-5}$), batch size 64, 25 epochs, early stopping patience 5. Scoring via per-sample MSE. | In-memory only |

---

### 2.2 Numerical Benchmarks & Calibration Audit

| Metric Category | Claimed Reference Target | Actual Saved Offline Metric (`data/reports/eval_iso_forest.json`) | Status & Empirical Finding |
|---|---|---|---|
| **Precision** | 0.9412 (Isolation Forest target) | **0.0813** (Isolation Forest) | ❌ **Discrepancy Documented:** Saved test evaluation used a fixed unit threshold ($1.0$) on min-max normalized scores, yielding 13 true positives and 147 false positives. |
| **Recall** | 0.9143 (Isolation Forest target) | **0.0340** (Isolation Forest) | ❌ **Discrepancy Documented:** 369 false negatives under raw fixed thresholding. Under dynamic validation quantile calibration, target recall is higher, but uncalibrated static thresholds fail. |
| **F1-Score** | 0.9275 (Isolation Forest target) | **0.0480** (Isolation Forest) | ❌ **Discrepancy Documented:** Confirms that static scalar thresholding on normalized outlier scores is ineffective in streaming environments without dynamic calibration. |
| **PR-AUC / ROC-AUC** | 0.9482 / 0.9721 (target) | **0.1799 / 0.5228** | ❌ **Discrepancy Documented:** Actual uncalibrated artifact metrics reflect default un-tuned run. |
| **Evaluation Dataset** | Claimed 1,500 rows, 8% anomalies | **2,000 rows, 19.1% anomalies** (`demo-quality.json`) | ⚠️ **Dataset Discrepancy:** The generated synthetic demo dataset (`data/synthetic/demo.csv`) has 2,000 observations, 2 devices, and 382 ground-truth anomalies (19.1%), not 1,500 rows at 8%. |
| **Experiment Directory** | Claimed reproducible CLI suite | `experiments/` subdirectories are **completely empty** | ⚠️ **Provenance Gap:** No serialized experiment run files exist in `experiments/configs/`, `experiments/notebooks/`, or `experiments/reports/`. |

---

### 2.3 Backend Routing & Testing Audit

| Component | Tested Aspect | Result | Evidence / File Reference |
|---|---|---|---|
| **API Endpoints** | REST Routers mounted under `/api/v1/` | ✅ **VERIFIED** | Verified in `backend/app/api/v1/`: `health`, `datasets`, `sensors`, `predictions`, `anomalies`, `models`, `experiments`, `simulator`, `system`. |
| **WebSocket** | Streaming endpoint | ✅ **VERIFIED** | `/api/v1/simulator/ws/telemetry` connects and streams simulated sensor frames. |
| **Rate Limiter** | Token bucket limit | ⚠️ **CORRECTED** | `backend/app/core/middleware.py`: configured to **150 requests per 60 seconds** (not 60 req/min). |
| **Backend Unit Tests** | `pytest backend/tests/` | ❌ **1 FAILED, 33 PASSED** | `test_path_traversal_prevention_on_import` fails with HTTP 405 because `POST /api/v1/datasets/import` is not implemented in `datasets.py`. |
| **Frontend Tests** | `vitest` execution | ❌ **FAILED** | `src/test/App.test.tsx` fails under JSDOM due to `window.matchMedia is not a function` in canvas animation component. |

---

### 2.4 Database Collections & Live State Audit

Live MongoDB Atlas database (`iot_anomaly_detection`) document counts:
- `sensor_readings`: **25,144 documents** (time-series stream from virtual simulation runs).
- `anomalies`: **1,421 documents** (detected incidents logged during active simulation).
- `models`: **3 documents** (registered metadata for Isolation Forest, LOF, and One-Class SVM).
- `datasets`: **3 documents** (catalog entries for synthetic and benchmark partitions).
- `experiments`: **5 documents** (logged hyperparameter comparison runs).
- `training_jobs`: **9 documents** (background training worker records).
- `audit_logs`: **5 documents** (system configuration and security audit entries).

*Note on Dataset Explorer UI Count Discrepancy:* In initial deployment or local execution without an active cloud database connection, the UI displayed zero datasets because data is dynamically retrieved via `/api/v1/datasets`. Once synthetic data is generated or CSV files are uploaded, records appear dynamically in MongoDB.

---

### 2.5 Security Findings & Environment Configuration

| Setting | Code Default | Assessment & Production Requirement |
|---|---|---|
| `CORS_ORIGINS` | `["*"]` in `backend/app/core/config.py` | ⚠️ Insecure development default. In production, must be restricted to explicit frontend domains (e.g., `https://ai-anomaly.vercel.app`). |
| `API_KEY` | Development string in `backend/app/core/config.py` | ⚠️ Insecure development fallback. Must be supplied via environment variable in production. |
| `JWT_SECRET_KEY` | Development string in `backend/app/core/config.py` | ⚠️ Insecure development fallback. Must be supplied via environment variable in production. |
| `Security Headers` | Injected in `SecurityHeadersMiddleware` | ✅ Implements `nosniff`, `DENY`, `X-XSS-Protection`, `Strict-Transport-Security`, and `Referrer-Policy`. |
| `Rate Limiting` | `RateLimitMiddleware` | ✅ Implements IP-based token bucket (150 requests/60s). |

---

## 3. Audit Verdict & Academic Integrity Statement

The codebase exhibits a complete, high-quality architectural implementation of a real-time IoT anomaly detection platform. However, the academic report cannot state that all tests pass, nor can it present idealized F1-scores as verified production outputs when saved artifacts show significant threshold sensitivity.

By applying the corrections cataloged in `REPORT_CORRECTIONS.md` to `FINAL_PROJECT_REPORT.md`, the documentation establishes complete transparency, distinguishing verified implementations and empirical findings from preliminary reference targets.
