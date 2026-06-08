//-----------------------
#define X_STEP 5
#define X_DIR  2

#define Y_STEP 6
#define Y_DIR  3

#define ENABLE_PIN 8

#define SENSOR_X 12
#define SENSOR_Y 13

String komut = "";

const int stepDelay = 1000; // mikro saniye

//--------------------------------------------------

void motorStep(int stepPin, int dirPin, bool yon, long adim)
{
  digitalWrite(ENABLE_PIN, LOW); // sürücü aktif

  digitalWrite(dirPin, yon);

  for(long i = 0; i < adim; i++)
  {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(stepDelay);

    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelay);
  }
}

//--------------------------------------------------

void durumGoster()
{
  Serial.println();

  Serial.print("X Sensor : ");

  if(digitalRead(SENSOR_X) == LOW)
    Serial.println("ALGILADI");
  else
    Serial.println("BOS");

  Serial.print("Y Sensor : ");

  if(digitalRead(SENSOR_Y) == LOW)
    Serial.println("ALGILADI");
  else
    Serial.println("BOS");

  Serial.print("Motorlar : ");

  if(digitalRead(ENABLE_PIN) == LOW)
    Serial.println("AKTIF");
  else
    Serial.println("PASIF");

  Serial.println();
}

//--------------------------------------------------

void menuGoster()
{
  Serial.println();
  Serial.println("===== CNC TEST =====");
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
  Serial.println("====================");
  Serial.println();
}

//--------------------------------------------------

void setup()
{
  pinMode(X_STEP, OUTPUT);
  pinMode(X_DIR, OUTPUT);

  pinMode(Y_STEP, OUTPUT);
  pinMode(Y_DIR, OUTPUT);

  pinMode(ENABLE_PIN, OUTPUT);

  pinMode(SENSOR_X, INPUT);
  pinMode(SENSOR_Y, INPUT);

  digitalWrite(ENABLE_PIN, HIGH); // sessiz başla

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("Sistem Hazir");

  menuGoster();
}

//--------------------------------------------------

void loop()
{
  if(Serial.available())
  {
    komut = Serial.readStringUntil('\n');
    komut.trim();

    //------------------------------------------------

    if(komut == "help")
    {
      menuGoster();
    }

    //------------------------------------------------

    else if(komut == "status")
    {
      durumGoster();
    }

    //------------------------------------------------

    else if(komut == "enable")
    {
      digitalWrite(ENABLE_PIN, LOW);
      Serial.println("Motorlar AKTIF");
    }

    //------------------------------------------------

    else if(komut == "disable")
    {
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.println("Motorlar PASIF");
    }

    //------------------------------------------------

    else if(komut == "x+")
    {
      motorStep(X_STEP, X_DIR, HIGH, 200);
      Serial.println("X ileri 200 adim");
    }

    //------------------------------------------------

    else if(komut == "x-")
    {
      motorStep(X_STEP, X_DIR, LOW, 200);
      Serial.println("X geri 200 adim");
    }

    //------------------------------------------------

    else if(komut == "y+")
    {
      motorStep(Y_STEP, Y_DIR, HIGH, 200);
      Serial.println("Y ileri 200 adim");
    }

    //------------------------------------------------

    else if(komut == "y-")
    {
      motorStep(Y_STEP, Y_DIR, LOW, 200);
      Serial.println("Y geri 200 adim");
    }

    //------------------------------------------------

    else if(komut == "homex")
    {
      Serial.println("X sensor aranıyor");

      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(X_DIR, HIGH);

      while(digitalRead(SENSOR_X) == HIGH)
      {
        digitalWrite(X_STEP, HIGH);
        delayMicroseconds(stepDelay);

        digitalWrite(X_STEP, LOW);
        delayMicroseconds(stepDelay);
      }

      digitalWrite(ENABLE_PIN, HIGH);

      Serial.println("X sensor bulundu");
    }

    //------------------------------------------------

    else if(komut == "homey")
    {
      Serial.println("Y sensor aranıyor");

      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(Y_DIR, HIGH);

      while(digitalRead(SENSOR_Y) == HIGH)
      {
        digitalWrite(Y_STEP, HIGH);
        delayMicroseconds(stepDelay);

        digitalWrite(Y_STEP, LOW);
        delayMicroseconds(stepDelay);
      }

      digitalWrite(ENABLE_PIN, HIGH);

      Serial.println("Y sensor bulundu");
    }

    //------------------------------------------------

    else if(komut == "watch")
    {
      Serial.println("Izleme modu");
      Serial.println("Reset ile cikilir");

      while(true)
      {
        Serial.print("X=");

        if(digitalRead(SENSOR_X))
          Serial.print("BOS");
        else
          Serial.print("ALGILADI");

        Serial.print("   Y=");

        if(digitalRead(SENSOR_Y))
          Serial.println("BOS");
        else
          Serial.println("ALGILADI");

        delay(250);
      }
    }

    //------------------------------------------------

    else
    {
      Serial.println("Bilinmeyen komut");
    }
  }
}
//-----------------------

