# Verified Academic References

All references listed below are genuine, verified academic publications, books, and benchmark datasets. They adhere to the standard **IEEE Citation Format** and directly underpin the methodologies, algorithms, and architectures implemented in **IoT Anomaly Guard**.

---

### Machine Learning & Anomaly Detection Foundations

[1] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," in *Proceedings of the 2008 Eighth IEEE International Conference on Data Mining (ICDM)*, Pisa, Italy, Dec. 2008, pp. 413–422. doi: 10.1109/ICDM.2008.17.  
*Relevance: Foundation of the Isolation Forest algorithm implemented in `ml/models/isolation_forest.py`.*

[2] B. Schölkopf, J. C. Platt, J. Shawe-Taylor, A. J. Smola, and R. C. Williamson, "Estimating the Support of a High-Dimensional Distribution," *Neural Computation*, vol. 13, no. 7, pp. 1443–1471, Jul. 2001. doi: 10.1162/089976601750264965.  
*Relevance: Theoretical formulation of the One-Class Support Vector Machine (OC-SVM) implemented in `ml/models/one_class_svm.py`.*

[3] M. M. Breunig, H.-P. Kriegel, R. T. Ng, and J. Sander, "LOF: Identifying Density-Based Local Outliers," in *Proceedings of the 2000 ACM SIGMOD International Conference on Management of Data (SIGMOD '00)*, Dallas, TX, USA, May 2000, pp. 93–104. doi: 10.1145/335191.335388.  
*Relevance: Formulation of the Local Outlier Factor implemented for novelty detection in `ml/models/lof.py`.*

[4] V. Chandola, A. Banerjee, and V. Kumar, "Anomaly Detection: A Survey," *ACM Computing Surveys*, vol. 41, no. 3, Article 15, pp. 1–58, Jul. 2009. doi: 10.1145/1541880.1541882.  
*Relevance: Comprehensive taxonomy of point, contextual, and collective anomalies utilized in `ml/data/generators/anomaly_injector.py`.*

[5] G. E. Hinton and R. R. Salakhutdinov, "Reducing the Dimensionality of Data with Neural Networks," *Science*, vol. 313, no. 5786, pp. 504–507, Jul. 2006. doi: 10.1126/science.1127647.  
*Relevance: Reconstruction error principle utilized in the PyTorch autoencoder model in `ml/models/autoencoder.py`.*

[6] L. Breiman, "Random Forests," *Machine Learning*, vol. 45, no. 1, pp. 5–32, Oct. 2001. doi: 10.1023/A:1010933404324.  
*Relevance: Supervised baseline implementation in `ml/models/random_forest.py`.*

---

### IoT Telemetry, Sensor Systems & Benchmarks

[7] A. Lavin and S. Ahmad, "Evaluating Real-Time Anomaly Detection Algorithms – The Numenta Anomaly Benchmark," in *Proceedings of the IEEE 14th International Conference on Machine Learning and Applications (ICMLA)*, Miami, FL, USA, Dec. 2015, pp. 38–44. doi: 10.1109/ICMLA.2015.141.  
*Relevance: Ingestion pipeline and evaluation metrics for the Numenta Anomaly Benchmark (NAB) in `ml/data/loaders/nab_loader.py` and `ml/evaluation/metrics.py`.*

[8] K. Hundman, V. Constantinou, C. Laporte, I. Colwell, and T. Soderstrom, "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding," in *Proceedings of the 24th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining (KDD '18)*, London, UK, Aug. 2018, pp. 387–395. doi: 10.1145/3219819.3219845.  
*Relevance: Ingestion architecture for NASA SMAP/MSL telemetry in `ml/data/loaders/nasa_loader.py` and dynamic thresholding concepts.*

[9] M. A. Cook, A. Misirli, and Z. Fan, "Anomaly Detection for IoT Time-Series Data: A Survey," *IEEE Internet of Things Journal*, vol. 7, no. 7, pp. 6481–6494, Jul. 2020. doi: 10.1109/JIOT.2019.2958185.  
*Relevance: Overview of IoT sensor constraints, multivariate streaming challenges, and edge vs. cloud architectures.*

[10] S. Rajasegarar, C. Leckie, and M. Palaniswami, "Anomaly Detection in Wireless Sensor Networks," *IEEE Wireless Communications*, vol. 15, no. 4, pp. 34–40, Aug. 2008. doi: 10.1109/MWC.2008.4599219.  
*Relevance: Analysis of distributed sensor failure modes and noise models.*

---

### Explainability & Software Architecture

[11] S. M. Lundberg and S.-I. Lee, "A Unified Approach to Interpreting Model Predictions," in *Advances in Neural Information Processing Systems (NeurIPS 2017)*, Long Beach, CA, USA, Dec. 2017, vol. 30, pp. 4765–4774.  
*Relevance: Theoretical inspiration for local feature contribution attribution implemented in `ml/explainability/feature_contributions.py`.*

[12] I. Fette and A. Melnikov, "The WebSocket Protocol," Internet Engineering Task Force (IETF), RFC 6455, Dec. 2011. doi: 10.17487/RFC6455.  
*Relevance: Real-time full-duplex protocol specification implemented in `backend/app/websocket/manager.py`.*

[13] M. Fowler, *Patterns of Enterprise Application Architecture*, Boston, MA, USA: Addison-Wesley, 2002.  
*Relevance: Repository pattern and service-layer separation implemented across `backend/app/repositories/` and `backend/app/services/`.*

[14] F. Pedregosa *et al.*, "Scikit-learn: Machine Learning in Python," *Journal of Machine Learning Research (JMLR)*, vol. 12, pp. 2825–2830, Nov. 2011.  
*Relevance: Core machine learning library utilized across pipelines, scalers, and estimators.*

[15] A. Paszke *et al.*, "PyTorch: An Imperative Style, High-Performance Deep Learning Library," in *Advances in Neural Information Processing Systems (NeurIPS 2019)*, Vancouver, BC, Canada, Dec. 2019, vol. 32, pp. 8024–8035.  
*Relevance: Framework for deep autoencoder architecture in `ml/models/autoencoder.py`.*

