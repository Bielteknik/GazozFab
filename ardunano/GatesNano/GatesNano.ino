// Varsayılan pin tanımları (CNC Shield V3 fallback) New 15 HJaziran
// Eğer Pi5'ten CONFIG gelmezse bu varsayılan değerlerle çalışır.
int X_STEP = 5;
int X_DIR = 2;
int Y_STEP = 6;
int Y_DIR = 3;
int ENABLE_PIN = 8;
int SENSOR_X = 4; // Giriş Lazer Sensörü (D4)
int SENSOR_Y = 7; // Çıkış Lazer Sensörü (D7)

int stepDelay = 1000; // mikro saniye
long stepsX = 600;
long stepsY = 600;

// Non-blocking Seri Port Okuma Değişkenleri
String inputBuffer = "";

void (*resetFunc)(void) = 0; // Software reset function declaration

// Lazer Sensör Durum Takip Değişkenleri (Doğru Debounce ve Değişim Algılama)
int sensXState = HIGH; // Mevcut kararlı durum
int sensYState = HIGH;
int lastReadingX = HIGH; // Son okunan anlık değer
int lastReadingY = HIGH;
unsigned long lastDebounceTimeX = 0;
unsigned long lastDebounceTimeY = 0;
unsigned long debounceDelay = 50; // milisaniye

// --- Fonksiyon Tanımlamaları ---
void setupPins();
void motorStep(int stepPin, int dirPin, bool yon, long adim);
void durumGoster();
void menuGoster();
String getPart(String data, char separator, int index);
void parseConfig(String payload);
void processCommand(String cmd);
void readSerialNonBlocking();

void setupPins() {
  pinMode(X_STEP, OUTPUT);
  pinMode(X_DIR, OUTPUT);
  pinMode(Y_STEP, OUTPUT);
  pinMode(Y_DIR, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  pinMode(SENSOR_X, INPUT_PULLUP);
  pinMode(SENSOR_Y, INPUT_PULLUP);

  digitalWrite(
      ENABLE_PIN,
      HIGH); // Sessiz başla / sürücüyü devre dışı bırak (ısınmayı önleme)
}

void setup() {
  Serial.begin(115200);

  setupPins();

  // İlk durumları güncelle
  sensXState = digitalRead(SENSOR_X);
  sensYState = digitalRead(SENSOR_Y);
  lastReadingX = sensXState;
  lastReadingY = sensYState;

  delay(500);

  // Seri port açılış gürültülerini temizle
  while (Serial.available() > 0) {
    Serial.read();
  }

  // Kimlik Yayını (Pi5 keşfi için)
  Serial.println("ID:GatesNano;NAME:GatesNano");

  menuGoster();
}

void loop() {
  // 1. Lazer Sensör X (Giriş) Doğru Debounce Takibi (Kesintisiz)
  int readingX = digitalRead(SENSOR_X);
  if (readingX != lastReadingX) {
    lastDebounceTimeX = millis();
  }
  if ((millis() - lastDebounceTimeX) > debounceDelay) {
    if (readingX != sensXState) {
      sensXState = readingX;
      if (sensXState == LOW) {
        Serial.print("EVENT:PIN:D");
        Serial.print(SENSOR_X);
        Serial.println(":ACTIVE");
      } else {
        Serial.print("EVENT:PIN:D");
        Serial.print(SENSOR_X);
        Serial.println(":INACTIVE");
      }
    }
  }
  lastReadingX = readingX;

  // 2. Lazer Sensör Y (Çıkış) Doğru Debounce Takibi (Kesintisiz)
  int readingY = digitalRead(SENSOR_Y);
  if (readingY != lastReadingY) {
    lastDebounceTimeY = millis();
  }
  if ((millis() - lastDebounceTimeY) > debounceDelay) {
    if (readingY != sensYState) {
      sensYState = readingY;
      if (sensYState == LOW) {
        Serial.print("EVENT:PIN:D");
        Serial.print(SENSOR_Y);
        Serial.println(":ACTIVE");
      } else {
        Serial.print("EVENT:PIN:D");
        Serial.print(SENSOR_Y);
        Serial.println(":INACTIVE");
      }
    }
  }
  lastReadingY = readingY;

  // 3. Seri Porttan Gelen Komutları Oku (Non-blocking / Kesintisiz)
  readSerialNonBlocking();
}

// Non-blocking Seri Okuma Fonksiyonu (EMI / Gürültü Filtreli)
void readSerialNonBlocking() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
      }
      inputBuffer = ""; // Tamponu temizle
    } else if (c >= 32 && c <= 126) {
      inputBuffer += c; // Sadece standart okunabilir karakterleri tampona ekle
                        // (gürültüyü filtrele)
    }
  }
}

// String bölme yardımcısı
String getPart(String data, char separator, int index) {
  int found = 0;
  int strIndex[] = {0, -1};
  int maxIndex = data.length() - 1;

  for (int i = 0; i <= maxIndex && found <= index; i++) {
    if (data.charAt(i) == separator || i == maxIndex) {
      found++;
      strIndex[0] = strIndex[1] + 1;
      strIndex[1] = (i == maxIndex) ? i + 1 : i;
    }
  }
  return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}

