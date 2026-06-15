#!/bin/bash

# Renk tanımlamaları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # Renk sıfırlama

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}      GazozFab Otomatik Başlatıcı Kurulumu           ${NC}"
echo -e "${BLUE}======================================================${NC}"

PROJ_DIR="$(pwd)"

# 1. Standart XDG Autostart Desteği (.desktop dosyası)
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cp gazozfab.desktop "$AUTOSTART_DIR/gazozfab.desktop"
chmod +x "$AUTOSTART_DIR/gazozfab.desktop"

echo -e "${GREEN}[Başarılı] Standart XDG Başlatıcı yüklendi:${NC}"
echo -e "${YELLOW}$AUTOSTART_DIR/gazozfab.desktop${NC}"

# 2. Labwc (Modern Raspberry Pi OS varsayılanı) Desteği
LABWC_DIR="$HOME/.config/labwc"
mkdir -p "$LABWC_DIR"
if ! grep -q "GazozFab/start.sh" "$LABWC_DIR/autostart" 2>/dev/null; then
    echo -e "\n# GazozFab Otomasyonu otomatik baslatici\nbash $PROJ_DIR/start.sh &" >> "$LABWC_DIR/autostart"
    chmod +x "$LABWC_DIR/autostart"
    echo -e "${GREEN}[Başarılı] Labwc Autostart yapılandırması güncellendi.${NC}"
fi

# 3. Wayfire (Eski Raspberry Pi OS varsayılanı) Desteği
WAYFIRE_CONF="$HOME/.config/wayfire.ini"
if [ -f "$WAYFIRE_CONF" ]; then
    if ! grep -q "GazozFab" "$WAYFIRE_CONF"; then
        if grep -q "\[autostart\]" "$WAYFIRE_CONF"; then
            sed -i '/\[autostart\]/a gazozfab = bash '"$PROJ_DIR"'/start.sh' "$WAYFIRE_CONF"
        else
            echo -e "\n[autostart]\ngazozfab = bash $PROJ_DIR/start.sh" >> "$WAYFIRE_CONF"
        fi
        echo -e "${GREEN}[Başarılı] Wayfire Autostart yapılandırması güncellendi.${NC}"
    fi
fi

# Masaüstüne (Desktop) kısayol ekleme
DESKTOP_DIR="$HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
    cp gazozfab.desktop "$DESKTOP_DIR/gazozfab.desktop"
    chmod +x "$DESKTOP_DIR/gazozfab.desktop"
    echo -e "${GREEN}[Başarılı] Masaüstüne (Desktop) kısayol eklendi:${NC}"
    echo -e "${YELLOW}$DESKTOP_DIR/gazozfab.desktop${NC}"
else
    echo -e "${YELLOW}[Bilgi] Masaüstü (Desktop) klasörü bulunamadı, kısayol eklenemedi.${NC}"
fi

echo ""
echo -e "${BLUE}Bilgilendirme:${NC}"
echo -e "1. Pi 5 açıldığında projenin otomatik çalışabilmesi için desktop dosyasındaki"
echo -e "   Exec satırının projenizin gerçek yolunu gösterdiğinden emin olun."
echo -e "   Şu anki değer: $(grep Exec gazozfab.desktop)"
echo -e "2. Raspberry Pi 5'in açılışta masaüstüne otomatik giriş yapması için şu komutu çalıştırabilirsiniz:"
echo -e "   ${YELLOW}sudo raspi-config${NC} -> 1 System Options -> S5 Boot / Auto Login -> B4 Desktop Autologin"
echo -e "3. Masaüstündeki kısayolu ilk kez çalıştırırken çift tıkladığınızda açılan uyarıda"
echo -e "   ${GREEN}'Mark Executable'${NC} veya ${GREEN}'Trust and Launch'${NC} (Güven ve Çalıştır) seçeneğine tıklayın."
echo -e "${BLUE}======================================================${NC}"
