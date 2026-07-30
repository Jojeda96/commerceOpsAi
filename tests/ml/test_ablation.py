import pytest
import pandas as pd
from scripts.ml.ablation import run_ablation_study

def test_ablation_study_runs_all_7_experiments():
    df = pd.DataFrame()
    res = run_ablation_study(df)
    assert len(res["experiments"]) == 7
    assert set(res["experiments"].keys()) == {"A", "B", "C", "D", "E", "F", "G"}
    assert res["best_experiment"] == "G"
