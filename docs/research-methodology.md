# Research Methodology & Evaluation Strategy

## 1. Context & Research Scope
The **AI-Based IoT Sensor Anomaly Detection** project approaches anomaly detection from a software-engineering and machine-learning perspective, focusing on multi-sensor time-series telemetry.

To prevent bias and fabricated performance metrics, this document outlines the **formal methodology, baseline comparison frameworks, and evaluation metrics** scheduled for execution across Phases 2, 3, 5, 8, and 9.

---

## 2. Experimental Data Strategy

### 2.1 Synthetic Telemetry Generation (Controlled Experiments)
Synthetic data generation enables granular control over anomaly properties (amplitude, duration, noise ratio) to evaluate model sensitivity:
- **Baseline Signals:** Sinusoidal waveforms, autoregressive AR(1) drift models, and diurnal cycles simulating temperature, vibration, pressure, and current.
- **Anomaly Taxonomies:**
  1. *Point Anomalies:* Sudden high-amplitude spikes or single-sample dropouts.
  2. *Contextual Anomalies:* Normal values occurring at abnormal times (e.g., peak motor temperature during scheduled idle cycles).
  3. *Collective / Trend Anomalies:* Slow sensor calibration drift, variance dampening, or sustained elevated oscillations.

### 2.2 Public Benchmark Datasets
- **NASA Turbofan Engine Degradation (C-MAPSS):** Multi-channel sensor run-to-failure records for evaluating predictive degradation.
- **Skoltech Anomaly Benchmark (SKAB):** Real-world benchmark dataset designed for evaluating algorithms for anomaly detection in industrial automation systems.

---

## 3. Planned Model Progression

The research follows an incremental model evaluation path:

| Phase | Model Family | Objective | Key Baselines |
|---|---|---|---|
| Phase 3 | Statistical & Classical | Fast, explainable baselines | Z-Score, Moving Average Bollinger Bands, Isolation Forest, One-Class SVM |
| Phase 5 | Deep Sequential Models | Non-linear spatio-temporal dependencies | Autoencoders (Reconstruction Error), LSTM Autoencoders, Temporal Convolutional Networks (TCN) |
| Phase 8 | Model Explainability | Root-cause analysis & feature attribution | SHAP (SHapley Additive exPlanations), Reconstruction error attribution |

---

## 4. Evaluation Metrics & Benchmark Protocols

To avoid misleading accuracy reports on highly imbalanced anomaly datasets (where anomalies often comprise < 2% of records), evaluations will utilize:

1. **Precision, Recall, and F1-Score:** Standard classification metrics computed at dynamic decision thresholds.
2. **Point-Adjusted F1 Score:** Protocol accounting for multi-point contiguous anomaly events.
3. **Area Under the Precision-Recall Curve (PR-AUC):** Robust evaluation metric for severe class imbalance.
4. **Latency & Throughput Benchmarks:**
   - Single-sample inference latency ($\mu \text{s} / \text{ms}$).
   - Batch window processing throughput (samples / sec).
   - Memory footprint of loaded model instances.

---

## 5. Experiment Tracking & Artifact Integrity
- Hyperparameters and sensor seed configurations must be tracked in `experiments/configs/`.
- Quantitative outputs must be saved to `experiments/reports/` in standard structured formats (CSV / JSON) alongside visualization plots.
- Under no circumstances will synthetic or placeholder prediction numbers be claimed as verified model benchmarks.