//-----------------------
// Varsayılan pin tanımları (CNC Shield Shield V3 fallback)
// Eğer Pi5'ten CONFIG gelmezse bu varsayılan değerlerle çalışır.
int X_STEP = 5;
int X_DIR = 2;
int Y_STEP = 6;
int Y_DIR = 3;
int ENABLE_PIN = 8;
int SENSOR_X = 12;
int SENSOR_Y = 13;

int stepDelay = 1000; // mikro saniye
long stepsX = 400;
long stepsY = 400;

String komut = "";

// Lazer Sensör Durum Takip Değişkenleri (Debounce ve Değişim Algılama)
int lastSensXState = HIGH;
int lastSensYState = HIGH;
unsigned long lastSensXDebounce = 0;
unsigned long lastSensYDebounce = 0;
const unsigned long debounceDelay = 50;

//--------------------------------------------------

void setupPins() {
  pinMode(X_STEP, OUTPUT);
  pinMode(X_DIR, OUTPUT);
  pinMode(Y_STEP, OUTPUT);
  pinMode(Y_DIR, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);
  
  pinMode(SENSOR_X, INPUT_PULLUP);
  pinMode(SENSOR_Y, INPUT_PULLUP);
  
  digitalWrite(ENABLE_PIN, HIGH); // Sessiz başla / sürücüyü devre dışı bırak
}

//--------------------------------------------------

void motorStep(int stepPin, int dirPin, bool yon, long adim) {
  digitalWrite(ENABLE_PIN, LOW); // sürücü aktif
  delay(1); // Kısa bir aktifleşme süresi

  digitalWrite(dirPin, yon);

  for (long i = 0; i < adim; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(stepDelay);

    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelay);
  }
}

//--------------------------------------------------

void durumGoster() {
  Serial.println();
  Serial.print("X Sensor (Pin "); Serial.print(SENSOR_X); Serial.print(") : ");
  if (digitalRead(SENSOR_X) == LOW)
    Serial.println("ALGILADI");
  else
    Serial.println("BOS");

  Serial.print("Y Sensor (Pin "); Serial.print(SENSOR_Y); Serial.print(") : ");
  if (digitalRead(SENSOR_Y) == LOW)
    Serial.println("ALGILADI");
  else
    Serial.println("BOS");

  Serial.print("Motorlar : ");
  if (digitalRead(ENABLE_PIN) == LOW)
    Serial.println("AKTIF");
  else
    Serial.println("PASIF");
    
  Serial.print("Ayarlar  : Delay (Hiz) = "); Serial.print(stepDelay);
  Serial.print("us, Steps X = "); Serial.print(stepsX);
  Serial.print(", Steps Y = "); Serial.println(stepsY);
  Serial.println();
}

