!/bin/bash

# setup_env.sh - Automated dependency installer for the eBPF Traffic Meter
set -e

echo "🔍 Detecting OS..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Could not detect OS. Please install dependencies manually."
    exit 1
fi

echo "📦 Installing dependencies for $OS..."

case $OS in
    ubuntu|debian|raspbian)
        sudo apt update
        sudo apt install -y clang libbpf-dev libelf-dev zlib1g-dev llvm \
                            build-essential pkg-config nodejs npm python3
        ;;
    fedora|rhel|centos)
        sudo dnf install -y clang libbpf-devel elfutils-libelf-devel zlib-devel \
                            llvm make gcc nodejs python3
        ;;
    *)
        echo "⚠️ Unsupported OS: $OS. You may need to install clang, libbpf, and libelf manually."
        ;;
esac

echo "✅ System dependencies installed."

echo "🌐 Setting up Backend..."
cd backend && npm install
cd ..

echo "🎨 Setting up Frontend..."
cd frontend && npm install
cd ..

echo "🚀 Setup complete! Use 'make' to build the eBPF programs."
                                                                                                                       45,1          Bot