// Motor Adım Atma Fonksiyonu
void motorStep(int stepPin, int dirPin, bool yon, long adim) {
  digitalWrite(ENABLE_PIN, LOW); // Sürücüyü aktif et
  delay(1);                      // Aktifleşme süresi bekle

  digitalWrite(dirPin, yon);

  for (long i = 0; i < adim; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(stepDelay);

    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelay);
  }

  delay(50);                      // Son adımın yerine oturması için bekle
  digitalWrite(ENABLE_PIN, HIGH); // Akımı keserek cızırtıyı ve ısınmayı önle
}

// Dinamik Konfigürasyon Çözümleme
void parseConfig(String payload) {
  // format:
  // STEP1=5:DIR1=2:STEP2=6:DIR2=3:EN=8:SENS_IN=4:SENS_OUT=7:SPEED1=1000:SPEED2=1000:STEPS1=400:STEPS2=400
  int startIdx = 0;
  while (startIdx < payload.length()) {
    int nextColon = payload.indexOf(':', startIdx);
    if (nextColon == -1)
      nextColon = payload.length();
    String pair = payload.substring(startIdx, nextColon);
    startIdx = nextColon + 1;

    int eqIdx = pair.indexOf('=');
    if (eqIdx != -1) {
      String key = pair.substring(0, eqIdx);
      String val = pair.substring(eqIdx + 1);
      key.trim();
      val.trim();

      if (key == "STEP1")
        X_STEP = val.toInt();
      else if (key == "DIR1")
        X_DIR = val.toInt();
      else if (key == "STEP2")
        Y_STEP = val.toInt();
      else if (key == "DIR2")
        Y_DIR = val.toInt();
      else if (key == "EN")
        ENABLE_PIN = val.toInt();
      else if (key == "SENS_IN")
        SENSOR_X = val.toInt();
      else if (key == "SENS_OUT")
        SENSOR_Y = val.toInt();
      else if (key == "SPEED1")
        stepDelay = val.toInt();
      else if (key == "STEPS1")
        stepsX = val.toInt();
      else if (key == "STEPS2")
        stepsY = val.toInt();
      else if (key == "DEBOUNCE")
        debounceDelay = val.toInt();
    }
  }

  setupPins();

  sensXState = digitalRead(SENSOR_X);
  sensYState = digitalRead(SENSOR_Y);
  lastReadingX = sensXState;
  lastReadingY = sensYState;

  Serial.println("CONFIG:OK");
}

