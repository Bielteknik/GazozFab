# GazozFab - Şerbet Dolum Hattı Sistem İş Akış ve Karar Analizleri

Bu doküman, GazozFab şerbet dolum hattının çalışma prensiplerini, karar algoritmalarını ve hata yönetimi stratejilerini görsel diyagramlar ve matrisler aracılığıyla özetler. Kod blokları içermez, tamamen mantıksal sistem analizi üzerine odaklanmıştır.

---

## 1. SİSTEM ANA AKIŞ FLOWCHART

Sistemin donanım başlattıktan sonraki genel işleyiş ve döngüsünü gösteren temel akış şemasıdır.

```mermaid
flowchart TD
    A([Sistem Başlatıldı]) --> B{Mod Seçimi}
    B -- "OTOMATİK" --> C[Reçete Seçimi Yapılır]
    B -- "YARI-OTOMATİK" --> M[Kullanıcı Komutu Beklenir]
    
    C --> D[Giriş Kilidi Açılır]
    D --> E[Şişeler Sensörden Geçer]
    E --> F{Şişe Sayısı == Reçete Hedefi?}
    
    F -- "Hayır" --> E
    F -- "Evet" --> G[Giriş Kilidi Kapatılır]
    
    G --> H[1 Saniye Bekle]
    H --> I[Röleler Açılır - Şerbet Dolumu]
    I --> J[Dolum Süresi Bitti - Röleler Kapatılır]
    J --> K[1 Saniye Bekle]
    
    K --> L[Çıkış Kilidi Açılır]
    L --> N[Şişeler Çıkış Sensöründen Geçer]
    
    N --> O{Çıkan Şişe == Giren Şişe?}
    O -- "Hayır" --> N
    O -- "Evet" --> P[Çıkış Kilidi Kapatılır]
    P --> D
```

---

## 2. DURUM GEÇİŞ DİYAGRAMI (STATE TRANSITION)

Sistemin otomasyon esnasında hangi durumlardan (state) geçtiğini ve bu durumların olaylarla nasıl tetiklendiğini gösteren durum geçiş diyagramıdır.

```mermaid
stateDiagram-v2
    [*] --> BEKLEMEDE : Güç Verildi
    
    BEKLEMEDE --> SISE_GIRISI_BEKLENIYOR : Otomatik Mod Başlat (Reçete Seçili)
    
    SISE_GIRISI_BEKLENIYOR --> DOLUM_HAZIRLIK : Hedef Şişe Sayısına Ulaşıldı
    
    DOLUM_HAZIRLIK --> DOLUM_YAPILIYOR : 1 Sn Stabilizasyon Tamamlandı
    
    DOLUM_YAPILIYOR --> CIKIS_HAZIRLIK : Reçetedeki Dolum Süresi Bitti
    
    CIKIS_HAZIRLIK --> SISE_CIKISI_BEKLENIYOR : 1 Sn Stabilizasyon Tamamlandı
    
    SISE_CIKISI_BEKLENIYOR --> SISE_GIRISI_BEKLENIYOR : Çıkan Şişe Sayısı == Hedef Şişe Sayısı
    
    SISE_GIRISI_BEKLENIYOR --> ACIL_DURUS : E-Stop / Hata Sinyali
    DOLUM_YAPILIYOR --> ACIL_DURUS : E-Stop / Hata Sinyali
    SISE_CIKISI_BEKLENIYOR --> ACIL_DURUS : Timeout (Örn: 10sn) / Hata Sinyali
    
    ACIL_DURUS --> BEKLEMEDE : Reset / Hata Giderildi
```

---

## 3. KARAR AĞACI (DECISION TREE) - HATA YÖNETİMİ

Olası arıza durumlarında sistemin kilitlenmeleri ve donmaları engellemek için izlediği karar yolları.

