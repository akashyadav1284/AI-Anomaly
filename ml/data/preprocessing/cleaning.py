"""Data cleaning utilities separating validation from execution."""
from __future__ import annotations

from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from ml.data.schemas import (
    COL_DEVICE_ID,
    COL_TIMESTAMP,
    extract_features,
)


class DataCleaner:
    """Performs deterministic cleaning operations recording applied transformations."""

    def __init__(
        self,
        sort_chronologically: bool = True,
        drop_exact_duplicates: bool = True,
        imputation_strategy: str = "forward_fill",  # 'forward_fill', 'median', 'zero', 'none'
        clip_quantiles: Optional[tuple[float, float]] = None,
    ):
        self.sort_chronologically = sort_chronologically
        self.drop_exact_duplicates = drop_exact_duplicates
        self.imputation_strategy = imputation_strategy
        self.clip_quantiles = clip_quantiles
        self.fitted_medians: Dict[str, float] = {}

    def fit(self, df: pd.DataFrame) -> DataCleaner:
        """Fit statistical parameters (e.g. median) on training data only."""
        features = extract_features(df)
        for feat in features:
            self.fitted_medians[feat] = float(df[feat].median())
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply cleaning transformations returning a cleaned dataframe."""
        df_clean = df.copy()

        # 1. Deduplication
        if self.drop_exact_duplicates:
            df_clean = df_clean.drop_duplicates()

        # 2. Chronological ordering
        if self.sort_chronologically and COL_TIMESTAMP in df_clean.columns:
            sort_cols = [COL_TIMESTAMP]
            if COL_DEVICE_ID in df_clean.columns:
                sort_cols.append(COL_DEVICE_ID)
            df_clean = df_clean.sort_values(by=sort_cols).reset_index(drop=True)

        features = extract_features(df_clean)

        # 3. Replace inf/-inf with NaN
        for feat in features:
            df_clean[feat] = df_clean[feat].replace([np.inf, -np.inf], np.nan)

        # 4. Imputation
        if self.imputation_strategy == "forward_fill":
            # Group by device if available to avoid leaking values across distinct devices
            if COL_DEVICE_ID in df_clean.columns:
                df_clean[features] = df_clean.groupby(COL_DEVICE_ID)[features].ffill().bfill()
            else:
                df_clean[features] = df_clean[features].ffill().bfill()
        elif self.imputation_strategy == "median":
            for feat in features:
                med_val = self.fitted_medians.get(feat, df_clean[feat].median())
                df_clean[feat] = df_clean[feat].fillna(med_val)
        elif self.imputation_strategy == "zero":
            df_clean[features] = df_clean[features].fillna(0.0)

        # 5. Outlier clipping if specified
        if self.clip_quantiles:
            q_low, q_high = self.clip_quantiles
            for feat in features:
                lower = df_clean[feat].quantile(q_low)
                upper = df_clean[feat].quantile(q_high)
                df_clean[feat] = df_clean[feat].clip(lower=lower, upper=upper)

        return df_clean

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.fit(df).transform(df)
