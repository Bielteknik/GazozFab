/*
 * GazozFab - Valves Controller Arduino Nano Firmware (ValvesNano)
 *
 * This firmware connects to the Raspberry Pi 5 backend on Port 1978 via TCP
 * (using an Ethernet Shield W5100/W5500) and also supports USB Serial fallback.
 *
 * Features:
 *  - Auto-discovery broadcast on boot (ID:ValvesNano;NAME:ValvesNano)
 *  - WHOAMI handshake responder
 *  - Individual valve control on digital outputs D2 through D9
 *  - Global emergency valve safety shutdown (VALVE:ALL_OFF)
 *  - Dynamic UDP Server Discovery (Port 1978 broadcast)
 */

#include <Ethernet.h>
#include <EthernetUdp.h>
#include <SPI.h>

// --- Device Identification ---
const String NANO_ID = "ValvesNano";
const String NANO_NAME = "ValvesNano";

// --- Feature Toggle ---
const bool USE_ETHERNET =
    false; // Set to true if an Ethernet Shield is attached

// --- Network Configuration ---
byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x02};
IPAddress ip(192, 168, 1, 16); // Fallback static IP if DHCP fails
IPAddress serverIP(192, 168, 1,
                   5);      // Dynamically updated, fallback is 192.168.1.5
const uint16_t port = 1978; // TCP and UDP Port

EthernetClient client;
bool ethernetConnected = false;
unsigned long lastReconnectAttempt = 0;
bool serverFound = false;
bool ethernetHardwarePresent =
    false; // Automatically set depending on hardware check

// --- Valve Pin Mappings ---
const int VALVE_MIN_PIN = 2; // D2
const int VALVE_MAX_PIN = 13; // D13

// --- Function Declarations ---
void sendResponse(const String &msg);
void processCommand(const String &cmd);
void allValvesOff();
void checkEthernet();
bool discoverServerIP();

void setup() {
  // Initialize Serial
  Serial.begin(115200);
  delay(1000);

  // Setup Valve Pins (D2 to D9) as Outputs
  for (int pin = VALVE_MIN_PIN; pin <= VALVE_MAX_PIN; pin++) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW); // Start with all valves closed (OFF)
  }

  // Boot Broadcast over Serial
  Serial.println("ID:" + NANO_ID + ";NAME:" + NANO_NAME);

  if (USE_ETHERNET) {
    // Ethernet CS pinini 10 olarak başlat (W5100/W5500 standardı)
    Ethernet.init(10);

    // Initialize Ethernet Shield with presence check
    Serial.println(F("[Ethernet] Initializing..."));
    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
      ethernetHardwarePresent = false;
    } else {
      if (Ethernet.begin(mac) != 0) {
        ethernetHardwarePresent = true;
      } else {
        Serial.println(F("[Ethernet] DHCP Failed, trying static IP..."));
        Ethernet.begin(mac, ip);
        // Verify if the static IP was actually written and can be read back
        if (Ethernet.localIP() == ip) {
          ethernetHardwarePresent = true;
        } else {
          ethernetHardwarePresent = false;
        }
      }
    }

    if (!ethernetHardwarePresent) {
      Serial.println(F("[Ethernet] No functioning Ethernet hardware detected. "
                       "Running in Serial-only mode."));
    } else {
      Serial.print(F("[Ethernet] IP Address: "));
      Serial.println(Ethernet.localIP());

      // Perform initial UDP Server discovery
      serverFound = discoverServerIP();
    }
  } else {
    ethernetHardwarePresent = false;
    Serial.println(F(
        "[System] Running in Serial-only mode (Ethernet disabled by config)."));
  }
}

void loop() {
  // 1. Handle Serial incoming commands
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      processCommand(cmd);
    }
  }

  // 2. Handle Network TCP connection & incoming commands
  if (ethernetHardwarePresent) {
    checkEthernet();
    if (ethernetConnected && client.available() > 0) {
      String cmd = client.readStringUntil('\n');
      cmd.trim();
      if (cmd.length() > 0) {
        processCommand(cmd);
      }
    }
  }
}