```mermaid
flowchart TD
    Start((Sistem Kontrolü)) --> Q1{Pi 5 ile Nanolalar Arası İletişim Var mı?}
    
    Q1 -- "Hayır (Kopukluk)" --> A1[Nano Failsafe Devreye Girer]
    A1 --> A2[Tüm Röleler ve Kapılar Kapatılır]
    A2 --> A3(((Sistem Durduruldu)))
    
    Q1 -- "Evet" --> Q2{Girişte Aynı Şişe Çift Okundu mu? (Sensör Bounce)}
    
    Q2 -- "Evet" --> B1[Yazılımsal Debounce (<50ms) Filtresi Uygula]
    B1 --> B2[Sinyali Yok Say]
    B2 --> Q3
    Q2 -- "Hayır" --> Q3
    
    Q3{Çıkış Kapısı Açıkken Süre Aşımı (Timeout) Oldu mu?}
    
    Q3 -- "Evet (Şişe Devrildi/Okunmadı)" --> C1[Alarm Üret ve Operatöre Bildir]
    C1 --> C2[Sistemi Beklemeye Al - Sonraki Adıma Geçme]
    C2 --> C3(((Müdahale Bekleniyor)))
    
    Q3 -- "Hayır" --> Q4{Şerbet Tankı Seviyesi Kritik Düşük mü?}
    
    Q4 -- "Evet" --> D1[Dolum Yapılan Şişeleri Bitir]
    D1 --> D2[Yeni Şişe Alımını Durdur (Giriş Kilitle)]
    D2 --> D3(((Şerbet Dolumu Bekleniyor)))
    
    Q4 -- "Hayır" --> Normal(((Sistem Normal Çalışıyor)))
```

---

## 4. ZAMANLAMA DİYAGRAMI (TIMING DIAGRAM)

Bir tam otomasyon döngüsü içerisindeki sinyallerin (Motor, Sensör, Röle) zamana bağlı tepkilerini gösteren şema.

```mermaid
sequenceDiagram
    participant Pi5 as Raspberry Pi 5
    participant G_Sensor as Giriş Sayacı
    participant G_Motor as Giriş Kapısı (NEMA)
    participant Relay as Dolum Röleleri
    participant C_Motor as Çıkış Kapısı (NEMA)
    participant C_Sensor as Çıkış Sayacı
    
    Pi5->>G_Motor: AÇ Komutu Gönder
    G_Sensor-->>Pi5: 1. Şişe Geçti
    G_Sensor-->>Pi5: 2. Şişe Geçti
    Note over G_Sensor,Pi5: ... Hedef sayıya kadar (Örn: 8)
    G_Sensor-->>Pi5: 8. Şişe Geçti
    Pi5->>G_Motor: KAPAT Komutu Gönder
    
    Note over Pi5,Relay: 1 Saniye Bekleme (Şişe Stabilizasyonu)
    
    Pi5->>Relay: AÇ Komutu (Dolum Başlar)
    Note over Relay: Reçete Süresi Kadar Bekle (Örn: 600ms)
    Pi5->>Relay: KAPAT Komutu (Dolum Biter)
    
    Note over Pi5,C_Motor: 1 Saniye Bekleme (Damlamanın Bitmesi)
    
    Pi5->>C_Motor: AÇ Komutu Gönder
    C_Sensor-->>Pi5: 1. Şişe Çıktı
    C_Sensor-->>Pi5: ...
    C_Sensor-->>Pi5: 8. Şişe Çıktı
    Pi5->>C_Motor: KAPAT Komutu Gönder
    
    Note over Pi5: Döngü Başa Döner
```

---

## 5. KARAR TABLOSU (DECISION TABLE)

Farklı sistem durumlarına (Inputs) karşılık donanımların alması gereken reaksiyonlar (Outputs).

