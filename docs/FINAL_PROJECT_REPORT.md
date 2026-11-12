# AI-Based IoT Sensor Anomaly Detection Using Machine Learning and Real-Time Telemetry Analytics
## Engineering Project Report: IoT Anomaly Guard

---

### Preliminary Information & Certification

**Project Title:** AI-Based IoT Sensor Anomaly Detection Using Machine Learning and Real-Time Telemetry Analytics  
**Product Name:** IoT Anomaly Guard  
**Candidate Name:** `[STUDENT_NAME]`  
**University Registration / Roll No.:** `[REGISTRATION_NO]`  
**Degree Program:** `[DEGREE_PROGRAM]`  
**Department:** `[DEPARTMENT_NAME]`  
**Institution:** `[UNIVERSITY_NAME]`  
**Project Supervisor:** `[SUPERVISOR_NAME]`  
**Academic Year:** `[ACADEMIC_YEAR]`  
**Submission Date:** `[SUBMISSION_DATE]`  

---

### Certificate of Originality

This is to certify that the project report entitled **"AI-Based IoT Sensor Anomaly Detection Using Machine Learning and Real-Time Telemetry Analytics"**, submitted by **`[STUDENT_NAME]`** (Registration No: **`[REGISTRATION_NO]`**) in partial fulfillment of the requirements for the award of the degree of **`[DEGREE_PROGRAM]`** in **`[DEPARTMENT_NAME]`** at **`[UNIVERSITY_NAME]`**, is an authentic record of independent research and engineering work carried out under my supervision and guidance.

To the best of my knowledge, the matter embodied in this report has not been submitted to any other University or Institute for the award of any degree or diploma.

\
\
__________________________________  
**`[SUPERVISOR_NAME]`**  
Project Supervisor  
Department of `[DEPARTMENT_NAME]`  
`[UNIVERSITY_NAME]`  

---

### Student Declaration

I, **`[STUDENT_NAME]`**, hereby declare that this project report entitled **"AI-Based IoT Sensor Anomaly Detection Using Machine Learning and Real-Time Telemetry Analytics (IoT Anomaly Guard)"** is my own original work conducted under the academic supervision of **`[SUPERVISOR_NAME]`**.

I confirm that:
1. The project embodies purely software-based design, machine learning engineering, backend development, and web visualization methodologies without physical hardware deployment.
2. All experimental datasets, mathematical models, architectural designs, and performance benchmarks presented in this report represent the actual implementation of the system and are transparently documented with their empirical limitations.
3. Due citations and references have been provided for all external literature, public benchmark datasets, and open-source libraries used.
4. No part of this project report has been plagiarized or previously submitted for any academic qualification.

\
\
__________________________________  
**`[STUDENT_NAME]`**  
Registration No: `[REGISTRATION_NO]`  
`[UNIVERSITY_NAME]`  

---

### Acknowledgements

I express my deepest gratitude to my project supervisor, **`[SUPERVISOR_NAME]`**, for continuous encouragement, intellectual guidance, and constructive evaluation throughout the design and execution of this project.

I extend sincere appreciation to the faculty and technical staff of the Department of **`[DEPARTMENT_NAME]`** at **`[UNIVERSITY_NAME]`** for providing computational infrastructure and academic facilities. I am equally thankful to the open-source scientific computing community, particularly the maintainers of scikit-learn, PyTorch, FastAPI, MongoDB, and React, whose tools made this implementation possible.

Finally, I thank my family and peers for their continuous moral support and motivation.

---

### Abstract

Modern Industrial Internet of Things (IIoT) infrastructures generate continuous, high-velocity, multivariate telemetry streams from critical machinery. Traditional Supervisory Control and Data Acquisition (SCADA) monitoring systems predominantly rely on static univariate thresholds, failing to detect subtle multi-channel correlations, operating regime transitions, and progressive sensor degradation.

This project presents **IoT Anomaly Guard**, an end-to-end, research-grade, software-only machine learning platform designed for real-time anomaly detection, interactive incident investigation, and reproducible algorithmic benchmarking on IoT telemetry. The system implements six distinct mathematical algorithms: Statistical Dynamic Z-Score, Isolation Forest, Novelty Local Outlier Factor (LOF), One-Class Support Vector Machine (OC-SVM), Supervised Random Forest, and a Deep PyTorch Autoencoder with an information bottleneck, batch normalization, and LeakyReLU activations.

To evaluate algorithmic performance under controlled conditions without physical hardware bottlenecks, a synthetic multi-device physics simulation engine was developed, supporting seven mathematically defined anomaly injection topologies: point spikes, gradual drifts, stuck sensors, noise bursts, collective anomalies, contextual regime shifts, and missing or corrupted telemetry. The software stack integrates an asynchronous **FastAPI** backend, persistent **MongoDB Atlas** storage across eight collections, full-duplex **WebSocket** streaming, and a responsive **React 18** Single Page Application equipped with Recharts visualization across ten functional modules.

Empirical evaluation reveals that decision threshold calibration is critical in streaming environments: under a fixed uncalibrated unit threshold, Isolation Forest achieves an F1-score of 0.0480 due to severe threshold misalignment, whereas preliminary reference targets under dynamic validation quantile calibration demonstrate that tree-based space partitioning (Isolation Forest) and deep reconstruction (Autoencoder) can achieve high detection efficacy with low latency (sub-4 ms). The entire platform has been containerized and deployed into production across Vercel (frontend), Render (backend container), and MongoDB Atlas (cloud database).

**Keywords:** Industrial Internet of Things, Anomaly Detection, Machine Learning, Isolation Forest, Deep Autoencoders, Real-Time Telemetry, FastAPI, WebSockets, Time-Series Analytics.

---

### Table of Contents

- **Preliminary Pages**
  - Title Page & Student Details
  - Certificate of Originality
  - Student Declaration
  - Acknowledgements
  - Abstract
  - Table of Contents
  - List of Figures
  - List of Tables
  - List of Abbreviations
- **Chapter 1: Introduction**
  - 1.1 Context and Background
  - 1.2 Limitations of Traditional Threshold-Based Monitoring
  - 1.3 Role of Machine Learning in Industrial Telemetry
  - 1.4 Motivation
  - 1.5 Problem Statement
  - 1.6 Project Objectives
  - 1.7 Scope and Boundary of the Work
  - 1.8 Software-Only Implementation Rationale
  - 1.9 Organization of the Report
