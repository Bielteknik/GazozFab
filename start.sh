#!/bin/bash

# Renk tanımlamaları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # Renk sıfırlama

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}      GazozFab Otomasyon Sistemi Başlatılıyor         ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Kök dizine geç
cd "$(dirname "$0")"

# SSH / Uzaktan terminal oturumlarında tarayıcının Pi 5 yerel ekranında açılabilmesi için Display/Wayland tanımlamaları
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
fi
if [ -z "$WAYLAND_DISPLAY" ]; then
    export WAYLAND_DISPLAY=wayland-0
fi
if [ -z "$XDG_RUNTIME_DIR" ]; then
    export XDG_RUNTIME_DIR=/run/user/$(id -u bielteknik 2>/dev/null || id -u)
fi

echo -e "${YELLOW}[Mod] Web Arayüzü (React + WebSockets) modu aktif edildi.${NC}"


# 1. Node.js bağımlılık kontrolü
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[Node] node_modules klasörü bulunamadı. Bağımlılıklar yükleniyor...${NC}"
    npm install
fi

# 2. Python Sanal Ortam (venv) kontrolü
if [ ! -d "backend/pzoz_venv" ]; then
    echo -e "${YELLOW}[Python] Sanal ortam (pzoz_venv) bulunamadı. Oluşturuluyor...${NC}"
    python3 -m venv backend/pzoz_venv
    echo -e "${YELLOW}[Python] Kütüphaneler yükleniyor...${NC}"
    backend/pzoz_venv/bin/pip install -r backend/requirements.txt
fi

# 3. Port 8000 ve 3000'i kontrol et ve eğer meşgulse temizle
echo -e "${BLUE}[Port Check] Port 8000 ve 3000 kontrol ediliyor...${NC}"
PORT_8000_PID=$(lsof -t -i:8000)
if [ ! -z "$PORT_8000_PID" ]; then
    echo -e "${YELLOW}[Port Check] Port 8000 meşgul (PID: $PORT_8000_PID). Önceki işlem sonlandırılıyor...${NC}"
    kill -9 $PORT_8000_PID 2>/dev/null
fi
PORT_3000_PID=$(lsof -t -i:3000)
if [ ! -z "$PORT_3000_PID" ]; then
    echo -e "${YELLOW}[Port Check] Port 3000 meşgul (PID: $PORT_3000_PID). Önceki işlem sonlandırılıyor...${NC}"
    kill -9 $PORT_3000_PID 2>/dev/null
fi
PORT_1978_PID=$(lsof -t -i:1978)
if [ ! -z "$PORT_1978_PID" ]; then
    echo -e "${YELLOW}[Port Check] Port 1978 meşgul (PID: $PORT_1978_PID). Önceki işlem sonlandırılıyor...${NC}"
    kill -9 $PORT_1978_PID 2>/dev/null
fi

# Temizleme fonksiyonu
cleanup() {
    echo -e "\n${YELLOW}[Sistem] Kapatılıyor, tüm süreçler temizleniyor...${NC}"
    
    # Arka plandaki ana süreçleri sonlandır
    if [ ! -z "$FRONTEND_PID" ]; then
        kill -9 $FRONTEND_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill -9 $BACKEND_PID 2>/dev/null
    fi
    
    # Portları kullanan alt süreçleri kesin olarak temizle
    PORT_8000_PID=$(lsof -t -i:8000)
    if [ ! -z "$PORT_8000_PID" ]; then
        kill -9 $PORT_8000_PID 2>/dev/null
    fi
    
    PORT_3000_PID=$(lsof -t -i:3000)
    if [ ! -z "$PORT_3000_PID" ]; then
        kill -9 $PORT_3000_PID 2>/dev/null
    fi
    
    PORT_1978_PID=$(lsof -t -i:1978)
    if [ ! -z "$PORT_1978_PID" ]; then
        kill -9 $PORT_1978_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}[Sistem] Tüm süreçler başarıyla kapatıldı.${NC}"
    exit 0
}

# Sinyalleri yakala (CTRL+C, Kapatma vb.)
trap cleanup INT TERM EXIT

# 1. Arka Yüzü (Backend) Başlat
echo -e "${GREEN}[Backend] Arka Yüz (Python: 8000) arka planda başlatılıyor...${NC}"
cd backend
./pzoz_venv/bin/python3 -u main.py > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Backend'in hazır olmasını (Port 8000) bekle
echo -e "${YELLOW}[Backend] Port 8000'in hazır olması bekleniyor...${NC}"
until curl -s http://localhost:8000/ >/dev/null 2>&1 || nc -z localhost 8000 >/dev/null 2>&1; do
    sleep 0.5
done
echo -e "${GREEN}[Backend] Arka Yüz başarıyla açıldı ve hazır!${NC}"

# 2. Ön Yüzü (Frontend) Başlat
echo -e "${GREEN}[Frontend] Ön Yüz (Vite: 3000) arka planda başlatılıyor...${NC}"
npm run dev:frontend > frontend.log 2>&1 &
FRONTEND_PID=$!

# Frontend'in hazır olmasını (Port 3000) bekle
echo -e "${YELLOW}[Frontend] Port 3000'in hazır olması bekleniyor...${NC}"
until curl -s http://localhost:3000/ >/dev/null 2>&1 || nc -z localhost 3000 >/dev/null 2>&1; do
    sleep 0.5
done
echo -e "${GREEN}[Frontend] Ön Yüz başarıyla açıldı ve hazır!${NC}"

# 3. Web Tarayıcısını Aç
echo -e "${GREEN}[Sistem] Web tarayıcısı otomatik açılıyor...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
else
    # Linux (Pi 5) üzerinde çalışıyorsak tam ekran modunda aç
    if command -v chromium-browser &> /dev/null; then
        chromium-browser --start-maximized --noerrdialogs --disable-infobars http://localhost:3000 &
    elif command -v chromium &> /dev/null; then
        chromium --start-maximized --noerrdialogs --disable-infobars http://localhost:3000 &
    else
        xdg-open http://localhost:3000 &
    fi
fi

# Süreçlerin bitmesini bekle (Script'in açık kalması ve CTRL+C ile sonlanması için)
wait $BACKEND_PID $FRONTEND_PID
