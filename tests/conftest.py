import sys
import os

# Añadir la raíz del proyecto al sys.path para importaciones relativas en tests
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
