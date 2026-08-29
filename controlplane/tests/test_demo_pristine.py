"""The 10-act demo must not dirty the working tree: it rewrites packs on a
temp copy, so every byte under policies/ is unchanged after a full run."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_demo_leaves_policies_untouched():
    policy_files = sorted((ROOT / "policies").rglob("*.*"))
    assert policy_files, "no policy files found"
    before = {p: p.read_bytes() for p in policy_files}
    proc = subprocess.run([sys.executable, "-m", "demo.run_demo"],
                          cwd=ROOT, capture_output=True, timeout=300)
    assert proc.returncode == 0, proc.stderr.decode(errors="replace")[-2000:]
    after = {p: p.read_bytes() for p in sorted((ROOT / "policies").rglob("*.*"))}
    assert after == before
