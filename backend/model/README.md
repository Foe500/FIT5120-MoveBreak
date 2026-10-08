# MoveBreak footfall model assets

Install the following files from the modelling notebook outputs into this
directory:

```text
backend/model/
├── footfall_model_selected.joblib
├── final_test_predictions.csv
└── model_ready_data.csv
```

Source locations after running the notebooks:

```text
movebreak_footfall_model_outputs/tuning/footfall_model_selected.joblib
movebreak_footfall_model_outputs/tuning/final_test_predictions.csv
movebreak_footfall_model_outputs/model_ready_data.csv
```

Preferred command from the repository root:

```bash
python backend/prepare_footfall_model_assets.py \
  --outputs-dir /path/to/movebreak_footfall_model_outputs
```

This validates file schemas, timestamps, sensors and the saved model contract,
then installs the three files and writes `asset_manifest.json` with checksums.

## Runtime behaviour

1. When the model and model-ready data contain an exact row for the requested
   sensor and hour, the API runs the saved tuned model against that historical
   feature row.
2. For other request times, the API uses a weekday/hour profile calculated from
   the tuned model's untouched final-test predictions.
3. If no assets are installed, or no supported sensor is within 500 metres, the
   recommendation endpoint keeps working with neutral footfall suitability.

The profile is model-informed historical context. It must not be described as a
live crowd measurement or long-range forecast. A live one-hour-ahead forecast
would require a scheduled pipeline that supplies current lagged counts and
request-time weather.

Do not add VISTA files here. VISTA is not part of the selected recommendation
architecture.
