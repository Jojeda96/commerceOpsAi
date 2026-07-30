import sys
import os

ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ml_service_dir not in sys.path:
    sys.path.insert(0, ml_service_dir)
