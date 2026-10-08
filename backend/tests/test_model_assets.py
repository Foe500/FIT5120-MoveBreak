import json

import joblib
import pandas as pd

from prepare_footfall_model_assets import install_assets


def test_model_assets_are_validated_and_installed(tmp_path):
    outputs = tmp_path / "outputs"
    tuning = outputs / "tuning"
    tuning.mkdir(parents=True)

    artifact = {
        "model": object(),
        "model_name": "test-model",
        "feature_columns": ["count_lag_1"],
        "sensor_ids": [17, 19, 79],
        "target": "count",
        "parameters": {},
    }
    joblib.dump(artifact, tuning / "footfall_model_selected.joblib")

    rows = [
        {
            "time_local": f"2026-10-08T0{index}:00:00+11:00",
            "sensor_id": sensor_id,
            "count": 100 + index,
            "count_lag_1": 90 + index,
        }
        for index, sensor_id in enumerate((17, 19, 79))
    ]
    pd.DataFrame(rows).to_csv(outputs / "model_ready_data.csv", index=False)

    predictions = pd.DataFrame(rows)
    predictions["selected_prediction"] = [98, 102, 105]
    predictions["seasonal_prediction"] = [95, 99, 101]
    predictions.to_csv(tuning / "final_test_predictions.csv", index=False)

    destination = tmp_path / "installed"
    manifest_path = install_assets(outputs, destination)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert set(manifest["files"]) == {
        "footfall_model_selected.joblib",
        "model_ready_data.csv",
        "final_test_predictions.csv",
    }
    assert manifest["audit"]["model"]["sensor_ids"] == [17, 19, 79]
    assert all((destination / filename).is_file() for filename in manifest["files"])
