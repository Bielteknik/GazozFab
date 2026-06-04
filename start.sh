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

# 1. Node.js bağımlılık kontrolü
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[Node] node_modules klasörü bulunamadı. Bağımlılıklar yükleniyor...${NC}"
    npm install
fi

# 2. Python Sanal Ortam (venv) kontrolü
if [ ! -d "backend/pzoz_venv" ]; then
    echo -e "${YELLOW}[Python] Sanal ortam (pzoz_venv) bulunamadı. Oluşturuluyor...${NC}"
    python3 -m venv backend/pzoz_venv
    source backend/pzoz_venv/bin/activate
    echo -e "${YELLOW}[Python] Kütüphaneler yükleniyor...${NC}"
    pip install -r backend/requirements.txt
else
    source backend/pzoz_venv/bin/activate
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

echo -e "${GREEN}[Sistem] Ön Yüz (Vite: 3000) ve Arka Yüz (Python: 8000) eşzamanlı başlatılıyor...${NC}"
echo -e "${BLUE}------------------------------------------------------${NC}"

# Ön yüzü başlat ve PID'sini al
npm run dev:frontend &
FRONTEND_PID=$!

# Arka yüzü başlat ve PID'sini al
npm run dev:backend &
BACKEND_PID=$!

# Süreçlerin bitmesini bekle
wait $FRONTEND_PID $BACKEND_PID
