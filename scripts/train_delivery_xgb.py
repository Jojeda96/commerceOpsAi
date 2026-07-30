import warnings
import sys
from pathlib import Path

warnings.warn("train_delivery_xgb.py is deprecated and will be removed in V5. Use train_delivery_champion.py instead.", DeprecationWarning, stacklevel=2)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.train_delivery_champion import train_pipeline

if __name__ == "__main__":
    train_pipeline()
