"""Temporary Stage 11 acceptance probe; removed by the follow-up commit."""

import subprocess


def run_user_command(command: str) -> str:
    """Run a caller-provided command and return its output."""
    completed = subprocess.run(
        command,
        shell=True,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout
