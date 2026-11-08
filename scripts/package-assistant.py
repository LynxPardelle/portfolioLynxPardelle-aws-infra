from pathlib import Path
import shutil
import subprocess
import sys


root = Path(__file__).resolve().parents[1]
source = root / "lambda" / "assistant"
target = root / ".assistant-build"
if target.exists():
    if target.is_symlink() or target.resolve().parent != root:
        raise ValueError("Unexpected assistant build directory")
    shutil.rmtree(target)
target.mkdir()
platforms = [option for version in range(34, 16, -1) for option in ("--platform", f"manylinux_2_{version}_x86_64")]
uv = sys.argv[1] if len(sys.argv) == 2 else shutil.which("uv")
installer = ([uv, "--system-certs", "pip", "install", "--python-platform", "x86_64-manylinux_2_34"] if uv else
             [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--only-binary=:all:", *platforms])
subprocess.run([*installer, "--python-version", "3.13", "--target", str(target), "-r", str(source / "requirements.lock")], check=True)
for file in source.glob("*.py"):
    shutil.copyfile(file, target / file.name)
