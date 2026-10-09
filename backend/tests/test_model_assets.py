import json

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import FootfallProfile, PedestrianSensor
from prepare_footfall_model_assets import install_assets


def test_model_assets_are_validated_and_installed(tmp_path):
    outputs = tmp_path / "outputs"
    tuning = outputs / "tuning"
    tuning.mkdir(parents=True)

    fitted_model = DummyRegressor(strategy="mean").fit(
        np.array([[1.0], [2.0]]),
        np.array([100.0, 120.0]),
    )
    artifact = {
        "model": fitted_model,
        "model_name": "test-model",
        "feature_columns": ["count_lag_1"],
        "sensor_ids": [17, 19, 79],
        "target": "count",
        "parameters": {},
    }
    joblib.dump(artifact, tuning / "footfall_model_selected.joblib")

    local_hours = pd.date_range(
        "2026-10-05T00:00:00+11:00",
        periods=7 * 24,
        freq="h",
    )
    rows = [
        {
            "time_local": timestamp.isoformat(),
            "sensor_id": sensor_id,
            "count": 100 + hour_index,
            "selected_prediction": 98 + hour_index + sensor_index,
            "seasonal_prediction": 95 + hour_index,
        }
        for sensor_index, sensor_id in enumerate((17, 19, 79))
        for hour_index, timestamp in enumerate(local_hours)
    ]
    predictions = pd.DataFrame(rows)
    predictions.to_csv(tuning / "final_test_predictions.csv", index=False)

    destination = tmp_path / "installed"
    database_path = tmp_path / "movebreak.db"
    manifest_path = install_assets(outputs, destination, database_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert set(manifest["files"]) == {"footfall_model_selected.joblib"}
    assert manifest["audit"]["model"]["sensor_ids"] == [17, 19, 79]
    assert manifest["audit"]["sqlite_profile"]["rows"] == 504
    assert manifest["sqlite"]["sensor_rows"] == 3
    assert manifest["sqlite"]["profile_rows"] == 504
    assert (destination / "footfall_model_selected.joblib").is_file()

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    db = sessionmaker(bind=engine)()
    try:
        assert db.query(PedestrianSensor).count() == 3
        assert db.query(FootfallProfile).count() == 504
    finally:
        db.close()
        engine.dispose()
