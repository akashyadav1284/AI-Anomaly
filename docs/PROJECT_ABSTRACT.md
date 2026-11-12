# Project Abstract

**Project Title:** AI-Based IoT Sensor Anomaly Detection Using Machine Learning and Real-Time Telemetry Analytics  
**Product Name:** IoT Anomaly Guard  
**Candidate Names & Registration Numbers:** [STUDENT_NAME_1] ([REGISTRATION_NO_1]), [STUDENT_NAME_2] ([REGISTRATION_NO_2])  
**Supervisor / Guide:** [SUPERVISOR_NAME], [DESIGNATION]  
**Department & Institution:** [DEPARTMENT_NAME], [UNIVERSITY_OR_COLLEGE_NAME]  
**Academic Session:** [ACADEMIC_YEAR_SESSION, e.g., 2025–2026]  

---

## Abstract

Internet of Things (IoT) sensors deployed across smart factories, power generation plants, water treatment facilities, and environmental stations continuously generate high-velocity multivariate telemetry. Traditional monitoring approaches overwhelmingly depend on static thresholds and human vigilance. In complex physical systems, however, anomalies frequently manifest as subtle multivariate correlations, temporal drift, or sensor degradation long before physical thresholds are breached. Furthermore, threshold rules fail under fluctuating operational regimes, triggering crippling false alarm rates that lead to alarm fatigue.

This project presents **IoT Anomaly Guard**, an end-to-end, software-based artificial intelligence system engineered for real-time multivariate IoT sensor telemetry ingestion, unsupervised and semi-supervised anomaly detection, calibrated confidence scoring, automated data quality auditing, and forensic explainability. Developed strictly as a software-only simulation and analytics platform without physical hardware dependencies, the system addresses the fundamental challenges of edge and cloud telemetry monitoring:

1. **Multivariate Sensor Modeling:** The platform implements a modular Python machine learning engine supporting six distinct algorithms:
   - **Isolation Forest (iForest):** Recursive space partitioning for high-dimensional outlier detection.
   - **One-Class Support Vector Machines (OC-SVM):** Radial Basis Function (RBF) non-linear boundary estimation.
   - **Local Outlier Factor (LOF):** Novelty detection using local density deviations.
   - **Statistical Dynamic Z-Score:** Baseline standard deviation distance scoring with optional causal rolling window.
   - **Supervised Random Forest Classifier:** Ensemble decision trees utilized when historical failure labels are available.
   - **PyTorch Deep Autoencoder:** Symmetric neural reconstruction error quantification with LeakyReLU activations and batch normalization.

2. **Automated Data Quality & Leakage Auditing:** A built-in validation engine inspects raw telemetry partitions, checks timestamp monotonicity, identifies stuck sensor channels and null values, generates quality diagnostic matrices, and enforces strict chronological train/validation/test partitions (70%/15%/15%) to prevent future-data leakage.

3. **High-Performance Asynchronous Backend:** Built using Python 3.11+ and FastAPI, the backend provides asynchronous REST routing under `/api/v1/` and full-duplex WebSockets (`/api/v1/simulator/ws/telemetry`). Telemetry and detection records are persisted in MongoDB Atlas across indexed collections (`sensor_readings`, `anomalies`, `models`, `datasets`, `experiments`, `audit_logs`).

4. **Forensic Operations Dashboard:** Built with React 18, TypeScript, Tailwind CSS, and Recharts across ten functional modules, the interface features live waveform plotting, interactive sliders for on-the-fly model inference, model registry lifecycle controls, an incident triage register with full audit tracking, and a production observability center.

Empirical evaluation reveals that decision threshold calibration is critical in streaming environments: under a fixed uncalibrated unit threshold, Isolation Forest achieves an F1-score of 0.0480 due to severe threshold misalignment, whereas preliminary reference targets under dynamic validation quantile calibration demonstrate that tree-based space partitioning (Isolation Forest) and deep reconstruction (Autoencoder) achieve high detection efficacy with low latency (sub-4 ms). The entire platform is deployed into production across Vercel, Render, and MongoDB Atlas with zero client-side credential exposure.

**Keywords:** Internet of Things (IoT), Anomaly Detection, Machine Learning, Isolation Forest, FastAPI, WebSockets, Real-Time Telemetry, Data Quality Auditing, MongoDB Atlas.