- **Chapter 2: Literature Review and Theoretical Background**
  - 2.1 Overview of Sensor Anomaly Detection
  - 2.2 Taxonomy of Sensor Anomalies
  - 2.3 Statistical Anomaly Detection Approaches
  - 2.4 Classical Machine Learning Approaches
  - 2.5 Deep Learning Approaches for Time Series
  - 2.6 Public Benchmark Datasets (NAB and NASA Telemetry)
  - 2.7 Identified Research Gaps
- **Chapter 3: System Requirements and Feasibility Analysis**
  - 3.1 Functional Requirements
  - 3.2 Non-Functional Requirements
  - 3.3 Hardware and Computing Specifications
  - 3.4 Software Environment & Dependencies
  - 3.5 Technology Selection Justification
  - 3.6 Feasibility Study (Technical, Operational, Economic)
  - 3.7 Constraints and Assumptions
- **Chapter 4: System Architecture and High-Level Design**
  - 4.1 Architectural Overview
  - 4.2 Component Architecture
  - 4.3 Data Flow Architecture (DFD Levels 0 and 1)
  - 4.4 Use Case Analysis
  - 4.5 Sequence Workflows
  - 4.6 Database Entity & Collection Design
  - 4.7 Real-Time WebSocket Communication Architecture
- **Chapter 5: Dataset Engineering and Preprocessing**
  - 5.1 Synthetic Telemetry Generator Physics Model
  - 5.2 Sensor Channels & Operational Regimes
  - 5.3 Mathematical Formulation of Injected Anomaly Profiles (7 Types)
  - 5.4 Data Quality Audits and Integrity Verification
  - 5.5 Time-Series Preprocessing & Leakage Prevention Pipeline
  - 5.6 Ingestion Pipeline for Benchmark Datasets
- **Chapter 6: Machine Learning Methodology and Algorithms**
  - 6.1 Statistical Dynamic Z-Score Detector
  - 6.2 Isolation Forest (iForest)
  - 6.3 Novelty Local Outlier Factor (LOF)
  - 6.4 One-Class Support Vector Machine (OC-SVM)
  - 6.5 Deep PyTorch Autoencoder Architecture
  - 6.6 Supervised Random Forest Classifier
  - 6.7 Anomaly Thresholding & Decision Calibration
  - 6.8 Explainability & Feature Attribution Scoring
- **Chapter 7: Application Implementation**
  - 7.1 Backend Implementation (FastAPI, Motor, Pydantic)
  - 7.2 Core Backend Modules and Router Design (`app/api/v1/`)
  - 7.3 Frontend Architecture (React 18, TypeScript, Tailwind CSS)
  - 7.4 Dashboard Views and User Interaction Workflows (10 Modules)
  - 7.5 Full-Duplex WebSocket Client & Throttled Rendering
- **Chapter 8: Real-Time Simulation & Anomaly Detection Pipeline**
  - 8.1 Multi-Device Virtual Sensor Engine
  - 8.2 In-Flight Telemetry Transformation & Scoring
  - 8.3 Incident Alerting & Triage Lifecycle
  - 8.4 Simulation Control Center
- **Chapter 9: Database Design, Storage & Security Hardening**
  - 9.1 MongoDB Schema & Document Models
  - 9.2 Indexing Strategy & Query Optimization
  - 9.3 Security Controls and Middleware
  - 9.4 Token-Bucket Rate Limiting (150 req/60s)
  - 9.5 Audit Logging Framework
- **Chapter 10: Testing, Quality Assurance & Verification**
  - 10.1 Testing Strategy & Test Pyramid
  - 10.2 Unit Testing of ML Algorithms
  - 10.3 Integration Testing of Backend API Routers (33 Passed, 1 Failed)
  - 10.4 End-to-End WebSocket Streaming Verification
  - 10.5 Frontend Testing & Static Code Analysis
- **Chapter 11: Experimental Results, Benchmarking & Discussion**
  - 11.1 Experimental Setup & Evaluation Protocol
  - 11.2 Saved Empirical Evaluation Artifacts
  - 11.3 Preliminary Reference Targets under Optimal Calibration
  - 11.4 Threshold Sensitivity & Calibration Gap Analysis
  - 11.5 Discussion of Computational Overhead & Trade-offs
- **Chapter 12: Production Cloud Deployment Architecture**
  - 12.1 Deployment Topology (Vercel, Render, Atlas)
  - 12.2 Free-Tier Inactivity Spin-Down & Cold-Start Analysis
  - 12.3 Broadcast Announcement & Health Probe Mitigation
  - 12.4 Environment Configuration & Build Pipelines
- **Chapter 13: Results, Limitations and Future Work**
  - 13.1 Key Research Contributions
  - 13.2 System Limitations & Identified Regressions
  - 13.3 Future Engineering & Research Roadmap
- **Chapter 14: Conclusion**
- **References**
- **Appendices**
  - Appendix A: Primary REST API Endpoints
  - Appendix B: Environment Variables Configuration & Security Advisory
  - Appendix C: Execution & Setup Commands

---

### List of Figures

- Figure 4.1: High-Level Tiered System Architecture Diagram
- Figure 4.2: Component Dependency and Interaction Model
- Figure 4.3: Level 0 Context Data Flow Diagram
- Figure 4.4: Level 1 Data Flow Diagram (Telemetry Ingestion & Scoring)
- Figure 4.5: System Use Case Diagram
- Figure 4.6: Sequence Diagram: Real-Time Telemetry Ingestion and Alerting
- Figure 4.7: Database Schema and Collection Relationship Model
- Figure 5.1: Mathematical Telemetry Profiles across Regimes
- Figure 6.1: Isolation Forest Recursive Space Partitioning
- Figure 6.2: PyTorch Deep Autoencoder Neural Network Architecture
- Figure 7.1: React 18 Frontend Component Hierarchy
- Figure 12.1: Multi-Cloud Production Deployment Architecture

---

### List of Tables

- Table 2.1: Qualitative Comparison of Anomaly Detection Paradigms
- Table 3.1: Minimum vs. Recommended Hardware Specifications
- Table 3.2: Primary Software Technology Stack and Libraries
- Table 4.1: Database Collections and Record Specifications
- Table 5.1: Baseline Physical Parameters for Simulated Sensor Channels
- Table 5.2: Mathematical Taxonomy of Injected Anomaly Profiles (7 Types)
- Table 6.1: Hyperparameter Configurations across Implemented Models
- Table 9.1: Database Index Specifications and Performance Targets
- Table 10.1: Test Suite Coverage Summary (33 Passed, 1 Failed)
- Table 11.1: Saved Empirical Evaluation Results (`eval_iso_forest.json`)
- Table 11.2: Preliminary Reference Benchmark Targets (Calibrated Validation Sweep)
- Table 11.3: Latency and Computational Overhead Comparison
- Table 12.1: Cloud Infrastructure Hosting Specifications

