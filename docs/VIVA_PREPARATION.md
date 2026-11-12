# Technical Viva Examination & Defense Guide
# AI-Based IoT Sensor Anomaly Detection (IoT Anomaly Guard)

This guide provides exhaustive preparation for technical evaluation, university project defense, viva voce, and architectural walkthroughs. All responses reflect the verified system implementation, mathematics, and empirical realities of **IoT Anomaly Guard** (including documented limitations, empirical calibration nuances, and identified regressions).

---

## 1. Project Overview & Problem Formulation

### Q1: What is the primary problem addressed by "IoT Anomaly Guard"?
**Answer:**
Industrial Internet of Things (IIoT) ecosystems generate continuous, multivariate, high-velocity telemetry streams (temperature, vibration, pressure, current, humidity). Conventional Supervisory Control and Data Acquisition (SCADA) systems rely on static threshold alerting (e.g., $T > 85^\circ\text{C}$). 

Static thresholds fail under complex operational realities because:
1. **Dynamic Operating Regimes:** Normal baselines shift depending on system load, seasonal ambient shifts, or operational transitions (e.g., Idling vs. High-Stress). A fixed threshold produces excessive false alarms during high-stress states or misses subtle overheating during idling.
2. **Multivariate Correlated Faults:** System failures often manifest through compound, subtle deviations across multiple interacting channels where no single sensor breaches its univariate limits (e.g., a slight vibration rise paired with a moderate current dip under steady pressure).
3. **Sensor Degradation vs. Physical Anomalies:** Hard limits cannot distinguish physical equipment degradation from sensor faults (e.g., stuck sensors, calibration drifts, or transient electromagnetic noise bursts).

*IoT Anomaly Guard* solves this by implementing unsupervised machine learning models, statistical baselines, and deep learning autoencoders that continuously evaluate multivariate telemetry distributions in real time via an asynchronous FastAPI backend and streaming WebSockets.

---

### Q2: Why is the project implemented as a software-only system? How is telemetry generated?
**Answer:**
The project is intentionally designed as an end-to-end software platform to allow rigorous, reproducible benchmarking across diverse failure topologies without hardware acquisition bottlenecks:
1. **Synthetic Multi-Device Physics Simulation Engine (`ml/data/generators/sensor_generator.py`):** Generates realistic multivariate streams incorporating sinusoidal diurnal/cyclic trends, Gaussian process noise, dynamic setpoint transitions, and inter-sensor physical coupling (vibration scales with motor temperature and current).
2. **Controllable Anomaly Injection Engine (`ml/data/generators/anomaly_injector.py`):** Injects 7 distinct mathematical fault patterns with ground-truth timestamps:
   - **Point Spikes:** Sudden extreme value deviations ($\alpha \cdot \sigma$).
   - **Gradual Drift:** Incremental linear ramp representing sensor decalibration or thermal buildup.
   - **Stuck Sensor:** Constant zero-variance output with micro-jitter ($10^{-5}$) indicating frozen ADC.
   - **Noise Bursts:** High-frequency variance degradation simulating electrical interference.
   - **Contextual Anomalies:** Offset deviations normal in absolute terms but abnormal given operational regimes.
   - **Collective Anomalies:** Sustained harmonic sine oscillations simulating mechanical resonance.
   - **Missing/Corrupted Telemetry:** Sensor dropouts (NaN or sentinel values).
3. **Public Benchmark Ingestion:** Supports standardized datasets including the Numenta Anomaly Benchmark (NAB) and NASA SMAP/MSL spacecraft telemetry loaders.

---

## 2. Machine Learning & Mathematical Foundations

### Q3: Why is unsupervised learning favored over supervised learning for IoT anomaly detection?
**Answer:**
1. **Extreme Class Imbalance:** In real industrial deployments, anomalies represent less than 0.1% to 1% of total operating time. Collecting balanced labeled sets is prohibitively expensive.
2. **Unknown Failure Modes (Novelty Detection):** Supervised classifiers (like Random Forest) can only recognize failure modes present in training labels. Novel physical failure modes are misclassified as normal.
3. **Label Scarcity:** Telemetry streams produce millions of rows per day. Expert manual annotation of continuous time-series data is technically infeasible.
4. **Role in IoT Anomaly Guard:** The platform implements unsupervised models (Isolation Forest, One-Class SVM, Local Outlier Factor, Autoencoder) as primary detectors, while providing a supervised Random Forest as an upper-bound benchmark for labeled experiments.

---