| Giriş Kapısı Durumu | Dolum İstasyonu | Çıkış Kapısı Durumu | Giren Şişe (Sayaç) | Çıkan Şişe (Sayaç) | Sistem Kararı / Yapılacak Aksiyon |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AÇIK** | Boş / Kapalı | **KAPALI** | `< Reçete Hedefi` | `0` | **Bekle:** Şişelerin geçişini saymaya devam et. |
| **AÇIK** | Boş / Kapalı | **KAPALI** | `== Reçete Hedefi` | `0` | **Aksiyon:** Giriş kapısını kapat, Dolum hazırlığına (1sn bekle) geç. |
| **KAPALI** | **AÇIK (Doluyor)** | **KAPALI** | `== Reçete Hedefi` | `0` | **Bekle:** Dolum süresinin bitmesini bekle. |
| **KAPALI** | Dolum Bitti | **KAPALI** | `== Reçete Hedefi` | `0` | **Aksiyon:** 1sn damlama beklemesi yap, Çıkış kapısını aç. |
| **KAPALI** | Dolum Bitti | **AÇIK** | `== Reçete Hedefi` | `< Giren Şişe` | **Bekle:** Şişelerin çıkışını saymaya devam et. Zaman aşımı kontrolü yap. |
| **KAPALI** | Dolum Bitti | **AÇIK** | `== Reçete Hedefi` | `== Giren Şişe` | **Aksiyon:** Çıkış kapısını kapat, Giriş kapısını aç, Sayaçları sıfırla. |
| *Fark Etmez* | *Fark Etmez* | *Fark Etmez* | `Timeout Alarmı` | *Eksik* | **Acil Müdahale:** Sisteme donma/hata kaydı düş, Moddan çık. |

---

## 6. ALTERNATİF AKIŞ - YARI OTOMATİK MOD

Sensörlerin veya döngüsel otomasyonun devre dışı olduğu, operatörün adımları kendi onay vererek yürüttüğü akış diyagramı.

```mermaid
flowchart TD
    S([Yarı Otomatik Mod Başlatıldı]) --> G1[Giriş Kapısı: Operatör 'AÇ' Butonuna Basar]
    
    G1 --> G2{Giriş Sayacı Hedefe Ulaştı mı?}
    G2 -- "Kendisi Kapanır" --> W1[Giriş Kapısı Kapanır]
    G2 -- "Operatör Manuel Kapatır" --> W1
    
    W1 --> D1[Operatör 'Sıralı' veya 'Eşzamanlı' Dolum Seçer]
    D1 --> D2[Operatör 'DOLUM BAŞLAT' Butonuna Basar]
    
    D2 --> D3[Sistem Belirtilen Süre Kadar Valfleri Açar ve Kapatır]
    
    D3 --> C1[Operatör 'ÇIKIŞ KAPI AÇ' Butonuna Basar]
    
    C1 --> C2{Çıkış Sayacı Hedefe Ulaştı mı?}
    C2 -- "Kendisi Kapanır" --> W2[Çıkış Kapısı Kapanır]
    C2 -- "Operatör Manuel Kapatır" --> W2
    
    W2 --> Z[Sayaçlar Operatör Tarafından Sıfırlanır]
    Z --> G1
```

---

## 7. ÖZET DURUM GEÇİŞ MATRİSİ

Mevcut duruma bir olayın/şartın (Event) uygulanmasıyla oluşacak yeni durumu özetleyen matris (State-Transition Matrix). Olayın ilgili durumda geçersiz olduğu yerler (-) ile belirtilmiştir.

| Mevcut Durum (Current State) | Olay 1: Otomatik Başlat | Olay 2: Hedef Şişe Girdi | Olay 3: Dolum Tamamlandı | Olay 4: Tüm Şişeler Çıktı | Olay 5: Hata / Acil Stop |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BEKLEMEDE** | `SISE_GIRISI_BEKLENIYOR` | - | - | - | - |
| **SISE_GIRISI_BEKLENIYOR** | - | `DOLUM_HAZIRLIK` | - | - | `ACIL_DURUS` |
| **DOLUM_HAZIRLIK** | - | - | `DOLUM_YAPILIYOR` (Süre Dolunca) | - | `ACIL_DURUS` |
| **DOLUM_YAPILIYOR** | - | - | `CIKIS_HAZIRLIK` | - | `ACIL_DURUS` |
| **CIKIS_HAZIRLIK** | - | - | - | `SISE_CIKISI_BEKLENIYOR` (1sn) | `ACIL_DURUS` |
| **SISE_CIKISI_BEKLENIYOR**| - | - | - | `SISE_GIRISI_BEKLENIYOR` | `ACIL_DURUS` (Timeout/Stop) |
| **ACIL_DURUS** | `BEKLEMEDE` (Reset Gerekir)| - | - | - | - |
