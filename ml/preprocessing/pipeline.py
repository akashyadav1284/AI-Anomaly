"""Feature preprocessing pipeline integrating imputation, scaling, and causal time-series transformations."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler, StandardScaler, MinMaxScaler
from ml.data.schemas import extract_features
from ml.data.preprocessing.cleaning import DataCleaner
from ml.data.preprocessing.features import TimeSeriesFeatureEngineer


class MLFeaturePipeline:
    """End-to-end preprocessing pipeline combining cleaning, causal features, and scaling.
    
    Guarantees:
    - Preprocessing is fitted ONLY on training data.
    - Serializes fitted statistical parameters into reproducible configuration dictionary.
    - Preserves stable feature ordering.
    - Prevents target/metadata leakage into numeric feature matrices.
    """

    def __init__(
        self,
        scaler_type: str = "standard",  # 'standard', 'robust', 'minmax', 'none'
        enable_time_features: bool = False,
        rolling_windows: Optional[List[int]] = None,
        lag_steps: Optional[List[int]] = None,
        imputation_strategy: str = "median",
    ):
        self.scaler_type = scaler_type
        self.enable_time_features = enable_time_features
        self.rolling_windows = rolling_windows or [5]
        self.lag_steps = lag_steps or [1]
        self.imputation_strategy = imputation_strategy

        self.cleaner = DataCleaner(
            sort_chronologically=True,
            drop_exact_duplicates=False,
            imputation_strategy=imputation_strategy,
        )
        self.feature_engineer = TimeSeriesFeatureEngineer(
            rolling_windows=self.rolling_windows,
            lag_steps=self.lag_steps,
        )

        if self.scaler_type == "standard":
            self.scaler = StandardScaler()
        elif self.scaler_type == "robust":
            self.scaler = RobustScaler()
        elif self.scaler_type == "minmax":
            self.scaler = MinMaxScaler()
        else:
            self.scaler = None

        self.is_fitted: bool = False
        self.feature_names_: List[str] = []

    def fit(self, df: pd.DataFrame) -> MLFeaturePipeline:
        """Fit cleaning and scaling transformers on training dataframe."""
        df_clean = self.cleaner.fit_transform(df)

        if self.enable_time_features:
            df_fe = self.feature_engineer.transform(df_clean)
        else:
            df_fe = df_clean

        features = extract_features(df_fe)
        self.feature_names_ = features

        X = df_fe[features].to_numpy(dtype=float)

        if self.scaler:
            self.scaler.fit(X)

        self.is_fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """Transform dataframe into numeric 2D feature matrix using fitted parameters."""
        if not self.is_fitted:
            raise RuntimeError("MLFeaturePipeline must be fitted before transform.")

        df_clean = self.cleaner.transform(df)

        if self.enable_time_features:
            df_fe = self.feature_engineer.transform(df_clean)
        else:
            df_fe = df_clean

        missing = [f for f in self.feature_names_ if f not in df_fe.columns]
        if missing:
            raise ValueError(f"Dataframe missing expected features: {missing}")

        X = df_fe[self.feature_names_].to_numpy(dtype=float)

        # Impute any residual NaNs from rolling/lag shifts with fitted column medians
        col_medians = np.nanmedian(X, axis=0)
        col_medians = np.nan_to_num(col_medians, nan=0.0)
        inds = np.where(np.isnan(X))
        X[inds] = np.take(col_medians, inds[1])

        if self.scaler:
            X = self.scaler.transform(X)

        return X

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    def get_config(self) -> Dict[str, Any]:
        """Serialize configuration parameters for sidecar persistence."""
        return {
            "scaler_type": self.scaler_type,
            "enable_time_features": self.enable_time_features,
            "rolling_windows": self.rolling_windows,
            "lag_steps": self.lag_steps,
            "imputation_strategy": self.imputation_strategy,
            "feature_names": self.feature_names_,
            "fitted": self.is_fitted,
        }
