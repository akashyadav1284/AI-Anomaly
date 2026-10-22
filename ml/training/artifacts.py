"""Model artifact packaging, persistence, and safe validated loading."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union
import joblib
from ml.models.base import BaseAnomalyDetector, ModelMetadata
from ml.preprocessing.pipeline import MLFeaturePipeline


def compute_file_sha256(filepath: Union[str, Path]) -> str:
    """Calculate SHA-256 hash of a saved artifact file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


class ModelArtifactManager:
    """Safely saves and loads models, feature pipelines, and metadata sidecars."""

    @staticmethod
    def save(
        model: BaseAnomalyDetector,
        pipeline: MLFeaturePipeline,
        output_dir: Union[str, Path],
        metadata: Optional[ModelMetadata] = None,
        overwrite: bool = True,
    ) -> Path:
        """Persist model, feature pipeline, and JSON metadata sidecar."""
        out_p = Path(output_dir)
        out_p.mkdir(parents=True, exist_ok=True)

        model_file = out_p / "model.joblib"
        pipe_file = out_p / "pipeline.joblib"
        meta_file = out_p / "metadata.json"

        if not overwrite and (model_file.exists() or meta_file.exists()):
            raise FileExistsError(f"Artifact files already exist in {out_p}")

        # Save model and pipeline
        joblib.dump(model, model_file)
        joblib.dump(pipeline, pipe_file)

        # Compute checksum
        m_hash = compute_file_sha256(model_file)

        if metadata:
            meta_dict = metadata.to_dict()
        else:
            meta_dict = {
                "model_name": model.model_name,
                "model_version": model.model_version,
                "algorithm": model.model_name,
                "feature_names": model.feature_names,
                "threshold": model.threshold,
                "threshold_method": model.threshold_method,
            }

        meta_dict["checksum_sha256"] = m_hash
        meta_dict["saved_dir"] = str(out_p.resolve())

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta_dict, f, indent=2)

        return out_p

    @staticmethod
    def load(
        artifact_dir: Union[str, Path],
        verify_checksum: bool = True,
    ) -> Tuple[BaseAnomalyDetector, MLFeaturePipeline, Dict[str, Any]]:
        """Safely load trained model, preprocessing pipeline, and verified metadata sidecar."""
        p = Path(artifact_dir)
        model_file = p / "model.joblib"
        pipe_file = p / "pipeline.joblib"
        meta_file = p / "metadata.json"

        if not model_file.exists():
            raise FileNotFoundError(f"Model file not found: {model_file}")
        if not pipe_file.exists():
            raise FileNotFoundError(f"Pipeline file not found: {pipe_file}")
        if not meta_file.exists():
            raise FileNotFoundError(f"Metadata sidecar not found: {meta_file}")

        with open(meta_file, "r", encoding="utf-8") as f:
            meta_dict = json.load(f)

        if verify_checksum and "checksum_sha256" in meta_dict:
            actual_hash = compute_file_sha256(model_file)
            if actual_hash != meta_dict["checksum_sha256"]:
                raise ValueError(
                    f"Artifact checksum mismatch in {model_file}! Expected {meta_dict['checksum_sha256']}, got {actual_hash}"
                )

        model: BaseAnomalyDetector = joblib.load(model_file)
        pipeline: MLFeaturePipeline = joblib.load(pipe_file)

        return model, pipeline, meta_dict
