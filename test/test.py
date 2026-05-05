import random
import time
import os
from datetime import datetime

# Configuration
LOG_DIR = "../tmp" 
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

def simulate():
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)
    
    print(f"🚀 Starting traffic simulation into {LOG_DIR}...")
    
    stats = {uid: {"in": 0, "out": 0} for uid in UIDS}

    for _ in range(SAMPLE_COUNT):
        uid = random.choice(UIDS)
        nic = random.choice(NICS)
        filename = f"traffic_user_{nic}_{uid}.log"
        filepath = os.path.join(LOG_DIR, filename)
        direction = "out" if random.random() > 0.4 else "in"
        bytes_sent = random.randint(40, 1500)
        
        # Local vs Remote
        local_ip = f"192.168.1.{uid - 900}"
        remote_ip = random.choice(REMOTE_IPS) if random.random() > 0.3 else generate_ip()
        
        src_ip = local_ip if direction == "out" else remote_ip
        dst_ip = remote_ip if direction == "out" else local_ip
        
        # Update cumulative totals
        if direction == "in":
            stats[uid]["in"] += bytes_sent
        else:
            stats[uid]["out"] += bytes_sent
            
        timestamp = time.time()
        
        # Format: direction,bytes,src_ip,dst_ip,timestamp,total_in,total_out
        log_line = f"{direction},{bytes_sent},{src_ip},{dst_ip},{timestamp:.9f},{stats[uid]['in']},{stats[uid]['out']}\n"
        
        with open(filepath, "a") as f:
            f.write(log_line)
            
        if _ % 10 == 0:
            print(f"  [+] Logged {direction} traffic for UID {uid} on {nic}")
            
    print("✅ Simulation complete. Logs are ready for the Dashboard.")

if __name__ == "__main__":
    simulate()
