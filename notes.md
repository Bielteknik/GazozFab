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