void sendResponse(const String &msg) {
  // Output to both Serial and TCP connection
  Serial.println(msg);
  if (ethernetHardwarePresent && ethernetConnected) {
    client.println(msg);
  }
}

bool discoverServerIP() {
  if (!ethernetHardwarePresent)
    return false;
  Serial.println(
      F("[Discovery] Starting server discovery via UDP Broadcast..."));

  EthernetUDP udp;
  if (udp.begin(port) == 0) {
    Serial.println(F("[Discovery] Failed to bind local UDP port"));
    return false;
  }

  IPAddress broadcastIP(255, 255, 255, 255);
  bool success = false;

  for (int attempt = 1; attempt <= 5; attempt++) {
    Serial.print(F("[Discovery] Broadcasting discovery packet (Attempt "));
    Serial.print(attempt);
    Serial.println(F(")..."));

    udp.beginPacket(broadcastIP, port);
    udp.write("GAZOZFAB:DISCOVER");
    udp.endPacket();

    // Listen for answer (Timeout: 1.5 seconds)
    unsigned long start = millis();
    while (millis() - start < 1500) {
      int packetSize = udp.parsePacket();
      if (packetSize > 0) {
        char buffer[32];
        udp.read(buffer, sizeof(buffer) - 1);
        buffer[packetSize] = '\0';

        if (strcmp(buffer, "GAZOZFAB:IP") == 0) {
          serverIP = udp.remoteIP();
          success = true;
          Serial.print(F("[Discovery] Server dynamically found at: "));
          Serial.println(serverIP);
          break;
        }
      }
      delay(50);
    }

    if (success)
      break;
    delay(1000);
  }

  udp.stop();
  return success;
}

void checkEthernet() {
  if (!ethernetHardwarePresent)
    return;
  if (!client.connected()) {
    if (ethernetConnected) {
      Serial.println(F("[Ethernet] Connection lost."));
      ethernetConnected = false;
      serverFound = false; // Force rediscovery if disconnected
    }

    unsigned long now = millis();
    if (now - lastReconnectAttempt > 10000 || lastReconnectAttempt == 0) {
      lastReconnectAttempt = now;

      // Try to discover server IP if not already found
      if (!serverFound) {
        serverFound = discoverServerIP();
      }

      Serial.print(F("[Ethernet] Attempting TCP connection to Pi 5 ("));
      Serial.print(serverIP);
      Serial.println(F(")..."));

      if (client.connect(serverIP, port)) {
        Serial.println(F("[Ethernet] Connected. Sending handshake..."));
        client.println("ID:" + NANO_ID + ";NAME:" + NANO_NAME);
        ethernetConnected = true;
      } else {
        Serial.println(F("[Ethernet] Connection failed."));
        serverFound = false; // Try discovering again next time
      }
    }
  }
}

void processCommand(const String &cmd) {
  // Handle Handshake Query
  if (cmd == "WHOAMI") {
    sendResponse("ID:" + NANO_ID + ";NAME:" + NANO_NAME);
  }
  // Handle individual valve controls
  // Format: VALVE:ON:D2 or VALVE:OFF:D2
  else if (cmd.startsWith("VALVE:ON:") || cmd.startsWith("VALVE:OFF:")) {
    bool state = cmd.startsWith("VALVE:ON:");
    int prefixLen = state ? 9 : 10;

    String pinStr = cmd.substring(prefixLen); // e.g. "D2" or "2"
    pinStr.replace("D", "");
    int pin = pinStr.toInt();

    // Verify the pin is in the valid valve range
    if (pin >= VALVE_MIN_PIN && pin <= VALVE_MAX_PIN) {
      digitalWrite(pin, state ? HIGH : LOW);
      sendResponse("STATUS:VALVE:" + String(pin) + ":" +
                   (state ? "ON" : "OFF"));
    }
  }
  // Handle emergency close all valves
  else if (cmd == "VALVE:ALL_OFF") {
    allValvesOff();
    sendResponse("STATUS:VALVES:ALL_OFF");
  }
}

void allValvesOff() {
  for (int pin = VALVE_MIN_PIN; pin <= VALVE_MAX_PIN; pin++) {
    digitalWrite(pin, LOW);
  }
}
