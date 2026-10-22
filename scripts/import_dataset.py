"""CLI tool to import public or generic time-series datasets into standard format."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.data.loaders.nab_loader import NABLoader
from ml.data.loaders.nasa_loader import NASALoader
from ml.data.loaders.generic_csv_loader import GenericCSVLoader
from ml.data.storage.dataset_writer import DatasetWriter


def main():
    parser = argparse.ArgumentParser(
        description="Import and standardize public or generic time-series datasets."
    )
    parser.add_argument(
        "--source",
        choices=["nab", "nasa", "generic"],
        required=True,
        help="Source format type (nab, nasa, generic)",
    )
    parser.add_argument("--path", required=True, help="Path to input data file or directory")
    parser.add_argument("--output", required=True, help="Output destination (.csv or .parquet)")
    parser.add_argument("--labels", default=None, help="Optional labels file (JSON or CSV)")
    parser.add_argument("--timestamp-col", default="timestamp", help="Timestamp column name for generic loader")
    parser.add_argument("--device-id", default=None, help="Explicit device ID assignment")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing output file")

    args = parser.parse_args()
    input_path = Path(args.path)

    if not input_path.exists():
        print(f"Error: Specified input path does not exist: {input_path}", file=sys.stderr)
        print("Note: Public datasets must be downloaded locally before import.", file=sys.stderr)
        sys.exit(1)

    print(f"Importing {args.source.upper()} dataset from: {input_path}...")

    if args.source == "nab":
        loader = NABLoader(default_device_id=args.device_id)
        loaded = loader.load(source_path=input_path, labels_json_path=args.labels)
    elif args.source == "nasa":
        loader = NASALoader(channel_id=args.device_id)
        loaded = loader.load(source_path=input_path)
    elif args.source == "generic":
        loader = GenericCSVLoader(
            timestamp_col=args.timestamp_col,
            default_device_id=args.device_id or "device_01",
        )
        loaded = loader.load(source_path=input_path)
    else:
        print(f"Unsupported source: {args.source}", file=sys.stderr)
        sys.exit(1)

    out_file = DatasetWriter.save(
        df=loaded.data,
        output_path=args.output,
        metadata=loaded.metadata,
        overwrite=args.overwrite,
    )

    print(f"Dataset imported successfully: {out_file}")
    print(f"Rows: {loaded.metadata.row_count:,} | Columns: {loaded.metadata.column_count}")
    print(f"Features: {', '.join(loaded.metadata.feature_names)}")


if __name__ == "__main__":
    main()
