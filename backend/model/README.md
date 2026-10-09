# MoveBreak footfall model assets

Iteration 3 uses SQLite for runtime pedestrian sensors and modelled footfall
profiles. This directory keeps only the fitted model artifact and its audit
manifest:

```text
backend/model/
├── footfall_model_selected.joblib
└── asset_manifest.json
```

The modelling notebooks produce:

```text
movebreak_footfall_model_outputs/
├── model_ready_data.csv
└── tuning/
    ├── footfall_model_selected.joblib
    └── final_test_predictions.csv
```

Run the installer from the repository root or any other working directory:

```bash
python backend/prepare_footfall_model_assets.py \
  --outputs-dir /path/to/movebreak_footfall_model_outputs
```

The installer:

1. validates the trusted Joblib model contract and supported sensors;
2. validates prediction values and complete weekday/hour coverage;
3. aggregates predictions into 504 profiles (3 sensors × 7 days × 24 hours);
4. replaces only the `pedestrian_sensors` and `footfall_profiles` SQLite rows;
5. copies the fitted model artifact and writes a SHA-256 audit manifest.

The training-ready and final-test CSV files stay with the notebook outputs as
offline modelling evidence. They are not copied into the API and are not loaded
at runtime.

## Runtime behaviour

For each recommendation request, the API loads the three sensor rows and the
three relevant weekday/hour profiles once, then reuses them for every candidate
place. It rejects a signal when the nearest sensor is more than 500 metres away
and falls back to neutral suitability whenever a valid profile is unavailable.

The profile is historical model-informed context. It is not a live crowd
measurement or long-range forecast.
