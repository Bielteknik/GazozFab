#!/bin/bash

# Renk tanımlamaları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # Renk sıfırlama

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}      GazozFab Otomatik Başlatıcı Kurulumu           ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Autostart dizinini kontrol et ve oluştur
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Masaüstü dosyasını kopyala
cp gazozfab.desktop "$AUTOSTART_DIR/gazozfab.desktop"
chmod +x "$AUTOSTART_DIR/gazozfab.desktop"

echo -e "${GREEN}[Başarılı] Başlatıcı kısayolu yüklendi:${NC}"
echo -e "${YELLOW}$AUTOSTART_DIR/gazozfab.desktop${NC}"
echo ""
echo -e "${BLUE}Bilgilendirme:${NC}"
echo -e "1. Pi 5 açıldığında projenin otomatik çalışabilmesi için desktop dosyasındaki"
echo -e "   Exec satırının projenizin gerçek yolunu gösterdiğinden emin olun."
echo -e "   Şu anki değer: $(grep Exec gazozfab.desktop)"
echo -e "2. Raspberry Pi 5'in açılışta masaüstüne otomatik giriş yapması için şu komutu çalıştırabilirsiniz:"
echo -e "   ${YELLOW}sudo raspi-config${NC} -> 1 System Options -> S5 Boot / Auto Login -> B4 Desktop Autologin"
echo -e "${BLUE}======================================================${NC}"
