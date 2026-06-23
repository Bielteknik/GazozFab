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
    ultrasonicDebounceMs INTEGER DEFAULT 100,
    ultrasonicMeasurementType TEXT DEFAULT 'CONTINUOUS', -- 'CONTINUOUS', 'CYCLE', 'CONSUMPTION'
    ultrasonicMeasurementIntervalMl INTEGER DEFAULT 2000
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
    device TEXT DEFAULT 'NANO', -- 'RASPI', 'NANO'
    nanoId TEXT,
    relayInversion BOOLEAN DEFAULT 0, -- 0: Active High, 1: Active Low
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
    device TEXT DEFAULT 'NANO', -- 'RASPI', 'NANO'
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

-- 9. Sistem Canlı Durum Tablosu (system_state)
-- Sistemin anlık operasyonel durumlarını saklar. Tek satırlık (id = 1) bir tablodur.
CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT DEFAULT 'BEKLEMEDE',
    autoState TEXT DEFAULT 'BEKLEMEDE',
    inputCount INTEGER DEFAULT 0,
    outputCount INTEGER DEFAULT 0,
    testInputCount INTEGER DEFAULT 0,
    testOutputCount INTEGER DEFAULT 0,
    tankLevelCm INTEGER DEFAULT 85,
    isWashingDone BOOLEAN DEFAULT 0,
    isWashingRequired BOOLEAN DEFAULT 0,
    stopAfterCycleRequested BOOLEAN DEFAULT 0,
    activePrompt TEXT DEFAULT NULL -- JSON string veya NULL
);

-- 10. Haberleşme / Sistem Logları Tablosu (terminal_logs)
CREATE TABLE IF NOT EXISTS terminal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    message TEXT NOT NULL
);

-- ====================================================================
-- BAŞLANGIÇ VERİLERİNİ TOHUMLAMA (SEED DATA)
-- ====================================================================
-- Varsayılan sistem ayarını ve durumunu oluştur
INSERT OR IGNORE INTO system_config (
    id, ultrasonicDevice, ultrasonicTrigPin, ultrasonicEchoPin, 
    ultrasonicMaxHeightCm, ultrasonicCriticalLowPercent, ultrasonicDebounceMs, 
    ultrasonicMeasurementType
) VALUES (1, 'GatesNano', '12', '13', 100, 15, 100, 'CONTINUOUS');

INSERT OR IGNORE INTO system_state (id) VALUES (1);

-- Donanım modüllerini tohumla (Nanos)
INSERT OR IGNORE INTO nanos (id, name, port, baudRate, status) VALUES ('GatesNano', 'GatesNano', '/dev/ttyUSB0', 115200, 'OFFLINE');
INSERT OR IGNORE INTO nanos (id, name, port, baudRate, status) VALUES ('ValvesNano', 'ValvesNano', '/dev/ttyUSB1', 115200, 'OFFLINE');

-- Varsayılan kapıları/kilitleri oluştur
INSERT OR IGNORE INTO gates (
    id, name, pin, dirPin, enablePin, stepsToOpen, stepsToClose, 
    speed, isOpen, enabled, device, nanoId
) VALUES ('inputGate', 'Giriş Kapısı', '5', '2', '8', 400, 400, 800, 0, 1, 'NANO', 'GatesNano');

INSERT OR IGNORE INTO gates (
    id, name, pin, dirPin, enablePin, stepsToOpen, stepsToClose, 
    speed, isOpen, enabled, device, nanoId
) VALUES ('outputGate', 'Çıkış Kapısı', '6', '3', '8', 600, 600, 800, 0, 1, 'NANO', 'GatesNano');

-- Varsayılan sayaç sensörlerini oluştur
INSERT OR IGNORE INTO sensors (id, name, type, pin, enabled, device, debounceMs, resistorType) 
VALUES ('SENS-IN', 'Giriş Lazeri', 'INPUT', '14', 1, 'GatesNano', 50, 'NONE');

INSERT OR IGNORE INTO sensors (id, name, type, pin, enabled, device, debounceMs, resistorType) 
VALUES ('SENS-OUT', 'Çıkış Lazeri', 'OUTPUT', '15', 1, 'GatesNano', 50, 'NONE');

-- Varsayılan valfleri oluştur (8 Valf - Active Low / relayInversion = 1)
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (10, 'Vana 1', '2', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (11, 'Vana 2', '3', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (12, 'Vana 3', '4', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (13, 'Vana 4', '5', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (14, 'Vana 5', '6', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (15, 'Vana 6', '8', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (16, 'Vana 7', '9', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);
INSERT OR IGNORE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) 
VALUES (17, 'Vana 8', '10', 1, 0, 'CONTINUOUS', 660, 'NANO', 'ValvesNano', 0);

-- Varsayılan bir adet reçete tohumla
INSERT OR IGNORE INTO recipes (id, name, description, targetCount, fillTimeMs, volumeMl, settlingTimeMs, dripWaitTimeMs, valveDurations)
VALUES ('default_recipe', 'Standart 8li Reçete', 'Tüm valflerin 3 saniye açık kalacağı standart 8 şişelik dolum reçetesi.', 8, 660, 250, 150, 150, '{}');
