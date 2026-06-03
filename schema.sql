-- ====================================================================
-- GazozFab Otomasyon Projesi - Veritabanı Şeması (SQLite DDL)
-- Bu dosyayı DataGrip üzerinde doğrudan çalıştırabilirsiniz.
-- ====================================================================

-- 1. Arduino Donanım Tablosu (nanos)
-- Sisteme bağlı olan tüm alt Arduino Nano modüllerini tanımlar.
CREATE TABLE IF NOT EXISTS nanos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    port TEXT,
    baudRate INTEGER DEFAULT 9600,
    status TEXT DEFAULT 'OFFLINE'
);

-- 2. Sistem Yapılandırma Tablosu (system_config)
-- Tüm genel otomasyon parametrelerini saklar. Tek satırlık (id = 1) bir tablodur.
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Sadece tek bir yapılandırma satırı olmasını garanti eder.
    recipeId TEXT DEFAULT '',
    volumeMl INTEGER DEFAULT 0,
    targetCount INTEGER DEFAULT 0,
    fillTimeMs INTEGER DEFAULT 0,
    settlingTimeMs INTEGER DEFAULT 0,
    dripWaitTimeMs INTEGER DEFAULT 0,
    inputDebounceMs INTEGER DEFAULT 50,
    outputDebounceMs INTEGER DEFAULT 50,
    gateSpeedPercent INTEGER DEFAULT 100,
    watchdogTimeoutMs INTEGER DEFAULT 15000,
    maxRetries INTEGER DEFAULT 3,
    relayInversion BOOLEAN DEFAULT 0, -- 0: Active High, 1: Active Low
    autoRecovery BOOLEAN DEFAULT 1,
    manualValveMaxOpenTimeMs INTEGER DEFAULT 5000,
    logLevel TEXT DEFAULT 'INFO', -- 'DEBUG', 'INFO', 'WARN', 'ERROR'
    heartbeatIntervalMs INTEGER DEFAULT 5000,
    enableMqtt BOOLEAN DEFAULT 0,
    mqttBrokerUrl TEXT DEFAULT '',
    autoCleanEnabled BOOLEAN DEFAULT 0,
    autoCleanIntervalCount INTEGER DEFAULT 0,
    maxTemperatureThreshold REAL DEFAULT 60.0,
    voltageWarningLimit REAL DEFAULT 12.0,
    emergencyStopBehavior TEXT DEFAULT 'SAFE_HOME', -- 'FREEZE', 'RELEASE_PRESSURE', 'SAFE_HOME'
    washDurationMs INTEGER DEFAULT 30000,
    washValveIntervalMs INTEGER DEFAULT 2000,
    ultrasonicDevice TEXT DEFAULT 'RASPI',
    ultrasonicTrigPin TEXT DEFAULT '23',
    ultrasonicEchoPin TEXT DEFAULT '24',
    ultrasonicMaxHeightCm INTEGER DEFAULT 100,
    ultrasonicCriticalLowPercent INTEGER DEFAULT 15,
    ultrasonicDebounceMs INTEGER DEFAULT 100
);


-- 3. Reçeteler Tablosu (recipes)
-- Üretim reçetelerini ve dolum parametrelerini saklar.
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    targetCount INTEGER NOT NULL,
    fillTimeMs INTEGER NOT NULL,
    volumeMl INTEGER,
    settlingTimeMs INTEGER DEFAULT 150,
    dripWaitTimeMs INTEGER DEFAULT 150,
    valveDurations TEXT DEFAULT '{}' -- JSON string formatında saklanır. Örn: {"10": 1500, "11": 1200}
);

-- 4. Valf Yapılandırma Tablosu (valves)
-- Dolum valflerinin hangi denetleyiciye (Nano) ve hangi pinlere bağlı olduğunu dinamikleştirir.
CREATE TABLE IF NOT EXISTS valves (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    isOpen BOOLEAN DEFAULT 0,
    mode TEXT DEFAULT 'CONTINUOUS', -- 'CONTINUOUS', 'PULSE'
    pulseDuration INTEGER DEFAULT 1000,
    nanoId TEXT,
    FOREIGN KEY (nanoId) REFERENCES nanos(id) ON DELETE SET NULL
);

-- 5. Sayaç Sensörleri Tablosu (sensors)
-- Üretim hattındaki lazer sayıcı ve diğer durum sensörlerini tanımlar.
CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'INPUT': Giriş sayıcı, 'OUTPUT': Çıkış sayıcı
    pin TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    device TEXT DEFAULT 'RASPI', -- 'RASPI' veya Arduino Nano ID
    debounceMs INTEGER DEFAULT 50,
    resistorType TEXT DEFAULT 'NONE', -- 'NONE', 'PULLUP', 'PULLDOWN'
    FOREIGN KEY (device) REFERENCES nanos(id) ON DELETE SET NULL
);

-- 6. Kapı / Kilit Mekizmaları Tablosu (gates)
-- Şişe akışını kesen veya serbest bırakan nema 17 step motorlu kapı kilitlerini tanımlar.
CREATE TABLE IF NOT EXISTS gates (
    id TEXT PRIMARY KEY, -- 'inputGate', 'outputGate' veya ek kilit kimlikleri
    name TEXT NOT NULL,
    pin TEXT, -- Step pini (örn. D3)
    dirPin TEXT, -- Yön pini (örn. D4)
    enablePin TEXT, -- Motor güç kesme pini (örn. D5)
    stepsToOpen INTEGER DEFAULT 400,
    stepsToClose INTEGER DEFAULT 400,
    speed INTEGER DEFAULT 800,
    isOpen BOOLEAN DEFAULT 0,
    enabled BOOLEAN DEFAULT 1,
    nanoId TEXT,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (nanoId) REFERENCES nanos(id) ON DELETE SET NULL
);

-- 7. Üretim Döngü Geçmişi Tablosu (cycle_history)
-- Tamamlanan tüm dolum döngülerinin kayıtlarını analiz için tutar.
CREATE TABLE IF NOT EXISTS cycle_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipeId TEXT,
    timestamp TEXT NOT NULL, -- ISO 8601 YYYY-MM-DD HH:MM:SS formatında zaman damgası
    duration INTEGER NOT NULL, -- Döngünün toplam süresi (ms)
    inputCount INTEGER NOT NULL,
    outputCount INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS', 'COUNT_MISMATCH', 'EMERGENCY_STOP'
    FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL
);

-- 8. Aktif Alarm ve Arızalar Tablosu (active_alerts)
-- Sistemde meydana gelen aktif hata günlüklerini saklar.
CREATE TABLE IF NOT EXISTS active_alerts (
    id TEXT PRIMARY KEY, -- Hata benzersiz UUID veya timestamp kimliği
    code TEXT NOT NULL, -- Hata Kodu (örn. ERR_ULTRASONIC_LOW)
    message TEXT NOT NULL, -- Operatör mesajı
    severity TEXT NOT NULL, -- 'WARNING' (Uyarı) veya 'CRITICAL' (Kritik durdurma hatası)
    timestamp REAL NOT NULL, -- Epoch zaman damgası (saniye cinsinden)
    resolved BOOLEAN DEFAULT 0
);

-- ====================================================================
-- BAŞLANGIÇ VERİLERİNİ TOHUMLAMA (SEED DATA)
-- ====================================================================
-- Varsayılan sistem ayarını oluştur
INSERT OR IGNORE INTO system_config (id) VALUES (1);