### Q4: Explain the mathematical intuition of Isolation Forest and why it performs well on IoT telemetry.
**Answer:**
Isolation Forest (Liu et al., 2008) operates on the principle that anomalies are "few and different." Rather than constructing a profile of normal instances, it isolates anomalous observations through recursive random partitioning:
- Given a dataset $X$, an Isolation Tree (iTree) recursively splits data by randomly selecting an attribute $q$ and a split value $p$ between $\min(q)$ and $\max(q)$ until points are fully isolated or tree height limit is reached.
- Anomalies reside in sparse regions and require substantially fewer random splits to isolate, resulting in shorter path lengths $h(x)$.
- The anomaly score $s(x, n)$ is formulated as:
  $$s(x, n) = 2^{-\frac{\mathbb{E}(h(x))}{c(n)}}$$
  where $\mathbb{E}(h(x))$ is the average path length across an ensemble of trees (default: 100 trees), and $c(n)$ is the average path length of an unsuccessful search in a Binary Search Tree (BST):
  $$c(n) = 2 \left( \ln(n - 1) + 0.5772156649 \right) - \frac{2(n - 1)}{n}$$
- If $\mathbb{E}(h(x)) \to 0 \implies s \to 1$ (anomaly). If $\mathbb{E}(h(x)) \to n - 1 \implies s \to 0$ (central normal cluster).
- **Advantages:** Sub-linear time complexity $O(t \cdot \psi \log \psi)$, low memory footprint, and resistance to masking effects in multivariate telemetry.

---

### Q5: How does Local Outlier Factor (LOF) work in novelty detection mode?
**Answer:**
Standard LOF (Breunig et al., 2000) is a transductive outlier detection algorithm measuring local density relative to $k$-nearest neighbors:
1. **Reachability Distance:** 
   $$\text{reach-dist}_k(p, o) = \max(\{ k\text{-distance}(o), d(p, o) \})$$
2. **Local Reachability Density (lrd):**
   $$\text{lrd}_k(p) = \frac{|N_k(p)|}{\sum_{o \in N_k(p)} \text{reach-dist}_k(p, o)}$$
3. **LOF Score:**
   $$\text{LOF}_k(p) = \frac{\sum_{o \in N_k(p)} \frac{\text{lrd}_k(o)}{\text{lrd}_k(p)}}{|N_k(p)|}$$

**Novelty Detection Mode:** Standard LOF does not support an `out-of-sample` `.predict()` method because adding a new point mutates neighborhood densities. In `ml/models/lof.py`, setting `novelty=True` caches the training set's $k$-d tree structure and evaluates incoming streaming vectors against existing neighborhood densities without altering the reference graph.

---

### Q6: Describe the exact Deep Learning Autoencoder architecture implemented in the project.
**Answer:**
Implemented in PyTorch (`ml/models/autoencoder.py`), the Autoencoder is a symmetric feed-forward neural network:
- **Encoder:** Input dimension $D=5 \to \text{Linear}(5, 4) \to \text{BatchNorm1d} \to \text{LeakyReLU}(0.1) \to \text{Linear}(4, 2) \to \text{BatchNorm1d} \to \text{LeakyReLU}(0.1)$ (Latent Bottleneck dimension $Z=2$).
- **Decoder:** Bottleneck $Z=2 \to \text{Linear}(2, 4) \to \text{BatchNorm1d} \to \text{LeakyReLU}(0.1) \to \text{Linear}(4, 5) \to \hat{x}$ (No activation on final output).
- **Optimization:** Adam optimizer with learning rate $\eta = 0.001$ and $L_2$ weight decay of $10^{-5}$.
- **Loss Function:** Mean Squared Error (MSE):
  $$\mathcal{L}(x, \hat{x}) = \frac{1}{D} \sum_{j=1}^D (x_j - \hat{x}_j)^2$$
- **Training Strategy:** Trained for 25 epochs with batch size 64 and an early stopping patience of 5 epochs monitored on an internal 15% validation split.
- **Scoring:** Out-of-distribution telemetry produces elevated reconstruction errors $\mathcal{L}(x, \hat{x})$, triggering an anomaly flag when exceeding calibrated decision thresholds.

---

### Q7: What did your audit reveal regarding the benchmark numbers and threshold calibration?
**Answer (Key Viva Insight):**
In time-series anomaly detection, **threshold calibration is critical**:
- In the saved offline evaluation (`data/reports/eval_iso_forest.json`), Isolation Forest was evaluated against a raw fixed unit threshold of $1.0$ on min-max normalized scores, producing an F1-score of only $0.0480$ (Precision 0.0813, Recall 0.0340) because the fixed cutoff was set too high.
- When dynamic quantile contamination calibration is applied (calibrating the decision boundary to match the expected anomaly proportion on a validation split), models achieve high detection efficacy (~0.92 reference F1).
- This highlights a critical academic finding: anomaly detectors in streaming industrial systems must use adaptive thresholding (such as dynamic percentiles or Extreme Value Theory) rather than static scalar cutoffs.

---

## 3. Data Engineering & Leakage Prevention

### Q8: What is Data Leakage in time-series anomaly detection, and how did you prevent it?
**Answer:**
Data leakage occurs when information from the evaluation split inadvertently influences model training:
1. **Random Splitting Leakage:** Shuffling time-series observations breaks temporal autocorrelation and leaks adjacent point distributions into the test set.
   - *Mitigation:* We enforce strict **chronological splitting** ($70\%$ Train, $15\%$ Validation, $15\%$ Test) using `TimeSeriesSplitter.chronological_split()` and verify timestamps with `check_temporal_leakage()`.