// Komut İşleme Merkezi
void processCommand(String cmd) {
  if (cmd.startsWith("CONFIG:")) {
    parseConfig(cmd.substring(7));
  }

  else if (cmd.startsWith("READ:HCSR04:")) {
    // Format: READ:HCSR04:D11:D12
    String trigPinStr = getPart(cmd, ':', 2);
    String echoPinStr = getPart(cmd, ':', 3);

    trigPinStr.replace("D", "");
    echoPinStr.replace("D", "");

    int trigPin = trigPinStr.toInt();
    int echoPin = echoPinStr.toInt();

    if (trigPin > 0 && echoPin > 0) {
      pinMode(trigPin, OUTPUT);
      pinMode(echoPin, INPUT);

      digitalWrite(trigPin, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);

      unsigned long duration =
          pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m)
      long distance_mm = 0;
      if (duration > 0) {
        // Sound speed = 343 m/s -> 0.343 mm/us -> Distance = (duration * 0.343)
        // / 2
        distance_mm = (duration * 343) / 2000;
      }

      Serial.print("EVENT:HCSR04:D");
      Serial.print(trigPin);
      Serial.print(":D");
      Serial.print(echoPin);
      Serial.print(":");
      Serial.println(distance_mm);
    }
  }

  else if (cmd.startsWith("VALVE:ON:") || cmd.startsWith("VALVE:OFF:")) {
    bool state = cmd.startsWith("VALVE:ON:");
    String pinStr = getPart(cmd, ':', 2);
    pinStr.replace("D", "");
    int pin = pinStr.toInt();

      if (pin >= 2 && pin <= 13) {
        // Motor and sensor pins are protected to prevent accidental overrides
        if (pin != ENABLE_PIN && pin != X_STEP && pin != X_DIR &&
            pin != Y_STEP && pin != Y_DIR && pin != SENSOR_X &&
            pin != SENSOR_Y) {
          pinMode(pin, OUTPUT);
          digitalWrite(pin, state ? HIGH : LOW);
          Serial.print("STATUS:VALVE:D");
          Serial.print(pin);
          Serial.println(state ? ":ON" : ":OFF");
        }
      }
    }

    else if (cmd.startsWith("GATE:")) {
      // Format: GATE:OPEN:D5:D2:D8:400:1000  veya  GATE:CLOSE:D5:D2:D8:400:1000
      String action = getPart(cmd, ':', 1);
      String stepPinStr = getPart(cmd, ':', 2);
      String dirPinStr = getPart(cmd, ':', 3);
      String enPinStr = getPart(cmd, ':', 4);
      String stepsStr = getPart(cmd, ':', 5);
      String speedStr = getPart(cmd, ':', 6);

      stepPinStr.replace("D", "");
      dirPinStr.replace("D", "");
      enPinStr.replace("D", "");

      int targetStepPin = stepPinStr.toInt();
      int targetDirPin = dirPinStr.toInt();
      int targetEnPin = enPinStr.toInt();
      long targetSteps = stepsStr.toInt();
      int targetSpeed = speedStr.toInt();

      // Yön belirleme (CNC kilit motoru açma/kapama)
      bool direction = (action == "OPEN") ? HIGH : LOW;
      stepDelay = targetSpeed;

      // Motoru sür
      motorStep(targetStepPin, targetDirPin, direction, targetSteps);

      // Sürücüyü devre dışı bırak (ısınmayı önleme)
      digitalWrite(targetEnPin, HIGH);

      Serial.println("GATE:OK");
    }

    else if (cmd == "WHOAMI") {
      Serial.println("ID:GatesNano;NAME:GatesNano");
    }

    else if (cmd == "help") {
      menuGoster();
    }

    else if (cmd == "status") {
      durumGoster();
    }

    else if (cmd == "enable") {
      digitalWrite(ENABLE_PIN, LOW);
      Serial.println("Motorlar AKTIF");
    }

    else if (cmd == "disable") {
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.println("Motorlar PASIF");
    }

    else if (cmd == "x+") {
      motorStep(X_STEP, X_DIR, HIGH, stepsX);
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.print("X ileri ");
      Serial.print(stepsX);
      Serial.println(" adim");
    }

    else if (cmd == "x-") {
      motorStep(X_STEP, X_DIR, LOW, stepsX);
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.print("X geri ");
      Serial.print(stepsX);
      Serial.println(" adim");
    }

    else if (cmd == "y+") {
      motorStep(Y_STEP, Y_DIR, HIGH, stepsY);
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.print("Y ileri ");
      Serial.print(stepsY);
      Serial.println(" adim");
    }

    else if (cmd == "y-") {
      motorStep(Y_STEP, Y_DIR, LOW, stepsY);
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.print("Y geri ");
      Serial.print(stepsY);
      Serial.println(" adim");
    }

    else if (cmd == "homex") {
      Serial.println("X sensor araniyor");
      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(X_DIR, HIGH);

      while (digitalRead(SENSOR_X) == HIGH) {
        digitalWrite(X_STEP, HIGH);
        delayMicroseconds(stepDelay);
        digitalWrite(X_STEP, LOW);
        delayMicroseconds(stepDelay);
      }
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.println("X sensor bulundu");
    }

    else if (cmd == "homey") {
      Serial.println("Y sensor araniyor");
      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(Y_DIR, HIGH);

      while (digitalRead(SENSOR_Y) == HIGH) {
        digitalWrite(Y_STEP, HIGH);
        delayMicroseconds(stepDelay);
        digitalWrite(Y_STEP, LOW);
        delayMicroseconds(stepDelay);
      }
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.println("Y sensor bulundu");
    }

    else if (cmd == "watch") {
      Serial.println("Izleme modu. Reset ile cikilir");
      while (true) {
        Serial.print("X=");
        if (digitalRead(SENSOR_X))
          Serial.print("BOS");
        else
          Serial.print("ALGILADI");

        Serial.print("   Y=");
        if (digitalRead(SENSOR_Y))
          Serial.println("BOS");
        else
          Serial.println("ALGILADI");

        delay(250);
      }
    }

    // Software reset command
    else if (cmd == "RESET") {
      Serial.println("RESETTING");
      delay(100);
      resetFunc();
    }
  }

  void durumGoster() {
    Serial.println();
    Serial.print("X Sensor (Pin ");
    Serial.print(SENSOR_X);
    Serial.print(") : ");
    if (digitalRead(SENSOR_X) == LOW)
      Serial.println("ALGILADI");
    else
      Serial.println("BOS");

    Serial.print("Y Sensor (Pin ");
    Serial.print(SENSOR_Y);
    Serial.print(") : ");
    if (digitalRead(SENSOR_Y) == LOW)
      Serial.println("ALGILADI");
    else
      Serial.println("BOS");

    Serial.print("Motorlar : ");
    if (digitalRead(ENABLE_PIN) == LOW)
      Serial.println("AKTIF");
    else
      Serial.println("PASIF");

    Serial.print("Ayarlar  : Delay (Hiz) = ");
    Serial.print(stepDelay);
    Serial.print("us, Steps X = ");
    Serial.print(stepsX);
    Serial.print(", Steps Y = ");
    Serial.println(stepsY);
    Serial.println();
  }

  void menuGoster() {
    Serial.println();
    Serial.println("===== CNC TEST (DINAMIK) =====");
    Serial.println("help");
    Serial.println("status");
    Serial.println("enable");
    Serial.println("disable");
    Serial.println("x+");
    Serial.println("x-");
    Serial.println("y+");
    Serial.println("y-");
    Serial.println("homex");
    Serial.println("homey");
    Serial.println("watch");
    Serial.println("==============================");
    Serial.println();
  }
