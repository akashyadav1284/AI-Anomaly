"""CLI script to generate synthetic multivariate IoT sensor telemetry."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.data.generators.sensor_generator import IoTSensorGenerator
from ml.data.storage.dataset_writer import DatasetWriter
from ml.data.schemas import DatasetMetadata, extract_features
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic IoT sensor telemetry with physics-based patterns and anomalies."
    )
    parser.add_argument("--rows", type=int, default=5000, help="Number of observations per device (default: 5000)")
    parser.add_argument("--devices", type=int, default=2, help="Number of virtual IoT devices (default: 2)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--anomaly-rate", type=float, default=0.03, help="Target anomaly rate (default: 0.03)")
    parser.add_argument("--no-anomalies", action="store_true", help="Generate normal baseline data only")
    parser.add_argument(
        "--output",
        type=str,
        default="data/synthetic/iot_telemetry.csv",
        help="Destination path (.csv or .parquet) (default: data/synthetic/iot_telemetry.csv)",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing output file")

    args = parser.parse_args()

    device_ids = [f"sensor_node_{i+1:02d}" for i in range(args.devices)]
    generator = IoTSensorGenerator(random_state=args.seed)

    print(f"Generating synthetic telemetry: {args.rows} rows x {args.devices} devices (seed={args.seed})...")
    df = generator.generate(
        n_rows=args.rows,
        devices=device_ids,
        inject_anomalies=not args.no_anomalies,
        anomaly_rate=args.anomaly_rate,
    )

    out_path = Path(args.output)
    meta = DatasetMetadata(
        dataset_name=out_path.stem,
        dataset_id=generator.dataset_id,
        source="IoTSensorGenerator",
        description="Synthetic multi-device IoT telemetry generated via CLI",
        created_at=datetime.now(timezone.utc).isoformat(),
        row_count=len(df),
        column_count=len(df.columns),
        devices=device_ids,
        feature_names=extract_features(df),
        label_availability=not args.no_anomalies,
        anomaly_counts=df["anomaly_type"].value_counts().to_dict(),
    )

    saved_file = DatasetWriter.save(
        df=df,
        output_path=out_path,
        metadata=meta,
        overwrite=args.overwrite,
    )

    print(f"Dataset successfully created: {saved_file} ({len(df)} rows, {len(df.columns)} columns)")
    print(f"Metadata sidecar written: {saved_file.with_name(f'{saved_file.stem}.metadata.json')}")


if __name__ == "__main__":
    main()