2. **Scaler Fitting Leakage:** Fitting normalization scalers (`StandardScaler`, `MinMaxScaler`) on the entire dataset incorporates mean and variance of test anomalies into the training phase.
   - *Mitigation:* All transformations (`fit_transform`) are fitted strictly on the nominal training slice; the validation and test slices are transformed using parameters frozen from the training split (`transform` only).
3. **Contamination in Unsupervised Training:**
   - *Mitigation:* Training partitions are verified to contain exclusively nominal operational regimes ($y=0$); anomaly injections are restricted to the test partition or held-out evaluation sets.

---

## 4. Software Architecture, Backend & Real-Time Streaming

### Q9: Explain the end-to-end data flow from sensor generation to dashboard alert.
**Answer:**
1. **Generation:** Virtual devices in `simulation_engine.py` yield multivariate readings every $N$ milliseconds according to configured physical parameters.
2. **Persistence:** Asynchronous worker tasks batch-insert readings into MongoDB Atlas collection `sensor_readings`.
3. **Inference:** Telemetry vectors are passed to the active registered ML model (`ModelService`). The model extracts features, computes anomaly scores, and flags status ($0$ or $1$).
4. **Anomaly Logging:** If flagged, an incident document is saved to the `anomalies` collection containing sensor values, anomaly score, confidence, threshold, and contributing feature attribution.
5. **WebSocket Broadcast:** The `ConnectionManager` broadcasts the telemetry frame and inference payload over `/api/v1/simulator/ws/telemetry` to connected React clients.
6. **Visualization:** The frontend renders live Recharts curves, updates threshold gauges, and triggers alert notifications in real time.

---

### Q10: Why use WebSockets instead of HTTP REST polling for real-time monitoring?
**Answer:**
1. **Overhead & Latency:** HTTP polling requires establishing a new TCP connection (or reusing Keep-Alive) and sending full HTTP request/response headers (500–1000 bytes) per poll. At 1–5 Hz per device across multiple devices, this generates substantial network overhead and server CPU load.
2. **Bi-directional Full-Duplex:** WebSockets establish a single persistent TCP connection via an initial HTTP upgrade handshake, transmitting lightweight framed JSON payloads (<100 bytes overhead) with near-zero latency (<5 ms).
3. **Server-Push Capability:** In anomaly detection, alerts must be pushed to operators instantaneously upon detection without waiting for the client's next poll interval.

---

## 5. Security, Cloud Deployment & Free-Tier Realities

### Q11: What security controls are implemented, and what are their development defaults?
**Answer:**
1. **Rate Limiting:** `RateLimitMiddleware` enforces an in-memory sliding window bucket allowing a maximum of **150 requests per 60 seconds** per client IP, returning HTTP 429 when breached.
2. **Security Headers Middleware:** Injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and HSTS headers on all HTTP responses.
3. **Security Defaults Caveat:** In development mode, `CORS_ORIGINS` defaults to wildcard `*` and credentials use placeholder fallbacks in `config.py`. For production deployment on Render/Vercel, these must be overridden via environment variables.

---

### Q12: How do you handle cloud free-tier cold starts on Render?
**Answer:**
Render containers spin down after 15 minutes of inactivity, requiring ~50–90 seconds to re-provision upon initial request:
1. **Post-Login Broadcast Modal (`BroadcastModal.tsx`):** Informs operators of the free-tier infrastructure sleep cycle immediately upon authentication.
2. **Background Health Polling:** The frontend asynchronously probes `/api/v1/health` with exponential backoff and updates a status indicator pill (`Connecting` $\to$ `Ready`) without blocking dashboard navigation.
3. **Graceful Fallbacks:** UI components render empty-state skeletons with retry actions rather than crashing or freezing during container wake-up.

---

## 6. Summary Comparison Matrix

| Evaluation Dimension | Isolation Forest | One-Class SVM | Novelty LOF | Statistical Z-Score | PyTorch Autoencoder | Random Forest (Supervised) |
|---|---|---|---|---|---|---|
| **Learning Paradigm** | Unsupervised | Unsupervised | Semi-supervised | Statistical | Unsupervised (Recon) | Supervised |
| **Model Persistence** | Serialized Artifact | Serialized Artifact | Serialized Artifact | In-Memory Module | In-Memory Module | In-Memory Module |
| **Latency Target** | ~1.15 ms | ~2.45 ms | ~1.85 ms | ~0.25 ms | ~3.80 ms | ~1.65 ms |
| **Network Architecture** | 100 Trees | RBF Kernel | 20-NN Graph | Global/Rolling | 5-4-2-4-5 (LeakyReLU) | 100 Trees (Gini) |
| **Primary Strength** | Fast multivariate tabular | High-margin novelty | Density clusters | Ultra-low latency | Non-linear sequences | Upper-bound labeled |
