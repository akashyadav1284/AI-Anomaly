"""CLI script for model training and artifact export."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.training.trainer import ModelTrainer


def main():
    parser = argparse.ArgumentParser(description="Train an anomaly detection model and persist artifacts.")
    parser.add_argument("--dataset", required=True, help="Path to input training CSV or Parquet file")
    parser.add_argument(
        "--model",
        default="isolation_forest",
        choices=["isolation_forest", "statistical_zscore", "lof", "one_class_svm", "random_forest", "autoencoder"],
        help="Algorithm choice (default: isolation_forest)",
    )
    parser.add_argument("--output-dir", default=None, help="Directory to save model artifact and metadata")
    parser.add_argument("--scaler", default="standard", choices=["standard", "robust", "minmax", "none"])
    parser.add_argument("--time-features", action="store_true", help="Enable causal rolling and lag features")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument("--contamination", type=float, default=0.03, help="Estimated contamination rate (default: 0.03)")
    parser.add_argument(
        "--threshold-method",
        default="contamination",
        choices=["contamination", "quantile", "f1_optimal"],
    )

    args = parser.parse_args()
    data_path = Path(args.dataset)
    if not data_path.exists():
        print(f"Error: Dataset not found: {data_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading dataset: {data_path}...")
    if data_path.suffix.lower() == ".csv":
        df = pd.read_csv(data_path)
    else:
        df = pd.read_parquet(data_path)

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    out_dir = args.output_dir or f"artifacts/models/{args.model}"
    print(f"Starting training pipeline for '{args.model}' (seed={args.seed})...")

    trainer = ModelTrainer(random_state=args.seed)
    result = trainer.train(
        df=df,
        model_name=args.model,
        scaler_type=args.scaler,
        enable_time_features=args.time_features,
        threshold_method=args.threshold_method,
        contamination=args.contamination,
        output_dir=out_dir,
    )

    print("\n================ TRAINING SUMMARY ================")
    print(f"Model:           {args.model}")
    print(f"Threshold:       {result['model'].threshold:.4f} ({result['model'].threshold_method})")
    print(f"Features ({len(result['pipeline'].feature_names_)}):    {', '.join(result['pipeline'].feature_names_)}")
    print(f"Artifact Saved:  {result['saved_path']}")
    print(f"Train Time:      {result['duration_seconds']:.2f}s")

    metrics = result.get("metrics", {})
    if "point_metrics" in metrics:
        pm = metrics["point_metrics"]
        print("\nHeld-out Evaluation:")
        print(f"  Precision:     {pm['precision']:.4f}")
        print(f"  Recall:        {pm['recall']:.4f}")
        print(f"  F1 Score:      {pm['f1']:.4f}")
        if pm.get("pr_auc") is not None:
            print(f"  PR-AUC:        {pm['pr_auc']:.4f}")


if __name__ == "__main__":
    main()
