"""CLI script to validate IoT datasets and produce JSON quality reports."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.data.validation.quality_report import QualityReporter


def main():
    parser = argparse.ArgumentParser(
        description="Validate IoT sensor datasets and generate audit quality reports."
    )
    parser.add_argument("--input", "-i", type=str, required=True, help="Input CSV or Parquet file path")
    parser.add_argument("--report", "-r", type=str, default=None, help="Output JSON quality report path")

    args = parser.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"Error: Input file does not exist: {in_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading dataset: {in_path}...")
    if in_path.suffix.lower() == ".csv":
        df = pd.read_csv(in_path)
    elif in_path.suffix.lower() in [".parquet", ".pq"]:
        df = pd.read_parquet(in_path)
    else:
        print(f"Error: Unsupported file format {in_path.suffix}. Expected .csv or .parquet", file=sys.stderr)
        sys.exit(1)

    # Convert timestamp column if present
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    reporter = QualityReporter()
    report = reporter.generate_report(df)

    print("\n================ DATASET QUALITY AUDIT ================")
    print(f"Status:          {'VALID' if report.is_valid else 'INVALID'}")
    print(f"Rows:            {report.row_count:,}")
    print(f"Columns:         {report.column_count}")
    print(f"Devices:         {', '.join(report.devices) if report.devices else 'None'}")
    print(f"Features:        {', '.join(report.features)}")
    print(f"Duplicates:      {report.duplicate_rows_count}")
    print(f"Time Range:      {report.timestamp_start} -> {report.timestamp_end}")
    print(f"Median Interval: {report.median_sampling_interval_seconds}s")

    if report.anomaly_summary.get("has_ground_truth"):
        print(f"Anomalies:       {report.anomaly_summary['total_anomalies']} ({report.anomaly_summary['anomaly_ratio']:.2%})")
        print(f"Breakdown:       {report.anomaly_summary['breakdown_by_type']}")

    if report.errors:
        print("\nERRORS DETECTED:")
        for err in report.errors:
            print(f"  [ERROR] {err['check_name']}: {err['message']}")

    if report.warnings:
        print("\nWARNINGS:")
        for w in report.warnings:
            print(f"  [WARN]  {w['check_name']}: {w['message']}")

    if args.report:
        rep_path = Path(args.report)
        report.save(rep_path)
        print(f"\nDetailed JSON report written to: {rep_path}")

    sys.exit(0 if report.is_valid else 1)


if __name__ == "__main__":
    main()