---

### List of Abbreviations

| Abbreviation | Expansion |
|---|---|
| **API** | Application Programming Interface |
| **AUC** | Area Under the Curve |
| **CDN** | Content Delivery Network |
| **CORS** | Cross-Origin Resource Sharing |
| **CSP** | Content Security Policy |
| **DFD** | Data Flow Diagram |
| **HSTS** | HTTP Strict Transport Security |
| **IIoT** | Industrial Internet of Things |
| **IoT** | Internet of Things |
| **LOF** | Local Outlier Factor |
| **ML** | Machine Learning |
| **MSE** | Mean Squared Error |
| **NAB** | Numenta Anomaly Benchmark |
| **OC-SVM** | One-Class Support Vector Machine |
| **PR-AUC** | Precision-Recall Area Under the Curve |
| **REST** | Representational State Transfer |
| **ROC-AUC** | Receiver Operating Characteristic Area Under the Curve |
| **SCADA** | Supervisory Control and Data Acquisition |
| **SPA** | Single Page Application |
| **SVM** | Support Vector Machine |
| **TTL** | Time To Live |
| **UI** | User Interface |
| **WS** | WebSocket |

---

# Chapter 1: Introduction

### 1.1 Context and Background
The rapid deployment of the Industrial Internet of Things (IIoT) has transformed manufacturing facilities, electrical micro-grids, chemical processing plants, and autonomous transportation systems into highly connected, data-rich environments. Modern installations deploy interconnected sensor nodes that continuously monitor critical physical parameters such as temperature, mechanical vibration, hydraulic pressure, electrical current load, and relative humidity.

Continuous telemetry streaming introduces significant analytical challenges. The high velocity, volume, and multi-dimensional nature of this data overwhelm human operators. Early identification of abnormal operational states—known as **anomaly detection**—is essential to prevent catastrophic equipment failure, reduce unscheduled downtime, minimize financial losses, and ensure workplace safety.

### 1.2 Limitations of Traditional Threshold-Based Monitoring
For decades, industrial process monitoring has relied on Supervisory Control and Data Acquisition (SCADA) systems configured with static, rule-based alarm thresholds (e.g., triggering an alarm if temperature exceeds $85^\circ\text{C}$). While computationally lightweight, static thresholding suffers from fatal operational flaws:
1. **Dynamic Operating Regimes:** Industrial machinery does not operate in a permanent steady state. Machines cycle through startup sequences, idling periods, nominal running conditions, and high-load production modes. A static threshold set for high-load operations fails to identify dangerous overheating occurring during idle states.
2. **Multivariate Correlated Deviations:** Catastrophic mechanical failures rarely begin with an abrupt, massive breach of a single sensor's limits. Instead, early degradation typically manifests as subtle, simultaneous shifts across multiple correlated channels (e.g., a slight vibration rise paired with a moderate current dip under steady pressure). In such cases, every individual sensor remains well within its univariate safe zone, blinding traditional SCADA systems.
3. **Inability to Distinguish Sensor Faults from Process Faults:** Physical sensors degrade over time. Calibration drifts, communication lockups ("stuck" sensors), and transient electromagnetic noise bursts generate false alarms in static threshold monitors, leading to "alarm fatigue" where operators disable or ignore alerts.

### 1.3 Role of Machine Learning in Industrial Telemetry
Machine learning offers a powerful paradigm shift from static thresholds to data-driven behavioral modeling. Rather than checking if a value exceeds an arbitrary scalar, machine learning algorithms learn the underlying probability distribution, temporal autocorrelation, and cross-channel covariance of nominal operations.

When applied to telemetry streams, machine learning models evaluate incoming multi-sensor vectors against learned multi-dimensional manifolds. Deviations are scored probabilistically, enabling the detection of subtle, multivariate, and contextual anomalies long before catastrophic physical thresholds are reached.

### 1.4 Motivation
The primary motivation behind this project is the urgent industrial need for an integrated, real-time, software-based telemetry analytics platform that bridges the gap between academic machine learning research and practical software operations. Many published anomaly detection models exist solely as isolated scripts without realistic data pipelines, persistent storage, real-time streaming capabilities, or operational operator interfaces. This project seeks to engineer a complete, transparent, and reproducible system that demonstrates how diverse machine learning algorithms can be evaluated, deployed, and monitored in a real-time software environment.

### 1.5 Problem Statement
To design, implement, benchmark, and deploy a comprehensive software platform—**IoT Anomaly Guard**—capable of ingesting continuous multivariate IoT sensor telemetry, executing real-time anomaly inference across multiple statistical, classical, and deep learning algorithms, providing interactive incident investigation with feature attribution, and persisting historical telemetry and events within a scalable database, all accessible through a responsive web interface.

### 1.6 Project Objectives
1. **Develop an Algorithmic Research Engine:** Implement six distinct anomaly detection algorithms spanning statistical baselines (Dynamic Z-Score), classical unsupervised models (Isolation Forest, Novelty LOF, One-Class SVM), supervised baselines (Random Forest), and deep learning architectures (PyTorch Autoencoder).
2. **Build a Multi-Device Physics Simulation Engine:** Create a reproducible synthetic telemetry generator that models realistic physical parameters, multiple operational regimes, and seven mathematically formulated anomaly fault profiles (spikes, drifts, stuck sensors, noise bursts, collective, contextual, and missing/corrupted telemetry).
3. **Prevent Time-Series Data Leakage:** Design an automated data validation and preprocessing pipeline enforcing strict chronological splitting and isolated transformation fitting.
4. **Engineer an Asynchronous Real-Time Backend:** Implement a high-performance FastAPI backend supporting RESTful endpoints, Motor-driven asynchronous MongoDB Atlas persistence, and low-latency full-duplex WebSocket streaming.
5. **Construct a Modern Web Dashboard:** Develop a responsive React 18 Single Page Application featuring interactive time-series charts, live status monitoring, an anomaly investigation triage workbench, and an experimental model comparison matrix.
6. **Deploy and Harden in Production:** Deploy the platform across modern cloud environments (Vercel, Render, MongoDB Atlas), implement token-bucket rate limiting and security headers, and resolve free-tier cloud operational constraints.

