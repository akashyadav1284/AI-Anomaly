"""Dataset storage utilities supporting CSV, Parquet, SHA-256 checksums, and JSON metadata sidecars."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional, Union
import pandas as pd
from ml.data.schemas import DatasetMetadata, extract_features


def compute_file_sha256(filepath: Union[str, Path]) -> str:
    """Calculate SHA-256 hash of a file for data integrity and version verification."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


class DatasetWriter:
    """Saves dataframes to disk along with sidecar JSON metadata."""

    @staticmethod
    def save(
        df: pd.DataFrame,
        output_path: Union[str, Path],
        metadata: Optional[DatasetMetadata] = None,
        overwrite: bool = False,
        file_format: Optional[str] = None,
    ) -> Path:
        """Save dataset to CSV or Parquet and write metadata JSON sidecar.
        
        Args:
            df: Dataframe to persist.
            output_path: Target path (e.g. data/synthetic/demo.csv or demo.parquet).
            metadata: Optional DatasetMetadata object.
            overwrite: If False, raises FileExistsError when target already exists.
            file_format: Optional explicit format override ('csv' or 'parquet').
        """
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)

        if p.exists() and not overwrite:
            raise FileExistsError(f"Target file already exists: {p}. Set overwrite=True to replace.")

        fmt = (file_format or p.suffix.lstrip(".").lower()) or "csv"

        if fmt == "csv":
            df.to_csv(p, index=False)
        elif fmt in ["parquet", "pq"]:
            try:
                df.to_parquet(p, index=False)
            except ImportError as e:
                raise ImportError(
                    f"Parquet engine (pyarrow or fastparquet) is required for saving Parquet files: {e}"
                )
        else:
            raise ValueError(f"Unsupported export format: {fmt}. Must be 'csv' or 'parquet'.")

        # Compute checksum
        checksum = compute_file_sha256(p)

        # Write or update metadata sidecar
        meta_path = p.with_name(f"{p.stem}.metadata.json")
        if metadata:
            meta_dict = metadata.to_dict()
        else:
            features = extract_features(df)
            meta_dict = {
                "dataset_name": p.stem,
                "dataset_id": df.get("dataset_id", pd.Series(["unknown"])).iloc[0] if len(df) > 0 else "unknown",
                "row_count": len(df),
                "column_count": len(df.columns),
                "feature_names": features,
            }

        meta_dict["checksum_sha256"] = checksum
        meta_dict["saved_path"] = str(p.resolve())

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_dict, f, indent=2)

        return p
