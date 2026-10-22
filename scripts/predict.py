"""CLI script to run inference with a saved model artifact and produce explanations."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.training.artifacts import ModelArtifactManager
from ml.explainability.feature_contributions import FeatureContributionExplainer
from ml.data.storage.dataset_writer import DatasetWriter


def main():
    parser = argparse.ArgumentParser(description="Run anomaly inference on unlabelled sensor data using a trained model.")
    parser.add_argument("--artifact", required=True, help="Path to saved model artifact directory")
    parser.add_argument("--input", required=True, help="Input CSV or Parquet telemetry file")
    parser.add_argument("--output", required=True, help="Output destination for prediction results")
    parser.add_argument("--explain", action="store_true", help="Generate feature attribution explanations")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output file if exists")

    args = parser.parse_args()
    art_path = Path(args.artifact)
    in_path = Path(args.input)

    if not art_path.exists():
        print(f"Error: Artifact directory not found: {art_path}", file=sys.stderr)
        sys.exit(1)
    if not in_path.exists():
        print(f"Error: Input dataset not found: {in_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading artifact from {art_path}...")
    model, pipeline, metadata = ModelArtifactManager.load(art_path)

    print(f"Loading input telemetry: {in_path}...")
    if in_path.suffix.lower() == ".csv":
        df = pd.read_csv(in_path)
    else:
        df = pd.read_parquet(in_path)

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    X = pipeline.transform(df)
    preds = model.predict(X)

    # Attach predictions
    df_out = df.copy()
    df_out["predicted_anomaly"] = preds.binary_labels
    df_out["anomaly_score"] = np.round(preds.normalized_scores, 4)

    if args.explain:
        print("Computing feature explanations for anomalies...")
        explainer = FeatureContributionExplainer(feature_names=pipeline.feature_names_)
        explainer.fit_baseline(X)

        summaries = []
        for i in range(len(df_out)):
            exp = explainer.explain_sample(
                sample_vec=X[i],
                sample_index=i,
                anomaly_score=float(preds.normalized_scores[i]),
                is_anomaly=bool(preds.binary_labels[i] == 1),
            )
            summaries.append(exp.summary)
        df_out["explanation"] = summaries

    DatasetWriter.save(df_out, args.output, overwrite=args.overwrite)
    print(f"\nInference complete! Saved predictions to: {args.output}")
    print(f"Total rows scored:    {len(df_out):,}")
    print(f"Anomalies detected:   {int(preds.binary_labels.sum()):,} ({preds.binary_labels.mean():.2%})")


if __name__ == "__main__":
    import numpy as np
    main()
