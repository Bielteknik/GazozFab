// TestGates.ino - Arduino Nano Kapı / Lazer Test Yazılımı
// SENSOR_X (D4) veya SENSOR_Y (D7) üzerinden toplam 8 adet şişe algılandığında
// çıkış kapısını kapatır (Y step motoru), 10 saniye bekler ve kapıyı tekrar
// açar.

int X_STEP = 5;
int X_DIR = 2;
int Y_STEP = 6;
int Y_DIR = 3;
int ENABLE_PIN = 8;
int SENSOR_X = 4; // Giriş Lazer Sensörü (D4)
int SENSOR_Y = 7; // Çıkış Lazer Sensörü (D7)

int stepDelay = 1000; // adım gecikmesi (mikrosaniye)
long stepsX = 600; // Giriş kapısı adım sayısı (sizin yaptığınız son güncelleme)
long stepsY = 600; // Çıkış kapısı adım sayısı (sizin yaptığınız son güncelleme)

// Lazer Sensör Durum Takip Değişkenleri (Debounce)
int sensXState = HIGH; // Mevcut kararlı durum
int sensYState = HIGH;
int lastReadingX = HIGH; // Son okunan anlık değer
int lastReadingY = HIGH;
unsigned long lastDebounceTimeX = 0;
unsigned long lastDebounceTimeY = 0;
unsigned long debounceDelay = 50; // milisaniye

// Otomasyon ve Zamanlama Değişkenleri
int bottleCount = 0;
bool gateIsClosed = false;
unsigned long gateClosedTime = 0;

void setupPins() {
  pinMode(X_STEP, OUTPUT);
  pinMode(X_DIR, OUTPUT);
  pinMode(Y_STEP, OUTPUT);
  pinMode(Y_DIR, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  pinMode(SENSOR_X, INPUT_PULLUP);
  pinMode(SENSOR_Y, INPUT_PULLUP);

  digitalWrite(ENABLE_PIN, HIGH); // CNC Shield motor sürücüleri uyku modunda
                                  // başlasın (ısınmayı önleme)
}

void setup() {
  Serial.begin(115200);
  setupPins();

  // İlk durumları oku
  sensXState = digitalRead(SENSOR_X);
  sensYState = digitalRead(SENSOR_Y);
  lastReadingX = sensXState;
  lastReadingY = sensYState;

  Serial.println("==================================================");
  Serial.println("TestGates: Donanim Test Yazilimi Hazir.");
  Serial.println(
      "Sensör D4 veya D7 üzerinden 8 adet şişe geçişi sayılacaktır.");
  Serial.println(
      "Hedef sayıya ulaşıldığında Çıkış Kapısı (Y Motoru) kapatılacaktır.");
  Serial.println(
      "Kapanıştan 10 saniye sonra kapı otomatik olarak geri açılacaktır.");
  Serial.println("==================================================");
}

// Step motor sürme fonksiyonu
void motorStep(int stepPin, int dirPin, bool yon, long adim) {
  digitalWrite(ENABLE_PIN, LOW); // Sürücüyü aktif et
  delay(1);                      // Kısa bir bekleme süresi

  digitalWrite(dirPin, yon);

  for (long i = 0; i < adim; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(stepDelay);

    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelay);
  }
}

void loop() {
  // 1. Giriş Lazeri (D4) Sayımı
  int readingX = digitalRead(SENSOR_X);
  if (readingX != lastReadingX) {
    lastDebounceTimeX = millis();
  }
  if ((millis() - lastDebounceTimeX) > debounceDelay) {
    if (readingX != sensXState) {
      sensXState = readingX;
      if (sensXState == LOW) { // Şişe lazer ışınını kestiğinde
        bottleCount++;
        Serial.print("[Giris Lazeri - D4] Sise algilandi. Toplam sayi: ");
        Serial.println(bottleCount);
      }
    }
  }
  lastReadingX = readingX;

  // 2. Çıkış Lazeri (D7) Sayımı
  int readingY = digitalRead(SENSOR_Y);
  if (readingY != lastReadingY) {
    lastDebounceTimeY = millis();
  }
  if ((millis() - lastDebounceTimeY) > debounceDelay) {
    if (readingY != sensYState) {
      sensYState = readingY;
      if (sensYState == LOW) { // Şişe lazer ışınını kestiğinde
        bottleCount++;
        Serial.print("[Cikis Lazeri - D7] Sise algilandi. Toplam sayi: ");
        Serial.println(bottleCount);
      }
    }
  }
  lastReadingY = readingY;

  // 3. Toplam 8 şişe geçişi olduğunda çıkış kapısını kapat
  if (bottleCount >= 8 && !gateIsClosed) {
    Serial.println(
        ">>> 8 adet sise gecisi algilandi. Cikis kapisi KAPATILIYOR...");

    // Çıkış kapısı motorunu kapat yönünde sür (LOW)
    motorStep(Y_STEP, Y_DIR, LOW, stepsY);

    // Motor sürücüsünü uykuya al (ısınmaması için)
    digitalWrite(ENABLE_PIN, HIGH);

    gateIsClosed = true;
    gateClosedTime = millis();
    bottleCount = 0; // Bir sonraki 8'li grup için sayacı sıfırla
  }

  // 4. Kapı kapatıldıktan sonra 10 saniye geçtiyse geri aç
  if (gateIsClosed && (millis() - gateClosedTime >= 10000)) {
    Serial.println(">>> 10 saniye sure doldu. Cikis kapisi ACILIYOR...");

    // Çıkış kapısı motorunu aç yönünde sür (HIGH)
    motorStep(Y_STEP, Y_DIR, HIGH, stepsY);

    // Sürücüyü uykuya al
    digitalWrite(ENABLE_PIN, HIGH);

    gateIsClosed = false;
    Serial.println(">>> Cikis kapisi acildi. Yeni sayim basliyor.");
  }
}