//--------------------------------------------------

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

//--------------------------------------------------

void parseConfig(String payload) {
  // payload formatı: STEP1=5:DIR1=2:STEP2=6:DIR2=3:EN=8:SENS_IN=12:SENS_OUT=13:SPEED1=1000:SPEED2=1000:STEPS1=400:STEPS2=400
  int startIdx = 0;
  while (startIdx < payload.length()) {
    int nextColon = payload.indexOf(':', startIdx);
    if (nextColon == -1) nextColon = payload.length();
    String pair = payload.substring(startIdx, nextColon);
    startIdx = nextColon + 1;

    int eqIdx = pair.indexOf('=');
    if (eqIdx != -1) {
      String key = pair.substring(0, eqIdx);
      String val = pair.substring(eqIdx + 1);
      key.trim();
      val.trim();

      if (key == "STEP1") X_STEP = val.toInt();
      else if (key == "DIR1") X_DIR = val.toInt();
      else if (key == "STEP2") Y_STEP = val.toInt();
      else if (key == "DIR2") Y_DIR = val.toInt();
      else if (key == "EN") ENABLE_PIN = val.toInt();
      else if (key == "SENS_IN") SENSOR_X = val.toInt();
      else if (key == "SENS_OUT") SENSOR_Y = val.toInt();
      else if (key == "SPEED1") stepDelay = val.toInt();
      else if (key == "STEPS1") stepsX = val.toInt();
      else if (key == "STEPS2") stepsY = val.toInt();
    }
  }

  // Pinleri yeniden yapılandır
  setupPins();
  
  // İlk durumları güncelle
  lastSensXState = digitalRead(SENSOR_X);
  lastSensYState = digitalRead(SENSOR_Y);
  
  Serial.println("CONFIG:OK");
}

//--------------------------------------------------

void setup() {
  Serial.begin(115200);
  
  setupPins();

  // İlk durumları güncelle
  lastSensXState = digitalRead(SENSOR_X);
  lastSensYState = digitalRead(SENSOR_Y);

  delay(500);

  // Kimlik Yayını (Pi5 keşfi için)
  Serial.println("ID:GatesNano;NAME:GatesNano");
  
  menuGoster();
}

//--------------------------------------------------

