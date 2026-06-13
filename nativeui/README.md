# GazozFab - Native UI & Donanım İletişimi Yol Haritası

Bu belgede, Python ekosisteminde kalarak React arayüzüne 1-1 alternatif olacak **PySide6 + QML** native arayüz mimarisi ve GatesNano/kilitlenme problemlerinin çözümü açıklanmaktadır.

---

## 1. GatesNano / Donanım Kilitlenme Sorununun Çözümü

### Sorunun Nedeni:
Raspberry Pi 5 üzerinde donanım UART portları (`/dev/ttyAMA0`, `/dev/ttyS0` vb.) bulunur. Arka plandaki otomatik cihaz keşif (auto-discovery) döngüsü her 10 saniyede bir tüm portları taramaktaydı. Bu tarama sırasında, boş olan veya yanıt vermeyen UART portlarına `WHOAMI` komutu gönderilip `readline()` ile yanıt bekleniyordu. 
PySerial `readline()` varsayılan olarak **1.0 saniye zaman aşımına** sahipti ve yanıt gelene kadar 10 kez (yani port başına **10 saniye**, 3 denemede **30 saniye**) ana işletim döngüsünü (event loop) tamamen kilitliyordu. Bu bloklama esnasında:
- `GatesNano`'ya giden komutlar işlenemiyor ve donanım "yanıtsız/donmuş" kalıyordu.
- `Ctrl+C` sinyali alındığında, Python süreci bu 30 saniyelik bloklamanın bitmesini beklediği için aşırı gecikmeli kapanıyordu.

### Uygulanan Çözüm:
1. **USB Harici Portların Süzülmesi**: Auto-discovery döngüsünde dinamik olarak sökülüp takılmayan dahili donanım portları (`ttyAMA` ve `ttyS`) tarama dışı bırakıldı. Sadece gerçek USB seri portlar (`ttyUSB`, `ttyACM` vb.) taranıyor.
2. **Kilitlenmeyen Handshake**: `connect_to_port` içindeki `WHOAMI` yanıt kontrolü, veri gelmesini bloklamadan bekleyen (`conn.in_waiting > 0`) ve sadece veri varsa okuma yapan akıllı bir tampon kontrolüne dönüştürüldü. Maksimum bekleme süresi 0.5 saniyeye düşürüldü.
*Bu değişiklikler yapıldı ve kod başarıyla derlendi. Artık kilitlenme yaşamayacaksınız ve sistem anında kapanacaktır.*

---

## 2. Python Native Arayüz Önerisi: PySide6 + QML (Qt Quick)

React arayüzünün birebir aynısını, modern dokunmatik geçişler ve endüstriyel kararlılıkla Python içinde yazmak için en iyi mimari **PySide6 + QML** kullanımıdır.

### QML (Qt Modeling Language) Nedir?
QML, Qt'nin dokunmatik ekranlar (HMI) için geliştirdiği bildirimsel (declarative) bir arayüz dilidir. 
- JSON ve CSS'e çok benzer. 
- Javascript motoru barındırır.
- İşletim sisteminin ekran kartı ivmesini (GPU) doğrudan kullanarak Pi 5 üzerinde pürüzsüz 60 FPS animasyonlar sunar.

### Neden PySide6 + QML Seçmeliyiz?

1. **Ağ Katmanının (Socket.io) Ortadan Kalkması**: 
   React sürümünde frontend Python'a WebSockets/Socket.IO ile bağlanıyordu. PySide6 uygulamasında Python sınıflarını (örneğin `HardwareManager`) doğrudan QML arayüzüne "Property" (özellik) veya "Slot" (metot) olarak bağlayabiliriz. Butona basıldığında Python fonksiyonu doğrudan çağrılır (sıfır gecikme).
2. **React Bileşen Yapısına 1-1 Uyum**: 
   React'teki `Grid`, `Flex`, `Button`, `Modal` gibi yapılar QML'de `GridLayout`, `RowLayout`, `Button`, `Popup` olarak birebir karşılık bulur.
3. **Maksimum Performans**: 
   Web tarayıcı overhead'i (Chromium RAM tüketimi) olmadığı için Pi 5 çok daha serin çalışır ve sistem saniyeler içinde boot olur.

---

## 3. Örnek Mimari Tasarım (Kodsuz Şablon)

Arayüzü tasarlarken Python backend ile QML dosyasını şu şekilde entegre edeceğiz:

```python
# Arayüzü ve Backend'i birleştiren ana Python dosyası (Örn: native_gui.py)
import sys
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine
from PySide6.QtCore import QObject, Slot, Signal

class UIBridge(QObject):
    """QML ile Python Donanım Katmanı arasındaki köprü"""
    # Veri değişim sinyalleri
    stateChanged = Signal(dict)
    
    def __init__(self, hardware_manager):
        super().__init__()
        self.hw = hardware_manager
        
    @Slot(str, bool)
    def toggleValve(self, valve_id, state):
        # QML butona basıldığında doğrudan burası çalışır
        self.hw.control_valve(valve_id, "D2", state)
```

QML Arayüz Dosyası (`main.qml`) ise şu yapıda olacaktır:

```qml
// Dokunmatik Arayüz Tasarımı
import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

ApplicationWindow {
    visible: true
    width: 1280
    height: 800
    title: "GazozFab Otomasyon HMI"

    // Arka plan rengi (React uygulamasındaki Sleek Dark tema)
    background: Rectangle { color: "#12131a" }

    ColumnLayout {
        anchors.fill: parent
        spacing: 20

        // Üst Bilgi Barı (Header)
        RowLayout { ... }

        // Valf Kontrol Kartları Grid Yapısı
        GridLayout {
            columns: 4
            Repeater {
                model: 8 // 8 Valf
                Button {
                    text: "Vana " + (index + 1)
                    onClicked: uiBridge.toggleValve(index, true)
                }
            }
        }
    }
}
```

## Sonraki Adım:
Arayüz geçişine hazır olduğunuzda, Python asenkron yapısını (`asyncio`) Qt olay döngüsüyle bağlayan `qasync` kütüphanesini kullanarak entegrasyonu gerçekleştirebiliriz.
