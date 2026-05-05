# eBPF Traffic Profiler & Dashboard

A comprehensive kernel-level network monitoring solution that captures per-user traffic using eBPF and visualizes it through a modern web dashboard.

## 🚀 Features

- **Kernel-Level Capture**: High-performance packet monitoring using eBPF programs.
- **Per-User Tracking**: Maps every network packet to the specific Linux User ID (UID) responsible for it.
- **Dual IP Support**: Full support for both IPv4 and IPv6 traffic.
- **Interactive Dashboard**: Modern React-based frontend for real-time traffic analysis.
- **Geographic Mapping**: Visualizes the geographical origin/destination of remote traffic.
- **Log Management**: Automated log rotation and per-user CSV reporting.
- **Traffic Filtering**: Customizable IP/CIDR masking to ignore local or irrelevant traffic.

---

## 🏗️ Architecture

The project is divided into three main layers:

1.  **Kernel Layer (eBPF)**: 
    - `traffic_meter.bpf.c` captures ingress/egress packets at the cgroup level.
    - Extracts UID, bytes, and IP addresses, then pushes events to a Ring Buffer.
2.  **User-Space Collector (C)**:
    - `traffic_meter_user.c` polls the Ring Buffer and writes raw logs to `/tmp/traffic_user_<nic>_<uid>.log`.
3.  **Dashboard Layer (Web)**:
    - **Backend (Node.js/Express)**: Parses raw logs, performs IP aggregation, and provides a REST API.
    - **Frontend (React/Vite)**: Interactive UI for visualizing "Top IPs", "Per-User Stats", and geographic maps.

---

## 🛠️ Prerequisites

### System Requirements
- **Linux Kernel 5.8+** (Required for Ring Buffer support)
- **Root/Sudo privileges** (Required to load eBPF programs)

### Dependencies
**Ubuntu/Debian**:
```bash
sudo apt install clang libbpf-dev libelf-dev zlib1g-dev nodejs npm
```

**Fedora/RHEL**:
```bash
sudo dnf install clang libbpf-devel elfutils-libelf-devel zlib-devel nodejs npm
```

---

## 🏃 Getting Started

### 1. Build and Run the eBPF Collector
First, compile the eBPF programs and the user-space loader:

```bash
# Build the project
make clean && make

# Start monitoring (specify your NIC, e.g., eth0, wlan0)
sudo ./traffic_meter_user /sys/fs/cgroup eth0
```
*Logs will be generated in `/tmp/traffic_user_eth0_*.log`.*

### 2. Start the Backend API
The backend serves the data from `/tmp` to the web dashboard.

```bash
cd backend
npm install
npm start
```
*API will run at `http://localhost:3001`.*

### 3. Launch the Web Dashboard
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## 📊 Dashboard Sections

- **Overview**: Real-time summary of discovered log files, total data processed, and active users.
- **Per User**: Detailed breakdown of network usage (ingress/egress) per Linux UID.
- **Top IPs**: Aggregated view of the most active remote peers, filtering out local network traffic.
- **Geo Map**: Interactive world map showing the geographical distribution of your traffic.
- **Raw Log**: Live preview of the most recent network events captured by the kernel.

---

## 🔍 Advanced Configuration

### Untracked IP Filtering
To ignore specific networks (like internal corporate ranges), edit `untracked_masks.h`. You can use the `ipmask_tool` to generate this file:

1. Create a file `ip_list.txt` with masks (e.g., `192.168.1.*`).
2. Run: `./ipmask_tool ip_list.txt > untracked_masks.h`
3. Recompile: `make clean && make`

### Log Location
By default, logs are read from `/tmp`. You can override this for the backend by creating a `.env` file in the `backend/` directory:
```env
LOG_DIR=/your/custom/log/path
PORT=3001
```

---

## 📜 License
This project is licensed under the **GPL-2.0-or-later**. eBPF programs using kernel helpers like `bpf_get_socket_uid` must be GPL-compliant.

## 🔗 References

  1. eBPF & Kernel Telemetry
   * ebpf.io (https://ebpf.io/): The definitive starting point for eBPF, explaining the architecture, safety, and the
     "Map" system.
   * BPF Compiler Collection (BCC) Reference Guide (https://github.com/iovisor/bcc/blob/master/docs/reference_guide.md):
     Excellent for understanding how to interact with network packets (skb) and UID attribution.
   * Libbpf-tools & Tutorials (https://libbpf.readthedocs.io/): Specifically for the ring_buffer API, which is the
     high-performance communication channel used in traffic_meter_user.c.

  2. Linux Networking & Cgroups
   * Linux Cgroup v2 Manual (https://man7.org/linux/man-pages/man7/cgroups.7.html): Information on how the
     /sys/fs/cgroup/ hierarchy works, which is where the eBPF program attaches to monitor specific users.
   * Kernel Documentation: BPF Cgroup Hooks (https://www.kernel.org/doc/html/latest/bpf/prog_cgroup_skb.html): Details
     on the BPF_PROG_TYPE_CGROUP_SKB hook used to capture ingress and egress traffic.

  3. Backend & Data Aggregation
   * Node.js Express Documentation (https://expressjs.com/): Used for building the REST API that parses the CSV logs and
     serves them to the frontend.
   * Multer Middleware (https://github.com/expressjs/multer): The library used in server.js to handle the
     multipart/form-data log uploads.
   * FreeIPAPI (https://freeipapi.com/): The external service used by the backend to resolve raw IP addresses into
     geographic locations (City, Country).

  4. Frontend & Visualization
   * React (Vite) Documentation (https://react.dev/): For building the interactive dashboard and managing the state of
     the parsed log rows.
   * Leaflet.js / React-Leaflet (https://react-leaflet.js.org/): The underlying map engine used in the "Geo Map"
     component to render IP locations.
   * Tailwind CSS (or Modern Vanilla CSS) (https://tailwindcss.com/): For the responsive, dark-themed dashboard layout
     and the "stat card" components.

  5. Standards & Protocols
   * RFC 791 (IPv4) (https://datatracker.ietf.org/doc/html/rfc791) & RFC 2460 (IPv6)
     (https://datatracker.ietf.org/doc/html/rfc2460): Foundational knowledge of IP headers used to write the parsing
     logic in traffic_meter.bpf.c.
   * GPL-2.0 License (https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html): The required license for any eBPF
     program utilizing "GPL-only" kernel helper functions like bpf_get_socket_uid.

