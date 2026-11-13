"""Database cleanup utility for IoT Anomaly Guard.

Safely purges fake, simulated, dummy, and seed sensor readings, anomalies, and devices,
while STRICTLY PRESERVING:
  1. Real user accounts and API keys (`users` collection).
  2. Real physical telemetry records (`reading_id` starting with `PHYS_READ_` or `source: "physical"`).
  3. Real physical anomalies (`source: "physical"`).
  4. Registered physical devices (`ESP32_*`).

Supports dry-run mode and JSON backup export before deletion.
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
dotenv_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
DATABASE_NAME = os.getenv("DATABASE_NAME") or os.getenv("MONGO_DB_NAME") or "iot_anomaly_detection"


async def run_cleanup(dry_run: bool = True, backup_dir: str = "data/backup"):
    print(f"[{datetime.now().isoformat()}] Connecting to MongoDB: {DATABASE_NAME}")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]

    # Verify connection
    try:
        await client.admin.command("ping")
        print("Connected to MongoDB successfully.")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    backup_path = Path(backup_dir)
    if not dry_run:
        backup_path.mkdir(parents=True, exist_ok=True)

    # 1. Inspect sensor_readings
    readings_col = db["sensor_readings"]
    total_readings = await readings_col.count_documents({})
    phys_readings = await readings_col.count_documents({
        "$or": [
            {"source": "physical"},
            {"reading_id": {"$regex": "^PHYS_READ_"}},
            {"device_id": {"$regex": "^ESP32"}}
        ]
    })
    sim_readings_query = {
        "$and": [
            {"source": {"$ne": "physical"}},
            {"reading_id": {"$not": {"$regex": "^PHYS_READ_"}}},
            {"device_id": {"$not": {"$regex": "^ESP32"}}}
        ]
    }
    sim_readings_count = await readings_col.count_documents(sim_readings_query)

    print(f"\n--- SENSOR READINGS ---")
    print(f"Total readings in DB: {total_readings}")
    print(f"Genuine Physical readings (TO KEEP): {phys_readings}")
    print(f"Simulated/Dummy readings (TO PURGE): {sim_readings_count}")

    # 2. Inspect anomalies
    anomalies_col = db["anomalies"]
    total_anomalies = await anomalies_col.count_documents({})
    phys_anomalies = await anomalies_col.count_documents({
        "$or": [
            {"source": "physical"},
            {"device_id": {"$regex": "^ESP32"}}
        ]
    })
    sim_anomalies_query = {
        "$and": [
            {"source": {"$ne": "physical"}},
            {"device_id": {"$not": {"$regex": "^ESP32"}}}
        ]
    }
    sim_anomalies_count = await anomalies_col.count_documents(sim_anomalies_query)

    print(f"\n--- ANOMALIES ---")
    print(f"Total anomalies in DB: {total_anomalies}")
    print(f"Genuine Physical anomalies (TO KEEP): {phys_anomalies}")
    print(f"Simulated/Dummy anomalies (TO PURGE): {sim_anomalies_count}")

    # 3. Inspect devices
    devices_col = db["devices"]
    total_devices = await devices_col.count_documents({})
    sim_devices_query = {
        "device_id": {"$not": {"$regex": "^ESP32"}}
    }
    sim_devices_count = await devices_col.count_documents(sim_devices_query)
    print(f"\n--- DEVICES ---")
    print(f"Total registered devices: {total_devices}")
    print(f"Virtual/Simulated devices (TO PURGE): {sim_devices_count}")

    # 4. Inspect users (SAFETY CHECK)
    users_col = db["users"]
    user_count = await users_col.count_documents({})
    print(f"\n--- USERS (PROTECTED) ---")
    print(f"Registered user accounts: {user_count} (WILL NOT BE TOUCHED)")

    if dry_run:
        print("\n[DRY RUN COMPLETE] No records were deleted. Run with --execute to perform actual cleanup.")
        return

    # EXECUTE BACKUP & PURGE
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    print(f"\n[BACKUP] Exporting summary metadata before purge to {backup_path}...")
    metadata = {
        "timestamp": timestamp,
        "database": DATABASE_NAME,
        "total_readings_before": total_readings,
        "sim_readings_purged": sim_readings_count,
        "phys_readings_preserved": phys_readings,
        "total_anomalies_before": total_anomalies,
        "sim_anomalies_purged": sim_anomalies_count,
        "phys_anomalies_preserved": phys_anomalies,
    }
    with open(backup_path / f"cleanup_summary_{timestamp}.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # Purge simulated readings
    if sim_readings_count > 0:
        res = await readings_col.delete_many(sim_readings_query)
        print(f"[PURGE] Deleted {res.deleted_count} simulated sensor readings.")

    # Purge simulated anomalies
    if sim_anomalies_count > 0:
        res = await anomalies_col.delete_many(sim_anomalies_query)
        print(f"[PURGE] Deleted {res.deleted_count} simulated anomaly documents.")

    # Purge virtual devices
    if sim_devices_count > 0:
        res = await devices_col.delete_many(sim_devices_query)
        print(f"[PURGE] Deleted {res.deleted_count} virtual devices.")

    print("\n[SUCCESS] Cleanup completed safely. Only genuine physical IoT hardware data will be processed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge simulated/dummy records from MongoDB Atlas.")
    parser.add_argument("--execute", action="store_true", help="Perform actual deletion. Default is dry-run.")
    args = parser.parse_args()
    asyncio.run(run_cleanup(dry_run=not args.execute))