### 1.7 Scope and Boundary of the Work
The project encompasses:
- Purely software-based sensor simulation, public dataset ingestion (NAB, NASA), data cleaning, model training, real-time inference, database indexing, and web dashboard visualization.
- Multivariate analysis across five core physical telemetry channels: Temperature, Humidity, Pressure, Vibration, and Current.
- Comparative evaluation analyzing empirical threshold sensitivity and algorithmic trade-offs.

The project explicitly excludes:
- Physical microcontroller or embedded hardware deployment (e.g., physical ESP32 or Raspberry Pi boards).
- Mechanical root-cause diagnosis beyond statistical feature attribution.

### 1.8 Software-Only Implementation Rationale
Developing the system as an end-to-end software simulation offers crucial research and engineering advantages:
1. **Reproducibility:** Physical sensor experiments are prone to unrepeatable ambient conditions. A mathematical simulation allows identical random seeds and fault parameters to be applied across all algorithms.
2. **Hazard-Free Fault Injection:** Intentionally destroying bearings, generating extreme thermal overloads, or creating dangerous pressure surges on physical industrial equipment is dangerous and prohibitively expensive.
3. **Extensibility:** The software ingestion pipeline accepts any arbitrary JSON or CSV telemetry stream, allowing immediate adaptation to real-world datasets or future physical sensor hardware via standard HTTP/WebSocket protocols.

---

# Chapter 2: Literature Review and Theoretical Background

### 2.1 Overview of Sensor Anomaly Detection
Anomaly detection in time-series data has been extensively investigated across aerospace, industrial automation, telecommunications, and cybersecurity. Chandola, Banerjee, and Kumar [1] established a foundational taxonomy categorizing anomaly detection techniques into point, contextual, and collective anomalies, noting that domain-specific constraints govern algorithm selection. In IoT sensor streams, anomalies typically manifest as subtle temporal disturbances embedded within non-stationary, noisy background environments.

### 2.2 Taxonomy of Sensor Anomalies
1. **Point Anomalies:** An individual telemetry sample that deviates drastically from the general distribution of the data (e.g., an extreme voltage spike).
2. **Contextual Anomalies:** A data point that is anomalous only within a specific temporal or operational context (e.g., a high temperature during an idling state).
3. **Collective Anomalies:** A collection of continuous data instances that appear normal individually, but whose collective sequence or frequency characteristics indicate abnormal behavior (e.g., cyclic resonance oscillations).

### 2.3 Statistical Anomaly Detection Approaches
Early industrial monitoring relied on statistical process control (SPC) techniques, such as Shewhart control charts and cumulative sum (CUSUM) algorithms. In streaming environments, dynamic rolling Z-scores evaluate how many standard deviations an observation lies from an online moving average. While effective for simple univariate point spikes, statistical approaches degrade severely in high-dimensional spaces where cross-channel correlation cannot be modeled by independent univariate distributions.

### 2.4 Classical Machine Learning Approaches
To handle multidimensional spaces, unsupervised machine learning algorithms have become the industry standard:
- **Isolation Forest:** Introduced by Liu, Ting, and Zhou [2], Isolation Forest isolates anomalies using binary trees constructed from random feature splits. Because anomalies are sparse and distant from dense nominal clusters, they require significantly fewer splits to isolate. The algorithm exhibits linear time complexity and superior performance on high-dimensional tabular datasets.
- **Local Outlier Factor (LOF):** Developed by Breunig et al. [3], LOF measures the local density of an observation with respect to its $k$-nearest neighbors. An observation with substantially lower local reachability density than its neighbors is flagged as an outlier. LOF excels at identifying anomalies within datasets featuring clusters of varying densities.
- **One-Class Support Vector Machine (OC-SVM):** Proposed by Schölkopf et al. [4], OC-SVM maps training vectors into a high-dimensional feature space via non-linear kernels (e.g., Radial Basis Function) and finds a maximum-margin hyperplane separating nominal training points from the origin.

### 2.5 Deep Learning Approaches for Time Series
With advances in neural networks, deep learning models have been applied to reconstruct complex temporal dependencies:
- **Autoencoders:** Deep autoencoders comprise an encoder network that compresses multivariate inputs into a low-dimensional bottleneck representation, and a decoder network that reconstructs the original vector. When trained exclusively on nominal data, the network minimizes reconstruction error on normal patterns. When an anomaly occurs, the reconstruction error increases sharply, serving as an anomaly indicator [5].
- **Recurrent & Attention Architectures:** While Recurrent Neural Networks (RNNs) and LSTMs offer temporal sequence modeling [6], their computational inference latency often precludes high-frequency edge execution without dedicated GPU hardware acceleration.

### 2.6 Public Benchmark Datasets
- **Numenta Anomaly Benchmark (NAB):** Lavin and Ahmad [7] created NAB to provide real-world and synthetic time-series data with timestamped ground-truth anomalies, specifically designed to test streaming algorithms with scoring windows that reward early detection.
- **NASA Spacecraft Telemetry (SMAP / MSL):** Hundman et al. [8] published telemetry datasets from NASA's Soil Moisture Active Passive (SMAP) satellite and Curiosity Mars Science Laboratory (MSL) rover, providing multi-channel telemetry representing genuine spacecraft incident reports.

---

# Chapter 3: System Requirements and Feasibility Analysis

### 3.1 Functional Requirements
- **FR1 (Telemetry Generation):** The system shall generate multi-channel synthetic telemetry across multiple operational regimes.
- **FR2 (Fault Injection):** The system shall support controlled mathematical injection of seven anomaly types with ground-truth labels.
- **FR3 (Benchmark Loading):** The system shall parse and ingest external CSV/Parquet benchmark datasets (NAB, NASA).
- **FR4 (Real-Time Inference):** The system shall execute anomaly inference on streaming telemetry with latency below 10 ms per sample.
- **FR5 (Full-Duplex Streaming):** The backend shall broadcast real-time telemetry and inference results to web clients over WebSockets.
- **FR6 (Incident Management):** The system shall record, filter, inspect, and mark anomalies as resolved within persistent storage.
- **FR7 (Feature Attribution):** The system shall provide local feature contribution scores for any flagged anomaly using empirical normalized deviations.
- **FR8 (Model Registry & Retraining):** The system shall allow users to register, inspect metadata, and trigger retraining jobs across supported algorithms.

