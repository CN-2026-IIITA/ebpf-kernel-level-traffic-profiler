import random
import time
import os
from datetime import datetime

# Configuration
LOG_DIR = "../tmp"  # Should match backend's LOG_DIR
NICS = ["eth0", "wlan0", "enp0s3"]
UIDS = [1000, 1001, 1002]
SAMPLE_COUNT = 50

# Pre-defined remote IPs for realistic mapping
REMOTE_IPS = [
    "8.8.8.8", "1.1.1.1", "142.250.185.78", "20.205.243.166",
    "157.240.22.35", "185.199.108.153", "13.224.161.90",
    "104.16.248.249", "31.13.71.36", "172.217.16.142"
]

def generate_ip():
    return f"{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"

