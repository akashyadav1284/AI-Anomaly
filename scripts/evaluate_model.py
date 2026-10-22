"""CLI script to evaluate a saved model artifact on an evaluation dataset."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.training.artifacts import ModelArtifactManager
from ml.evaluation.metrics import compute_point_metrics, compute_event_metrics
from ml.data.schemas import COL_GROUND_TRUTH


def main():
    parser = argparse.ArgumentParser(description="Evaluate a saved model artifact on test telemetry.")
    parser.add_argument("--artifact", required=True, help="Directory containing model.joblib and metadata.json")
    parser.add_argument("--dataset", required=True, help="Path to evaluation CSV or Parquet dataset")
    parser.add_argument("--output-report", default=None, help="Optional JSON path to save evaluation report")

    args = parser.parse_args()
    art_path = Path(args.artifact)
    data_path = Path(args.dataset)

    if not art_path.exists():
        print(f"Error: Artifact directory not found: {art_path}", file=sys.stderr)
        sys.exit(1)
    if not data_path.exists():
        print(f"Error: Dataset not found: {data_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading artifact from {art_path}...")
    model, pipeline, metadata = ModelArtifactManager.load(art_path)

    print(f"Loading evaluation dataset from {data_path}...")
    if data_path.suffix.lower() == ".csv":
        df = pd.read_csv(data_path)
    else:
        df = pd.read_parquet(data_path)

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # Preprocess using fitted pipeline
    X = pipeline.transform(df)
    preds = model.predict(X)

    print("\n================ EVALUATION SUMMARY ================")
    print(f"Model:           {metadata.get('model_name')}")
    print(f"Threshold:       {preds.threshold:.4f}")
    print(f"Total Rows:      {len(df):,}")
    print(f"Flagged Anomalies: {int(preds.binary_labels.sum()):,} ({preds.binary_labels.mean():.2%})")

    report_dict = {
        "model_name": metadata.get("model_name"),
        "threshold": preds.threshold,
        "rows_evaluated": len(df),
        "anomalies_flagged": int(preds.binary_labels.sum()),
    }

    if COL_GROUND_TRUTH in df.columns:
        y_true = df[COL_GROUND_TRUTH].to_numpy()
        point_m = compute_point_metrics(y_true, preds.binary_labels, scores=preds.normalized_scores)
        event_m = compute_event_metrics(y_true, preds.binary_labels)

        print("\nClassification Metrics:")
        print(f"  Precision:     {point_m.precision:.4f}")
        print(f"  Recall:        {point_m.recall:.4f}")
        print(f"  F1 Score:      {point_m.f1:.4f}")
        if point_m.pr_auc is not None:
            print(f"  PR-AUC:        {point_m.pr_auc:.4f}")
        print(f"  Event Recall:  {event_m.event_recall:.2%}")
        print(f"  Mean Delay:    {event_m.mean_detection_delay_steps:.1f} steps")

        report_dict["point_metrics"] = point_m.to_dict()
        report_dict["event_metrics"] = event_m.to_dict()

    if args.output_report:
        rep_p = Path(args.output_report)
        rep_p.parent.mkdir(parents=True, exist_ok=True)
        with open(rep_p, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, indent=2)
        print(f"\nReport written to: {rep_p}")


if __name__ == "__main__":
    main()