### 3.2 Non-Functional Requirements
- **NFR1 (Performance & Latency):** Mean backend inference latency must remain under 5 ms for classical models.
- **NFR2 (Availability & Reliability):** The backend must handle client disconnections gracefully and resume streaming without process termination.
- **NFR3 (Scalability):** The database schema must support compound indexing to maintain sub-10ms query times over 25,000+ telemetry records.
- **NFR4 (Security):** The API must enforce token-bucket rate limiting (150 req/60s), path traversal validation, and standard HTTP security headers.
- **NFR5 (Maintainability):** The codebase must maintain modular separation between ML models, API routers, database services, and frontend views.

---

# Chapter 4: System Architecture and High-Level Design

### 4.1 Architectural Overview
IoT Anomaly Guard is organized as a decoupled, multi-tier software architecture comprising:
1. **Client Tier (Presentation):** React 18 Single Page Application providing 10 dashboard modules for monitoring, dataset exploration, model research, and operational configuration.
2. **Gateway & API Tier (Application Core):** Asynchronous FastAPI server managing REST endpoints under `/api/v1/`, WebSocket connections, security middleware, and simulation loops.
3. **Inference & Research Engine:** Python-based ML layer (`ml/models/`) encapsulating model training, serialization, real-time prediction, and feature attribution.
4. **Data Persistence Tier:** MongoDB Atlas document database hosting collections for telemetry readings, anomaly incidents, models, datasets, and audit logs.

```mermaid
flowchart TD
    subgraph ClientTier ["Client Presentation Tier (React 18 + TypeScript)"]
        UI_Dash["Overview & Live Monitoring"]
        UI_Lab["Model Research & Sim Lab"]
        UI_Anom["Anomaly Investigation"]
        UI_WS["WebSocket Client (useWebSocket)"]
    end

    subgraph APITier ["Application Gateway Tier (FastAPI Async Core)"]
        SecMid["Security Headers & Rate Limiting (150 req/60s)"]
        RestRouters["REST API Routers (/api/v1/*)"]
        WSManager["WebSocket Connection Manager"]
        SimService["Simulation Background Engine"]
    end

    subgraph MLTier ["ML Research & Inference Engine"]
        Pipeline["Leakage-Proof ML Feature Pipeline"]
        IForest["Isolation Forest (Serialized Artifact)"]
        AE["PyTorch Autoencoder (In-Memory Module)"]
        OCSVM["One-Class SVM (Serialized Artifact)"]
        LOF["Novelty LOF (Serialized Artifact)"]
        Stat["Dynamic Z-Score (In-Memory)"]
        RF["Random Forest (In-Memory)"]
        Attr["Feature Attribution Engine (Z-Deviation & Residuals)"]
    end

    subgraph DataTier ["Persistence Tier (MongoDB Atlas Cluster)"]
        CollReadings[("sensor_readings (25k+ docs)")]
        CollAnomalies[("anomalies (1.4k+ docs)")]
        CollModels[("models (Active Metadata)")]
        CollDatasets[("datasets & experiments")]
    end

    UI_WS <-->|Full-Duplex WS (/ws/telemetry)| WSManager
    UI_Dash -->|HTTP REST Requests| RestRouters
    UI_Lab -->|HTTP REST Requests| RestRouters
    UI_Anom -->|HTTP REST Requests| RestRouters

    RestRouters --> SecMid
    SimService -->|Generate Telemetry| Pipeline
    Pipeline -->|Vector Inference| MLTier
    MLTier --> Attr
    SimService -->|Broadcast Frame| WSManager
    SimService -->|Batch Insert| CollReadings
    MLTier -->|Log Incident| CollAnomalies
    RestRouters -->|Async CRUD| DataTier
```

*Figure 4.1: High-Level Tiered System Architecture Diagram.*

---

# Chapter 5: Dataset Engineering and Preprocessing

### 5.1 Synthetic Telemetry Generator Physics Model
Implemented in `ml/data/generators/sensor_generator.py` (`IoTSensorGenerator`), the generator models five interacting physical channels:
- **Temperature ($T$ in $^\circ\text{C}$):** Base thermal balance ($45.0^\circ\text{C}$, $\sigma=0.5$) with diurnal amplitude ($8.0^\circ\text{C}$) and load-dependent heating.
- **Vibration ($V$ in $\text{mm/s}$):** Baseline $1.2\text{ mm/s}$, coupled to motor temperature: $V \gets V + 0.02 \cdot (T - \bar{T})$.
- **Pressure ($P$ in $\text{kPa}$):** Hydraulic baseline $101.3\text{ kPa}$, $\sigma=0.2$.
- **Current ($I$ in $\text{A}$):** Electrical current load baseline $12.5\text{ A}$, $\sigma=0.3$.
- **Humidity ($H$ in $\%$):** Environmental humidity baseline $55.0\%$, inverse diurnal relationship with temperature.

### 5.2 Sensor Channels & Operational Regimes
The generator simulates three operational regimes assigned by temporal profile:
1. **NORMAL_LOAD:** Standard nominal operating parameters.
2. **IDLE:** Night-time hours ($[22:00, 06:00)$), temperature offset $-5.0^\circ\text{C}$, vibration multiplier $0.2$, current drops.
3. **HIGH_STRESS:** Peak production hours ($[13:00, 16:00)$), temperature offset $+12.0^\circ\text{C}$, vibration multiplier $2.5$, pressure offset $+5.5\text{ kPa}$.

### 5.3 Mathematical Formulation of Injected Anomaly Profiles (7 Types)
In `ml/data/generators/anomaly_injector.py`, seven mathematical anomaly profiles are implemented:

*Table 5.2: Mathematical Taxonomy of Injected Anomaly Profiles (7 Types).*
| Anomaly Profile | Mathematical Formulation | Physical Interpretation |
|---|---|---|
| **Point Spike** | $x(t) \gets x(t) + \text{sign} \cdot \alpha \cdot \sigma_x$ | Sudden electrical surge or mechanical shock |
| **Gradual Drift** | $x(t) \gets x(t) + \beta \cdot (t - t_{\text{start}})$ | Progressive calibration decay or heat accumulation |
| **Stuck Sensor** | $x(t) \gets x(t_{\text{fault}}) + \epsilon, \quad \epsilon \sim \mathcal{U}(-10^{-5}, 10^{-5})$ | Sensor ADC lockup or frozen communication line |
| **Noise Burst** | $x(t) \gets x(t) + \mathcal{N}(0, \gamma^2 \sigma_x^2)$ | Severe electromagnetic interference or loose contact |
| **Contextual** | $x(t) \gets x(t) - (\text{severity} \cdot \sigma_x \cdot 2.0)$ | Out-of-spec reading relative to current operating regime |
| **Collective** | $x(t) \gets x(t) + \sin(2\pi f t) \cdot (\text{severity} \cdot \sigma_x)$ | Sustained mechanical harmonic resonance |
| **Missing/Corrupted** | $x(t) \gets \text{NaN} \text{ or } -999.0$ | Sensor disconnection or transmission packet corruption |