void loop() {
  // Lazer Sensör X (Giriş) Takibi ve Raporlama
  int currentX = digitalRead(SENSOR_X);
  if (currentX != lastSensXState) {
    if ((millis() - lastSensXDebounce) > debounceDelay) {
      lastSensXState = currentX;
      lastSensXDebounce = millis();
      if (currentX == LOW) {
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

  // Lazer Sensör Y (Çıkış) Takibi ve Raporlama
  int currentY = digitalRead(SENSOR_Y);
  if (currentY != lastSensYState) {
    if ((millis() - lastSensYDebounce) > debounceDelay) {
      lastSensYState = currentY;
      lastSensYDebounce = millis();
      if (currentY == LOW) {
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

  // Seri porttan gelen komutları oku
  if (Serial.available()) {
    komut = Serial.readStringUntil('\n');
    komut.trim();

    if (komut.startsWith("CONFIG:")) {
      parseConfig(komut.substring(7));
    }
    
    else if (komut.startsWith("GATE:")) {
      // Format: GATE:OPEN:D5:D2:D8:400:1000
      int parts[7];
      int partCount = 0;
      int startIdx = 0;
      
      while (partCount < 7) {
        int nextColon = komut.indexOf(':', startIdx);
        if (nextColon == -1) {
          parts[partCount++] = startIdx;
          break;
        }
        parts[partCount++] = startIdx;
        startIdx = nextColon + 1;
      }
      
      if (partCount >= 7) {
        String action = komut.substring(parts[1], parts[2] - 1);
        String stepPinStr = komut.substring(parts[2], parts[3] - 1);
        String dirPinStr = komut.substring(parts[3], parts[4] - 1);
        String enPinStr = komut.substring(parts[4], parts[5] - 1);
        String stepsStr = komut.substring(parts[5], parts[6] - 1);
        String speedStr = komut.substring(parts[6]);
        
        stepPinStr.replace("D", "");
        dirPinStr.replace("D", "");
        enPinStr.replace("D", "");
        
        int targetStepPin = stepPinStr.toInt();
        int targetDirPin = dirPinStr.toInt();
        int targetEnPin = enPinStr.toInt();
        long targetSteps = stepsStr.toInt();
        int targetSpeed = speedStr.toInt();
        
        bool direction = (action == "OPEN") ? HIGH : LOW;
        
        stepDelay = targetSpeed;
        
        // Motoru sür
        motorStep(targetStepPin, targetDirPin, direction, targetSteps);
        
        // Sürücüyü uykuya al (ısınmayı önlemek için)
        digitalWrite(targetEnPin, HIGH);
        
        Serial.println("GATE:OK");
      } else {
        Serial.println("GATE:ERROR:Eksik parametre");
      }
    }
    
    else if (komut == "help") {
      menuGoster();
    }

    else if (komut == "status") {
      durumGoster();
    }

    else if (komut == "enable") {
      digitalWrite(ENABLE_PIN, LOW);
      Serial.println("Motorlar AKTIF");
    }

    else if (komut == "disable") {
      digitalWrite(ENABLE_PIN, HIGH);
      Serial.println("Motorlar PASIF");
    }

    else if (komut == "x+") {
      motorStep(X_STEP, X_DIR, HIGH, stepsX);
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.print("X ileri "); Serial.print(stepsX); Serial.println(" adim");
    }

    else if (komut == "x-") {
      motorStep(X_STEP, X_DIR, LOW, stepsX);
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.print("X geri "); Serial.print(stepsX); Serial.println(" adim");
    }

    else if (komut == "y+") {
      motorStep(Y_STEP, Y_DIR, HIGH, stepsY);
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.print("Y ileri "); Serial.print(stepsY); Serial.println(" adim");
    }

    else if (komut == "y-") {
      motorStep(Y_STEP, Y_DIR, LOW, stepsY);
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.print("Y geri "); Serial.print(stepsY); Serial.println(" adim");
    }

    else if (komut == "homex") {
      Serial.println("X sensor araniyor");
      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(X_DIR, HIGH);

      while (digitalRead(SENSOR_X) == HIGH) {
        digitalWrite(X_STEP, HIGH);
        delayMicroseconds(stepDelay);
        digitalWrite(X_STEP, LOW);
        delayMicroseconds(stepDelay);
      }
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.println("X sensor bulundu");
    }

    else if (komut == "homey") {
      Serial.println("Y sensor araniyor");
      digitalWrite(ENABLE_PIN, LOW);
      digitalWrite(Y_DIR, HIGH);

      while (digitalRead(SENSOR_Y) == HIGH) {
        digitalWrite(Y_STEP, HIGH);
        delayMicroseconds(stepDelay);
        digitalWrite(Y_STEP, LOW);
        delayMicroseconds(stepDelay);
      }
      digitalWrite(ENABLE_PIN, HIGH); // Isınmayı önleme
      Serial.println("Y sensor bulundu");
    }

    else if (komut == "watch") {
      Serial.println("Izleme modu. Reset ile cikilir");
      while (true) {
        Serial.print("X=");
        if (digitalRead(SENSOR_X)) Serial.print("BOS");
        else Serial.print("ALGILADI");

        Serial.print("   Y=");
        if (digitalRead(SENSOR_Y)) Serial.println("BOS");
        else Serial.println("ALGILADI");

        delay(250);
      }
    }

    else if (komut == "WHOAMI") {
      Serial.println("ID:GatesNano;NAME:GatesNano");
    }

    else {
      Serial.println("Bilinmeyen komut");
    }
  }
}
//--------------------------
