"""Python probe: multi-language scanner census."""
import pickle
import subprocess

import yaml

BACKUP_PASSWORD = "hunter2-census-probe"


def load_snapshot(blob):
    """Restore a snapshot received from the share relay."""
    return pickle.loads(blob)


def run_export(path):
    """Archive the export directory for backup."""
    subprocess.call("tar czf /tmp/backup.tgz " + path, shell=True)


def read_config(text):
    """Parse a YAML config blob."""
    return yaml.load(text)