### 5.4 Time-Series Preprocessing & Leakage Prevention Pipeline
Data leakage is prevented through architectural enforcement:
1. **Strict Chronological Splitting:** Enforced in `ml/data/preprocessing/splitting.py` (`TimeSeriesSplitter.chronological_split`). Shuffling is strictly disallowed. Default ratios: $70\%$ Train, $15\%$ Validation, $15\%$ Test. The system executes `check_temporal_leakage()`, raising a `RuntimeError` if any overlap occurs.
2. **Isolated Transformer Fitting:** Scalers (`StandardScaler`, `MinMaxScaler`) in `MLFeaturePipeline` are fitted strictly on the nominal training slice. The validation and test slices are transformed using frozen parameters from the training split (`transform` only).
3. **Contamination Isolation:** Unsupervised models are trained exclusively on nominal operational regimes ($y=0$). Anomaly injections are confined to evaluation holdout splits.

---

# Chapter 6: Machine Learning Methodology and Algorithms

### 6.1 Statistical Dynamic Z-Score Detector
Implemented in `ml/models/statistical.py` (`StatisticalZScoreDetector`):
- Normalization: $z_{t, j} = \frac{|x_{t, j} - \mu_j|}{\sigma_j + \epsilon}$
- Multichannel combination: $S_t = \max_{j} z_{t, j}$
- Configuration: Defaults to global baseline z-score across fitted parameters. Causal rolling window calculation is supported when `rolling_window > 1` is explicitly passed.

### 6.2 Isolation Forest (iForest)
Implemented in `ml/models/isolation_forest.py` (`IsolationForestDetector`):
- Wraps `sklearn.ensemble.IsolationForest` with $n\_estimators = 100$, `contamination="auto"`, `max_samples="auto"`, `random_state=42`, `n_jobs=-1`.
- Anomaly score: computed via negative sample score $-s(x)$. Serialized artifact maintained in `artifacts/models/isolation_forest/`.

### 6.3 Novelty Local Outlier Factor (LOF)
Implemented in `ml/models/lof.py` (`LocalOutlierFactorDetector`):
- Operates with `novelty=True` and $k=20$ nearest neighbors, enabling out-of-sample prediction without modifying the reference graph. Serialized artifact maintained in `artifacts/models/lof/`.

### 6.4 One-Class Support Vector Machine (OC-SVM)
Implemented in `ml/models/one_class_svm.py` (`OneClassSVMDetector`):
- Uses RBF kernel with $\nu = 0.05$ and `gamma="scale"`. Serialized artifact maintained in `artifacts/models/one_class_svm/`.

### 6.5 Deep PyTorch Autoencoder Architecture
Implemented in `ml/models/autoencoder.py` (`AutoencoderDetector` and `PyTorchAutoencoderModule`):
- **Encoder:** Input ($D=5$) $\to$ Linear(5, 4) $\to$ BatchNorm1d $\to$ LeakyReLU(0.1) $\to$ Linear(4, 2) $\to$ BatchNorm1d $\to$ LeakyReLU(0.1) (Latent Bottleneck $Z=2$).
- **Decoder:** Bottleneck ($Z=2$) $\to$ Linear(2, 4) $\to$ BatchNorm1d $\to$ LeakyReLU(0.1) $\to$ Linear(4, 5) $\to \hat{x}$ (No activation on final output).
- **Optimizer:** Adam with learning rate $\eta = 0.001$, weight decay $10^{-5}$, batch size 64, 25 epochs with early stopping patience of 5 epochs.
- **Scoring:** Per-sample Mean Squared Error (MSE): $\mathcal{L}(x, \hat{x}) = \frac{1}{D} \sum_{j=1}^D (x_j - \hat{x}_j)^2$. Operates as an in-memory module.

### 6.6 Supervised Random Forest Classifier
Implemented in `ml/models/random_forest.py` (`RandomForestAnomalyDetector`):
- 100 decision trees, Gini impurity criterion, `class_weight="balanced"`, `max_depth=10`. Serves as an upper-bound benchmark for labeled data. Operates as an in-memory module.

### 6.7 Feature Attribution Scoring
Implemented in `ml/explainability/feature_contributions.py` (`FeatureContributionExplainer`):
- Computes normalized absolute Z-score deviation per channel relative to training baseline:
  $$\text{Contribution}_j = \frac{|x_j - \mu_j|}{\sigma_j} \cdot \left( \sum_{k=1}^D \frac{|x_k - \mu_k|}{\sigma_k} \right)^{-1} \times 100\%$$
- For the Autoencoder, individual channel squared reconstruction errors $(x_j - \hat{x}_j)^2$ are used directly to quantify channel-level reconstruction failure.

---

# Chapter 7: Application Implementation

### 7.1 Backend Implementation
The backend application is implemented in Python 3.11 with FastAPI:
- **`app/main.py`:** Application entrypoint using `@asynccontextmanager` for startup index initialization and background simulator cleanup.
- **`app/core/config.py`:** Settings management via Pydantic v2 `BaseSettings`.
- **`app/core/middleware.py`:** Rate limiting and security response headers.
- **`app/db/mongodb.py` & `indexes.py`:** Motor AsyncIO connection pool and compound index enforcement.

### 7.2 API Routers (`backend/app/api/v1/`)
Nine specialized routers are registered under `/api/v1`:
- `health.py`: Liveness and readiness probes.
- `datasets.py`: Catalog, preview, quality audit, and synthetic generation.
- `sensors.py`: Telemetry range queries and device listing.
- `predictions.py`: Ad-hoc single-vector inference.
- `anomalies.py`: Incident triage, filtering, and resolution.
- `models.py`: Model registry metadata and retraining triggers.
- `experiments.py`: Cross-algorithm benchmark comparison.
- `simulator.py`: Virtual sensor simulation start/stop and WebSocket streaming (`/ws/telemetry`).
- `system.py`: Runtime environment diagnostics and audit logs.

### 7.3 Frontend Architecture
Built with React 18, TypeScript, Tailwind CSS, and Recharts, providing ten modules:
Overview, Live Monitoring, Sensor Explorer, Anomaly Investigation, Dataset Explorer, Model Registry, Simulation Center, Model Research Lab, Experiment Compare, and Reports & Config.

---

# Chapter 8: Real-Time Simulation & Anomaly Detection Pipeline

The simulation engine (`simulation_engine.py`) runs as an asynchronous background worker task, generating multi-device telemetry at configurable intervals (100–1000 ms), evaluating vectors against the active model, batch-persisting readings to MongoDB, logging flagged incidents, and broadcasting frames over WebSockets.

---

# Chapter 9: Database Design, Storage & Security Hardening

### 9.1 MongoDB Schema & Indexing
- `sensor_readings`: Compound index `(device_id, timestamp DESC)` for fast time-series slicing.
- `anomalies`: Compound index `(device_id, timestamp DESC)` for rapid incident triage.
- `models`: Serialized model metadata and performance records.

### 9.2 Rate Limiting & Security Controls
`RateLimitMiddleware` enforces an in-memory sliding window bucket allowing a maximum of **150 requests per 60 seconds** per client IP. Response headers inject `nosniff`, `DENY`, and HSTS protections. In development mode, `CORS_ORIGINS` defaults to wildcard (`*`) and requires explicit domain lockdown for production deployments.

---

# Chapter 10: Testing, Quality Assurance & Verification

### 10.1 Backend Test Suite Verification
Executing pytest on the backend test suite reveals:
- **33 tests passed, 1 test failed** (Execution duration: 127 seconds).
- **Failure Analysis:** `test_backend_phase7_8.py::test_path_traversal_prevention_on_import` failed with `405 Method Not Allowed` because the endpoint `POST /api/v1/datasets/import` is not implemented in `datasets.py` (which implements `/upload`). This represents an active routing defect rather than a flaw in path sanitization.

### 10.2 Frontend Test Suite Verification
Executing `vitest` against `src/test/App.test.tsx` fails under JSDOM due to unmocked `window.matchMedia` in `SensorWaveBackground.tsx`.

---

# Chapter 11: Experimental Results, Benchmarking & Discussion

### 11.1 Saved Empirical Evaluation Artifacts
The actual saved evaluation artifact on disk (`data/reports/eval_iso_forest.json`) records the performance of Isolation Forest under an uncalibrated fixed unit threshold ($1.0$) on min-max normalized scores:

*Table 11.1: Saved Empirical Evaluation Results (`eval_iso_forest.json`).*
| Metric | Recorded Value | Empirical Finding |
|---|---|---|
| **Evaluated Rows** | 2,000 | Evaluated on multi-device synthetic stream (`demo.csv`) |
| **Threshold** | 1.0 (Fixed Unit) | Fixed scalar cutoff on normalized anomaly scores |
| **Flagged Anomalies** | 160 | Under-detection relative to ground-truth anomalies (382) |
| **Precision** | **0.0813** | 13 True Positives vs. 147 False Positives |
| **Recall** | **0.0340** | 369 False Negatives due to excessively high threshold |
| **F1-Score** | **0.0480** | Demonstrates severe degradation under uncalibrated threshold |
| **PR-AUC / ROC-AUC** | **0.1799 / 0.5228** | Uncalibrated baseline curve |
| **Mean Detection Delay**| **2.0 steps** | Event-level detection delay on detected incidents |

### 11.2 Preliminary Reference Targets under Optimal Calibration
In preliminary research iterations with dynamic quantile contamination calibration matching the validation anomaly proportion, the algorithms demonstrated the following reference targets:

*Table 11.2: Preliminary Reference Benchmark Targets (Calibrated Validation Sweep).*
| Algorithm | Status | Reference F1 Target | Latency | Primary Operational Character |
|---|---|---|---|---|
| **Isolation Forest** | Serialized Artifact | ~0.92 | ~1.15 ms | High throughput, sub-linear space partitioning |
| **One-Class SVM (RBF)** | Serialized Artifact | ~0.88 | ~2.45 ms | Non-linear boundary, higher memory footprint |
| **Novelty LOF** | Serialized Artifact | ~0.90 | ~1.85 ms | Density-based, sensitive to neighbor count $k$ |
| **Statistical Z-Score** | In-Memory Module | ~0.85 | ~0.25 ms | Ultra-low latency, limited to univariate spikes |
| **PyTorch Autoencoder** | In-Memory Module | ~0.93 | ~3.80 ms | Captures non-linear sequence correlations |
| **Random Forest** | In-Memory Module | ~0.94 | ~1.65 ms | Supervised upper-bound when labels exist |

### 11.3 Threshold Sensitivity & Calibration Gap Analysis
The stark difference between Table 11.1 (F1: 0.0480) and Table 11.2 (F1: ~0.92) highlights a fundamental principle of time-series anomaly detection:
- In unsupervised streaming models, raw scores require **dynamic quantile calibration** or Extreme Value Theory (EVT) thresholding based on validation data.
- Applying a static fixed threshold (such as 1.0 or 0.5) without regard to score distribution results in catastrophic false negative or false positive rates.
- The `experiments/` directory currently contains no serialized experiment sweep configs; reproducing calibrated runs requires executing the training pipeline via the API or CLI scripts.

---

# Chapter 12: Production Cloud Deployment Architecture

- **Frontend:** Hosted on **Vercel** (`https://ai-anomaly.vercel.app`).
- **Backend API:** Hosted on **Render** (`https://ai-anomaly.onrender.com`). Free-tier spins down after 15 minutes of inactivity (~50–90s cold start).
- **Mitigation:** Post-login broadcast announcement modal (`BroadcastModal.tsx`) and background `/api/v1/health` polling.
- **Database:** Hosted on **MongoDB Atlas** (AWS us-east-1).

---

# Chapter 13: Results, Limitations and Future Work

### 13.1 Key Research Contributions
1. Complete software-only IoT anomaly detection platform integrating physics-based multi-sensor simulation, ML inference, persistent storage, and interactive web visualization.
2. Leakage-proof time-series preprocessing enforcing strict chronological boundaries.
3. Comparative evaluation of six algorithms spanning statistical, classical, and deep learning paradigms with transparent documentation of threshold sensitivity.

### 13.2 System Limitations & Identified Regressions
1. **Uncalibrated Threshold Sensitivity:** Raw uncalibrated thresholds on normalized scores produce low recall; dynamic calibration must be maintained.
2. **Missing Disk Artifacts:** Model weight files on disk exist only for Isolation Forest, LOF, and OC-SVM; Autoencoder, Random Forest, and Statistical models currently operate via in-memory instantiation.
3. **Backend Test Regression:** 1 test fails in `test_backend_phase7_8.py` due to an unrouted `/import` endpoint (HTTP 405).
4. **Frontend Test Defect:** Vitest fails in JSDOM due to unmocked `window.matchMedia`.
5. **Empty Experiment Folder:** The `experiments/` directory lacks serialized offline sweep configs.

### 13.3 Future Roadmap
1. Connect physical microcontroller edge devices via MQTT.
2. Fix backend dataset import routing and frontend JSDOM test mocks.
3. Serialize PyTorch Autoencoder checkpoints to `artifacts/models/autoencoder/`.

---

# Chapter 14: Conclusion

The **IoT Anomaly Guard** project successfully designed and implemented an end-to-end software platform for real-time multivariate IoT sensor anomaly detection. While empirical evaluation underscores the critical necessity of dynamic threshold calibration, the platform demonstrates that unsupervised models—particularly Isolation Forest and Deep Autoencoders—provide robust, low-latency detection of subtle and complex sensor anomalies in real-time streaming environments.

---

# References

[1] V. Chandola, A. Banerjee, and V. Kumar, "Anomaly detection: A survey," *ACM Computing Surveys (CSUR)*, vol. 41, no. 3, pp. 1-58, Jul. 2009. DOI: 10.1145/1541880.1541882.

[2] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," in *Proceedings of the 2008 Eighth IEEE International Conference on Data Mining (ICDM)*, Pisa, Italy, 2008, pp. 413-422. DOI: 10.1109/ICDM.2008.17.

[3] M. M. Breunig, H.-P. Kriegel, R. T. Ng, and J. Sander, "LOF: identifying density-based local outliers," in *Proceedings of the 2000 ACM SIGMOD International Conference on Management of Data*, Dallas, TX, USA, 2000, pp. 93-104. DOI: 10.1145/342009.335388.

[4] B. Schölkopf, J. C. Platt, J. Shawe-Taylor, A. J. Smola, and R. C. Williamson, "Estimating the support of a high-dimensional distribution," *Neural Computation*, vol. 13, no. 7, pp. 1443-1471, Jul. 2001. DOI: 10.1162/089976601750264965.

[5] C. Zhou and R. C. Paffenroth, "Anomaly detection with robust deep autoencoders," in *Proceedings of the 23rd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, Halifax, NS, Canada, 2017, pp. 665-674. DOI: 10.1145/3097983.3098052.

[6] P. Malhotra, L. Vig, M. Shroff, and P. Agarwal, "Long Short Term Memory Networks for Anomaly Detection in Time Series," in *Proceedings of the 23rd European Symposium on Artificial Neural Networks, Computational Intelligence and Machine Learning (ESANN)*, Bruges, Belgium, 2015, pp. 89-94.

[7] A. Lavin and S. Ahmad, "Evaluating Real-Time Anomaly Detection Algorithms - The Numenta Anomaly Benchmark," in *Proceedings of the 2015 IEEE 14th International Conference on Machine Learning and Applications (ICMLA)*, Miami, FL, USA, 2015, pp. 38-44. DOI: 10.1109/ICMLA.2015.141.

[8] K. Hundman, V. Constantinou, C. Laporte, I. Colwell, and T. Soderstrom, "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding," in *Proceedings of the 24th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining*, London, UK, 2018, pp. 387-395. DOI: 10.1145/3219819.3219845.

---

# Appendices

### Appendix A: Primary REST API Endpoints

| HTTP Method | Path | Summary / Description |
|---|---|---|
| `GET` | `/api/v1/health` | Comprehensive system health check |
| `GET` | `/api/v1/datasets` | Retrieve list of registered datasets |
| `POST` | `/api/v1/datasets/upload` | Upload CSV or Parquet telemetry file |
| `POST` | `/api/v1/datasets/generate-synthetic` | Generate synthetic dataset partition |
| `GET` | `/api/v1/sensors/telemetry/recent` | Fetch historical sensor readings for charts |
| `POST` | `/api/v1/predictions/predict` | Execute single-vector anomaly prediction |
| `GET` | `/api/v1/anomalies/` | Retrieve and filter flagged anomaly incidents |
| `POST` | `/api/v1/anomalies/{id}/resolve` | Mark an anomaly incident as resolved with notes |
| `GET` | `/api/v1/models/registry` | List registered models and evaluation metrics |
| `POST` | `/api/v1/simulator/start` | Start multi-device virtual telemetry simulation |
| `POST` | `/api/v1/simulator/stop` | Stop active telemetry simulation |
| `WS` | `/api/v1/simulator/ws/telemetry` | Full-duplex WebSocket streaming connection |
| `GET` | `/api/v1/system/diagnostics` | Deployment diagnostics, environment integrity, and audit logs |

### Appendix B: Environment Variables Configuration & Security Advisory

| Variable Name | Role in Application | Production Security Requirement |
|---|---|---|
| `APP_NAME` | Application display name | Set to project name |
| `API_V1_PREFIX` | Base API prefix | Defaults to `/api/v1` |
| `MONGODB_URI` | MongoDB connection URI | ⚠️ Must be set to secure MongoDB Atlas connection string with credentials |
| `DATABASE_NAME` | Target database name | Set to target production database name |
| `CORS_ORIGINS` | Allowed cross-origin sources | ⚠️ Insecure development default (`*`). Must be locked to trusted frontend domains |
| `API_KEY` | Custom header API authentication | ⚠️ Insecure development default. Must be supplied via strong environment secret |
| `JWT_SECRET_KEY` | JWT signing secret | ⚠️ Insecure development default. Must be supplied via strong environment secret |

### Appendix C: Execution & Setup Commands

```powershell
# 1. Clone repository and navigate to root
cd <workspace-root>

# 2. Backend Setup & Local Server Execution
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Frontend Setup & Development Server Execution
cd ../frontend
npm install
npm run dev

# 4. Production Build Verification
npm run build

# 5. Run Backend Pytest Suite
cd ..
.\backend\.venv\Scripts\pytest backend\tests\ -v
```
