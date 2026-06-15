import os
import sys
import json
import time
import asyncio
import sqlite3
from datetime import datetime
import socketio
from aiohttp import web

# Import real hardware and production managers
from hardware_manager import HardwareManager
from production_manager import ProductionManager

# Absolute paths setup relative to main.py
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "gazozfab.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

# Database Wrapper
class DB:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def execute(self, query, params=()):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(query, params)
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def executescript(self, script_sql):
        conn = sqlite3.connect(self.db_path)
        try:
            conn.executescript(script_sql)
            conn.commit()
        finally:
            conn.close()

    def fetchall(self, query, params=()):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def fetchone(self, query, params=()):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(query, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

db = DB()

# Initialize DB on startup
def init_db():
    print(f"[DB] Database path: {DB_PATH}")
    if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
        print(f"[DB] Initializing database at {DB_PATH} using {SCHEMA_PATH}...")
        try:
            with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            db.executescript(schema_sql)
            print("[DB] Database initialized successfully.")
        except Exception as e:
            print(f"[DB] Error initializing database: {e}")
    else:
        print("[DB] Database file already exists. Running schema structure check...")
        try:
            with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            statements = schema_sql.split(";")
            conn = sqlite3.connect(DB_PATH)
            for stmt in statements:
                stmt_strip = stmt.strip()
                if stmt_strip.upper().startswith("CREATE TABLE") or stmt_strip.upper().startswith("INSERT OR IGNORE"):
                    try:
                        conn.execute(stmt_strip)
                    except Exception as ex:
                        pass
            # Ensure NANO valves have relayInversion = 0 (since ValvesNano handles polarity natively)
            try:
                conn.execute("ALTER TABLE system_state ADD COLUMN testInputCount INTEGER DEFAULT 0")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE system_state ADD COLUMN testOutputCount INTEGER DEFAULT 0")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE system_config ADD COLUMN ultrasonicIntervalMin INTEGER DEFAULT 3")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE system_config ADD COLUMN ultrasonicThresholdCm INTEGER DEFAULT 30")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE system_config ADD COLUMN ultrasonicRelayPin TEXT DEFAULT '11'")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE system_config ADD COLUMN ultrasonicRelayDurationMs INTEGER DEFAULT 5000")
            except Exception:
                pass
                
            try:
                conn.execute("UPDATE valves SET relayInversion = 0 WHERE device = 'NANO'")
                # Auto-migrate ValvesNano port from serial/UART to ttyUSB1
                cursor = conn.cursor()
                cursor.execute("SELECT port FROM nanos WHERE id = 'ValvesNano'")
                row = cursor.fetchone()
                if row and any(x in str(row[0]).lower() for x in ['serial0', 'ttyama0', 'ttys0']):
                    conn.execute("UPDATE nanos SET port = '/dev/ttyUSB1' WHERE id = 'ValvesNano'")
                    print(f"[DB Migration] Auto-migrated ValvesNano port from {row[0]} to /dev/ttyUSB1")
                
                # Seed default 40ml and 660ms configurations
                conn.execute("UPDATE recipes SET volumeMl = 40, fillTimeMs = 660, valveDurations = '{\"10\":660,\"11\":660,\"12\":660,\"13\":660,\"14\":660,\"15\":660,\"16\":660,\"17\":660}' WHERE id = 'default_recipe'")
                conn.execute("UPDATE system_config SET volumeMl = 40, fillTimeMs = 660 WHERE id = 1")
                conn.execute("UPDATE valves SET pulseDuration = 660")
                print("[DB Migration] Configured default recipe and valves to 40ml / 660ms.")
            except Exception as e:
                print(f"[DB Migration Error] {e}")
            conn.commit()
            conn.close()
            print("[DB] Schema check completed.")
        except Exception as e:
            print(f"[DB] Error checking schema: {e}")

# Helper to write logs to DB
def add_log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_msg = f"[{timestamp}] {message}"
    db.execute("INSERT INTO terminal_logs (timestamp, message) VALUES (?, ?)", (timestamp, formatted_msg))
    print(f"[System Log] {formatted_msg}")

# Fetch full state to map to client TS type
def get_full_state_sync():
    # 1. system_state
    state_row = db.fetchone("SELECT * FROM system_state WHERE id = 1")
    if not state_row:
        db.execute("INSERT OR IGNORE INTO system_state (id) VALUES (1)")
        state_row = db.fetchone("SELECT * FROM system_state WHERE id = 1")

    # 2. system_config
    config_row = db.fetchone("SELECT * FROM system_config WHERE id = 1")
    if not config_row:
        db.execute("INSERT OR IGNORE INTO system_config (id) VALUES (1)")
        config_row = db.fetchone("SELECT * FROM system_config WHERE id = 1")

    config = dict(config_row) if config_row else {}
    config.pop("id", None)
    config["relayInversion"] = bool(config.get("relayInversion", False))
    config["autoRecovery"] = bool(config.get("autoRecovery", True))
    config["enableMqtt"] = bool(config.get("enableMqtt", False))
    config["autoCleanEnabled"] = bool(config.get("autoCleanEnabled", False))

    # 3. recipes
    recipes_rows = db.fetchall("SELECT * FROM recipes")
    recipes = []
    for r in recipes_rows:
        rd = dict(r)
        try:
            rd["valveDurations"] = json.loads(rd.get("valveDurations") or "{}")
        except:
            rd["valveDurations"] = {}
        recipes.append(rd)

    # 4. valves
    valves_rows = db.fetchall("SELECT * FROM valves")
    valves = []
    for v in valves_rows:
        vd = dict(v)
        vd["enabled"] = bool(vd.get("enabled", True))
        vd["isOpen"] = bool(vd.get("isOpen", False))
        vd["relayInversion"] = bool(vd.get("relayInversion", False))
        valves.append(vd)

    # 5. nanos
    nanos_rows = db.fetchall("SELECT * FROM nanos")
    nanos = [dict(n) for n in nanos_rows]

    # 6. sensors
    sensors_rows = db.fetchall("SELECT * FROM sensors")
    sensors = []
    for s in sensors_rows:
        sd = dict(s)
        sd["enabled"] = bool(sd.get("enabled", True))
        
        # Convert DB device schema (either 'RASPI' or Nano ID like 'GatesNano') to UI schema
        db_device = sd.get("device", "RASPI")
        if db_device == "RASPI":
            sd["device"] = "RASPI"
            sd["connectionId"] = ""
        else:
            sd["device"] = "NANO"
            sd["connectionId"] = db_device
            
        sensors.append(sd)

    # 7. gates
    gates_rows = db.fetchall("SELECT * FROM gates")
    input_gate = { "id": "inputGate", "name": "Giriş Kapısı", "isOpen": False, "position": 0, "enabled": True, "pin": "G1", "device": "NANO" }
    output_gate = { "id": "outputGate", "name": "Çıkış Kapısı", "isOpen": False, "position": 0, "enabled": True, "pin": "G2", "device": "NANO" }
    extra_gates = []
    
    for g in gates_rows:
        gd = dict(g)
        gd["isOpen"] = bool(gd.get("isOpen", False))
        gd["enabled"] = bool(gd.get("enabled", True))
        if gd["id"] == "inputGate":
            input_gate = gd
        elif gd["id"] == "outputGate":
            output_gate = gd
        else:
            extra_gates.append(gd)

    # 8. cycleHistory
    history_rows = db.fetchall("SELECT * FROM cycle_history ORDER BY id DESC LIMIT 50")
    cycle_history = [dict(h) for h in history_rows]

    # 9. activeAlerts
    alert_rows = db.fetchall("SELECT * FROM active_alerts WHERE resolved = 0")
    active_alerts = []
    for a in alert_rows:
        ad = dict(a)
        ad["resolved"] = bool(ad.get("resolved", False))
        active_alerts.append(ad)

    # 10. terminalLogs
    log_rows = db.fetchall("SELECT message FROM terminal_logs ORDER BY id DESC LIMIT 100")
    terminal_logs = [l["message"] for l in reversed(log_rows)]
    if not terminal_logs:
        terminal_logs = ["[Sistem] Sunucu Başlatıldı. Bağlantı bekleniyor..."]

    # 11. activePrompt
    active_prompt_raw = state_row.get("activePrompt") if state_row else None
    active_prompt = None
    if active_prompt_raw:
        try:
            active_prompt = json.loads(active_prompt_raw)
        except:
            active_prompt = None

    system_data = {
        "mode": state_row.get("mode", "BEKLEMEDE") if state_row else "BEKLEMEDE",
        "autoState": state_row.get("autoState", "BEKLEMEDE") if state_row else "BEKLEMEDE",
        "inputCount": state_row.get("inputCount", 0) if state_row else 0,
        "outputCount": state_row.get("outputCount", 0) if state_row else 0,
        "testInputCount": state_row.get("testInputCount", 0) if state_row else 0,
        "testOutputCount": state_row.get("testOutputCount", 0) if state_row else 0,
        "tankLevelCm": state_row.get("tankLevelCm", 85) if state_row else 85,
        "isWashingDone": bool(state_row.get("isWashingDone", False)) if state_row else False,
        "isWashingRequired": bool(state_row.get("isWashingRequired", False)) if state_row else False,
        "stopAfterCycleRequested": bool(state_row.get("stopAfterCycleRequested", False)) if state_row else False,
        "activePrompt": active_prompt,
        "config": config,
        "recipes": recipes,
        "valves": valves,
        "nanos": nanos,
        "sensors": sensors,
        "inputGate": input_gate,
        "outputGate": output_gate,
        "extraGates": extra_gates,
        "cycleHistory": cycle_history,
        "activeAlerts": active_alerts,
        "terminalLogs": terminal_logs,
        "serialPorts": []
    }
    return system_data

# SocketIO Setup
sio = socketio.AsyncServer(cors_allowed_origins="*")

# Create Hardware Manager instance
hw = HardwareManager()
hw.db = db

def broadcast_callback():
    """Trigger update to all connected frontends."""
    asyncio.create_task(sio.emit('STATE_UPDATE', get_full_state_sync()))

# Create Production Manager instance
prod = ProductionManager(db, hw, broadcast_callback)

def send_gates_nano_config(port=None):
    """Sends current gates and sensors configuration (including debounce) from DB to GatesNano."""
    try:
        nano_id = "GatesNano"
        gates = db.fetchall("SELECT * FROM gates WHERE nanoId = ? OR id IN ('inputGate', 'outputGate')", (nano_id,))
        sensors = db.fetchall("SELECT * FROM sensors WHERE device = ?", (nano_id,))
        
        input_gate = next((g for g in gates if g["id"] == "inputGate"), None)
        output_gate = next((g for g in gates if g["id"] == "outputGate"), None)
        
        sens_in = next((s for s in sensors if s["type"] == "INPUT"), None)
        sens_out = next((s for s in sensors if s["type"] == "OUTPUT"), None)
        
        step1 = input_gate["pin"] if (input_gate and input_gate["pin"]) else "5"
        dir1 = input_gate["dirPin"] if (input_gate and input_gate["dirPin"]) else "2"
        en1 = input_gate["enablePin"] if (input_gate and input_gate["enablePin"]) else "8"
        speed1 = input_gate["speed"] if (input_gate and input_gate["speed"]) else "1000"
        steps1 = input_gate["stepsToOpen"] if (input_gate and input_gate["stepsToOpen"]) else "400"
        
        step2 = output_gate["pin"] if (output_gate and output_gate["pin"]) else "6"
        dir2 = output_gate["dirPin"] if (output_gate and output_gate["dirPin"]) else "3"
        en2 = output_gate["enablePin"] if (output_gate and output_gate["enablePin"]) else "8"
        speed2 = output_gate["speed"] if (output_gate and output_gate["speed"]) else "1000"
        steps2 = output_gate["stepsToOpen"] if (output_gate and output_gate["stepsToOpen"]) else "400"
        
        en = en1 if en1 else en2 if en2 else "8"
        
        s_in_pin = sens_in["pin"] if (sens_in and sens_in["pin"]) else "4"
        s_out_pin = sens_out["pin"] if (sens_out and sens_out["pin"]) else "7"
        
        s_in_debounce = sens_in["debounceMs"] if (sens_in and sens_in["debounceMs"] is not None) else 50
        s_out_debounce = sens_out["debounceMs"] if (sens_out and sens_out["debounceMs"] is not None) else 50
        debounce = max(s_in_debounce, s_out_debounce)
        
        config_cmd = f"CONFIG:STEP1={step1}:DIR1={dir1}:STEP2={step2}:DIR2={dir2}:EN={en}:SENS_IN={s_in_pin}:SENS_OUT={s_out_pin}:SPEED1={speed1}:SPEED2={speed2}:STEPS1={steps1}:STEPS2={steps2}:DEBOUNCE={debounce}"
        
        if not port:
            port = next((p for p, d_id in hw.port_to_id_map.items() if d_id == "GatesNano"), None)
            
        target_port = port if port else "GatesNano"
        hw.send_command(config_cmd, target_port=target_port)
        print(f"[Hardware Config] Sent dynamic configuration to GatesNano on {target_port}: {config_cmd}")
        add_log(f"GatesNano için dinamik yapılandırma gönderildi: {config_cmd}")
        
        # Query initial gate limit states
        hw.send_command("GET_LIMITS", target_port=target_port)
    except Exception as e:
        print(f"[Hardware Config Error] Failed to send GatesNano config: {e}")

def reload_hardware_config():
    """Reload all hardware config from database and apply to HardwareManager."""
    try:
        nanos = db.fetchall("SELECT * FROM nanos")
        sensors = db.fetchall("SELECT * FROM sensors")
        hw.apply_config(nanos, sensors)
        print("[Hardware] Configuration successfully reloaded from database.")
        
        # Instantly apply configurations to GatesNano if connected
        send_gates_nano_config()
    except Exception as e:
        print(f"[Hardware Reload Error] {e}")

def handle_nano_discovery(nano_id, name, port, baudrate):
    """Callback triggered when a Nano is discovered/connected on serial or network."""
    try:
        # Check if this Nano already exists in the database
        existing = db.fetchone("SELECT * FROM nanos WHERE id = ?", (nano_id,))
        if existing:
            # Update existing Nano with current port, baudrate, name, and ONLINE status
            db.execute(
                "UPDATE nanos SET name = ?, port = ?, baudRate = ?, status = 'ONLINE' WHERE id = ?",
                (name, port, baudrate, nano_id)
            )
            print(f"[DB Discovery] Updated existing Nano: {name} ({nano_id}) on {port}")
            add_log(f"Cihaz tekrar bağlandı: {name} (ID: {nano_id}) -> Port: {port}")
        else:
            # Register new Nano in DB
            db.execute(
                "INSERT INTO nanos (id, name, port, baudRate, status) VALUES (?, ?, ?, ?, 'ONLINE')",
                (nano_id, name, port, baudrate)
            )
            print(f"[DB Discovery] Registered new Nano: {name} ({nano_id}) on {port}")
            add_log(f"Yeni cihaz otomatik keşfedildi: {name} (ID: {nano_id}) -> Port: {port}")
            
            # Create HMI warning alert for newly registered Nano
            alert_id = f"ALERT-NANO-{int(time.time())}"
            db.execute(
                "INSERT INTO active_alerts (id, code, message, severity, timestamp) VALUES (?, 'NEW_NANO_DETECTED', ?, 'WARNING', ?)",
                (alert_id, f"Yeni Nano Donanımı Algılandı: {name} ({nano_id})", time.time())
            )
            
        # Send dynamic config to GatesNano on discovery
        if nano_id == "GatesNano":
            send_gates_nano_config(port)
            
        broadcast_callback()
    except Exception as e:
        print(f"[DB Discovery Error] {e}")

def handle_nano_disconnect(nano_id):
    """Callback triggered when a Nano disconnects (e.g. TCP connection dropped)."""
    try:
        db.execute("UPDATE nanos SET status = 'OFFLINE' WHERE id = ?", (nano_id,))
        print(f"[DB Disconnect] Nano disconnected: {nano_id}")
        add_log(f"Cihaz bağlantısı koptu (OFFLINE): {nano_id}")
        broadcast_callback()
    except Exception as e:
        print(f"[DB Disconnect Error] {e}")

# Keep track of last sensor trigger times to debounce EMI noise
last_sensor_triggers = {"IN": 0.0, "OUT": 0.0}

# Sensor event callback from hardware
def handle_sensor_event(device_id, sensor_type):
    global last_sensor_triggers
    now = time.time()
    if now - last_sensor_triggers.get(sensor_type, 0.0) < 0.3:
        return
    last_sensor_triggers[sensor_type] = now

    # Retrieve current count from DB
    key = "inputCount" if sensor_type == "IN" else "outputCount"
    test_key = "testInputCount" if sensor_type == "IN" else "testOutputCount"
    state_row = db.fetchone("SELECT * FROM system_state WHERE id = 1")
    if state_row:
        val = (state_row[key] or 0) + 1
        test_val = (state_row[test_key] or 0) + 1
        db.execute(f"UPDATE system_state SET {key} = ?, {test_key} = ? WHERE id = 1", (val, test_val))
        add_log(f"{'Giriş' if sensor_type == 'IN' else 'Çıkış'} Lazeri algılandı. Yeni Sayı: {val} (Test: {test_val})")
        broadcast_callback()

# Ultrasonic measurement session variables for averaging & relay trigger control
ultrasonic_session = {
    "active": False,
    "readings": [],
    "last_run": 0.0,
    "prev_average": None
}

# Distance event callback from hardware (HC-SR04)
def handle_distance_read(distance_cm):
    global ultrasonic_session
    # Always save the latest reading in the system state for UI/dashboard
    db.execute("UPDATE system_state SET tankLevelCm = ? WHERE id = 1", (int(distance_cm),))
    broadcast_callback()
    
    # If a dynamic averaging session is active, accumulate the reading
    if ultrasonic_session["active"]:
        # Filter out obvious noise / out of bounds
        if 1.0 < distance_cm < 400.0:
            ultrasonic_session["readings"].append(distance_cm)

# Limit switch event callback from GatesNano (D9, D10)
def handle_limit_switch_event(gate_id, is_open):
    # Retrieve stepsToOpen to set position correctly
    gate_row = db.fetchone("SELECT stepsToOpen FROM gates WHERE id = ?", (gate_id,))
    steps_to_open = gate_row["stepsToOpen"] if (gate_row and gate_row["stepsToOpen"]) else 400
    pos_val = steps_to_open if is_open else 0
    db.execute("UPDATE gates SET isOpen = ?, position = ? WHERE id = ?", (1 if is_open else 0, pos_val, gate_id))
    add_log(f"Kilit Sınır Anahtarı ({'Giriş Kapısı' if gate_id == 'inputGate' else 'Çıkış Kapısı'}): {'AÇIK' if is_open else 'KAPALI'}")
    broadcast_callback()

def handle_terminal_output(device_id, data):
    asyncio.create_task(sio.emit('TERMINAL_OUTPUT', {'nanoId': device_id, 'data': data}))

def handle_raw_pin_event(device_id, pin_str, status_str):
    asyncio.create_task(sio.emit('SENSOR_RAW_SIGNAL', {
        'device': device_id,
        'pin': pin_str,
        'status': status_str
    }))

hw.on_sensor_event = handle_sensor_event
hw.on_distance_read = handle_distance_read
hw.on_limit_switch_event = handle_limit_switch_event
hw.on_nano_discovered = handle_nano_discovery
hw.on_nano_disconnected = handle_nano_disconnect
hw.on_terminal_output = handle_terminal_output
hw.on_raw_pin_event = handle_raw_pin_event

# Socket event: Connect
@sio.event
async def connect(sid, environ):
    print(f"[Socket] Client connected: {sid}")
    # Populate available serial ports
    state = get_full_state_sync()
    state["serialPorts"] = hw.get_available_ports()
    await sio.emit('STATE_UPDATE', state, to=sid)

# Socket event: Disconnect
@sio.event
async def disconnect(sid):
    print(f"[Socket] Client disconnected: {sid}")

# Socket event: GET_STATE
@sio.on('GET_STATE')
async def handle_get_state(sid):
    state = get_full_state_sync()
    state["serialPorts"] = hw.get_available_ports()
    await sio.emit('STATE_UPDATE', state, to=sid)

# Socket event: SCAN_PORTS
@sio.on('SCAN_PORTS')
async def handle_scan_ports(sid):
    ports = hw.get_available_ports()
    if not ports:
        ports = ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyACM0", "/dev/ttyAMA0", "/dev/ttyAMA1"]
    await sio.emit('AVAILABLE_PORTS', ports, to=sid)

# Socket event: ACTION
@sio.on('ACTION')
async def handle_action(sid, data):
    action_type = data.get('type')
    payload = data.get('payload', {})
    
    print(f"[Socket] Action received: {action_type}")
    
    # DB transaction handle
    if action_type == 'SET_MODE':
        new_mode = payload.get('mode', 'BEKLEMEDE')
        db.execute("UPDATE system_state SET mode = ? WHERE id = 1", (new_mode,))
        if new_mode == 'YIKAMA':
            db.execute("UPDATE system_state SET isWashingDone = 0 WHERE id = 1")
        add_log(f"Sistem çalışma modu güncellendi: {new_mode}")
        
    elif action_type == 'START_AUTO_CYCLE':
        db.execute("UPDATE system_state SET mode = 'OTOMATİK', autoState = 'BEKLEMEDE', inputCount = 0, outputCount = 0 WHERE id = 1")
        db.execute("DELETE FROM active_alerts WHERE code = 'ERR_ULTRASONIC_LOW'")
        add_log("Otomatik üretim döngüsü başlatıldı.")
        
    elif action_type == 'ACKNOWLEDGE_STARTUP':
        db.execute("UPDATE system_state SET mode = 'BEKLEMEDE' WHERE id = 1")
        add_log("Başlangıç doğrulaması onaylandı. Sistem Hazır.")

    elif action_type == 'ACKNOWLEDGE_FAULT':
        db.execute("DELETE FROM active_alerts")
        db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE' WHERE id = 1")
        add_log("Tüm sistem arıza ve alarmları sıfırlandı.")

    elif action_type == 'TOGGLE_VALVE':
        vid = payload.get('id')
        row = db.fetchone("SELECT isOpen, pin, device, nanoId FROM valves WHERE id = ?", (vid,))
        if row:
            new_state = 1 - row['isOpen']
            target_device = row['nanoId'] if row['device'] == 'NANO' else row['device']
            if not target_device or target_device == 'NANO':
                target_device = 'ValvesNano'
            hw.control_valve(vid, row['pin'], new_state, target_device)
            db.execute("UPDATE valves SET isOpen = ? WHERE id = ?", (new_state, vid))
            add_log(f"Valf {vid} ({row['pin']}) durumu değiştirildi: {'AÇIK' if new_state else 'KAPALI'}")

    elif action_type == 'SET_VALVE_MODE':
        vid = payload.get('id')
        vmode = payload.get('mode', 'CONTINUOUS')
        db.execute("UPDATE valves SET mode = ? WHERE id = ?", (vmode, vid))
        add_log(f"Valf {vid} tetikleme modu güncellendi: {vmode}")

    elif action_type == 'SET_VALVE_PULSE':
        vid = payload.get('id')
        duration = payload.get('duration', 1000)
        db.execute("UPDATE valves SET pulseDuration = ? WHERE id = ?", (duration, vid))
        add_log(f"Valf {vid} darbe (pulse) süresi güncellendi: {duration} ms")

    elif action_type == 'OPERATE_GATE':
        target = payload.get('target') # 'inputGate' or 'outputGate'
        
        # Cast position, steps, and speed safely to integers to prevent type comparison crashes
        try:
            position = int(payload.get('position', 0))
        except (ValueError, TypeError):
            position = 0
            
        try:
            steps = int(payload.get('steps')) if payload.get('steps') is not None else None
        except (ValueError, TypeError):
            steps = None
            
        try:
            speed = int(payload.get('speed')) if payload.get('speed') is not None else None
        except (ValueError, TypeError):
            speed = None
            
        is_open = (position > 0)
        
        # Get pin and device for the gate
        gate = db.fetchone("SELECT pin, device, nanoId FROM gates WHERE id = ?", (target,))
        if gate:
            target_device = gate['nanoId'] if gate['device'] == 'NANO' else gate['device']
            if not target_device or target_device == 'NANO':
                target_device = 'GatesNano'
            hw.control_gate(target, gate['pin'], is_open, target_device, steps=steps, speed=speed)
            db.execute("UPDATE gates SET position = ?, isOpen = ? WHERE id = ?", (position, 1 if is_open else 0, target))
            add_log(f"Kilit motoru çalıştırıldı ({target}) -> Pozisyon: {position}, {'AÇIK' if is_open else 'KAPALI'}")

    elif action_type == 'TOGGLE_GATE_ENABLED':
        target = payload.get('target') or payload.get('id')
        db.execute("UPDATE gates SET enabled = 1 - enabled WHERE id = ?", (target,))
        add_log(f"Kapı/Kilit ({target}) aktiflik durumu değiştirildi.")

    elif action_type == 'TRIGGER_FAULT':
        ftype = payload.get('type', 'GENERAL_FAULT')
        alert_id = f"ALERT-{int(time.time())}"
        db.execute("INSERT INTO active_alerts (id, code, message, severity, timestamp) VALUES (?, ?, 'Acil Durdurma / Sistem Arızası Tetiklendi', 'CRITICAL', ?)",
                   (alert_id, ftype, time.time()))
        db.execute("UPDATE system_state SET mode = 'ARIZA', autoState = 'BEKLEMEDE' WHERE id = 1")
        hw.all_valves_off()
        db.execute("UPDATE valves SET isOpen = 0")
        add_log("Kritik Hata: Sistem ARIZA moduna alındı, tüm valfler kapatıldı!")

    elif action_type == 'UPDATE_CONFIG':
        config = payload.get('config', {})
        for k, v in config.items():
            db.execute(f"UPDATE system_config SET {k} = ? WHERE id = 1", (v,))
        add_log("Sistem parametreleri veritabanında güncellendi.")

    elif action_type == 'ADD_VALVE':
        v = payload.get('valve', {})
        db.execute("INSERT OR REPLACE INTO valves (id, name, pin, enabled, isOpen, mode, pulseDuration, device, nanoId, relayInversion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (v.get('id'), v.get('name'), v.get('pin'), 1 if v.get('enabled', True) else 0, 0, v.get('mode', 'CONTINUOUS'), v.get('pulseDuration', 1000), v.get('device', 'NANO'), v.get('nanoId'), 1 if v.get('relayInversion', False) else 0))
        add_log(f"Yeni vana eklendi: {v.get('name')} (Pin {v.get('pin')})")

    elif action_type == 'REMOVE_VALVE':
        vid = payload.get('id')
        db.execute("DELETE FROM valves WHERE id = ?", (vid,))
        add_log(f"Valf {vid} veritabanından silindi.")

    elif action_type == 'TOGGLE_HARDWARE_STATUS':
        vid = payload.get('id')
        db.execute("UPDATE valves SET enabled = 1 - enabled WHERE id = ?", (vid,))
        add_log(f"Valf {vid} donanım aktiflik durumu değiştirildi.")

    elif action_type == 'SEND_NANO_COMMAND':
        nano_id = payload.get('nanoId')
        cmd = payload.get('cmd', '')
        
        # Find port for target Nano
        port = next((p for p, d_id in hw.port_to_id_map.items() if d_id == nano_id), None)
        if port:
            hw.send_command(cmd, target_port=port)
            add_log(f"Komut gönderildi -> ({nano_id}): {cmd}")
        else:
            add_log(f"Komut gönderme başarısız: ({nano_id}) çevrimdışı.")

    elif action_type == 'UPDATE_NANO_CONFIG':
        nid = payload.get('id')
        config = payload.get('config', {})
        for k, v in config.items():
            db.execute(f"UPDATE nanos SET {k} = ? WHERE id = ?", (v, nid))
        add_log(f"Arduino Nano ({nid}) donanım ayarları güncellendi.")
        reload_hardware_config()

    elif action_type == 'UPDATE_VALVE':
        vid = payload.get('id')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            db.execute(f"UPDATE valves SET {k} = ? WHERE id = ?", (v, vid))
        add_log(f"Valf {vid} ayarları güncellendi.")

    elif action_type == 'UPDATE_SENSOR':
        sid_val = payload.get('id')
        updates = payload.get('updates', {})
        
        # Convert UI device/connectionId updates back to DB's device field
        if "device" in updates or "connectionId" in updates:
            current = db.fetchone("SELECT * FROM sensors WHERE id = ?", (sid_val,))
            if current:
                new_device_type = updates.get("device")
                if not new_device_type:
                    new_device_type = "RASPI" if current.get("device") == "RASPI" else "NANO"
                
                new_conn_id = updates.get("connectionId")
                if not new_conn_id:
                    new_conn_id = current.get("device") if current.get("device") != "RASPI" else ""
                
                if new_device_type == "RASPI":
                    updates["device"] = "RASPI"
                else:
                    if not new_conn_id or new_conn_id == "RASPI":
                        first_nano = db.fetchone("SELECT id FROM nanos LIMIT 1")
                        new_conn_id = first_nano["id"] if first_nano else "GatesNano"
                    updates["device"] = new_conn_id
                    
                updates.pop("connectionId", None)

        for k, v in list(updates.items()):
            db.execute(f"UPDATE sensors SET {k} = ? WHERE id = ?", (v, sid_val))
        add_log(f"Sayaç Sensörü {sid_val} ayarları güncellendi.")
        reload_hardware_config()

    elif action_type == 'UPDATE_GATE':
        gid = payload.get('id')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            db.execute(f"UPDATE gates SET {k} = ? WHERE id = ?", (v, gid))
        add_log(f"Ek Kilit {gid} ayarları güncellendi.")

    elif action_type == 'UPDATE_SYSTEM_GATE':
        target = payload.get('target')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            db.execute(f"UPDATE gates SET {k} = ? WHERE id = ?", (v, target))
        add_log(f"Sistem Kilit Kapısı ({target}) ayarları güncellendi.")

    elif action_type == 'TOGGLE_SENSOR_ENABLED':
        sid_val = payload.get('id')
        db.execute("UPDATE sensors SET enabled = 1 - enabled WHERE id = ?", (sid_val,))
        add_log(f"Sensör {sid_val} aktiflik durumu değiştirildi.")

    elif action_type == 'RESET_TEST_COUNTERS':
        db.execute("UPDATE system_state SET testInputCount = 0, testOutputCount = 0 WHERE id = 1")
        add_log("Sensör test sayaçları sıfırlandı.")

    elif action_type == 'ADD_SENSOR':
        s = payload.get('sensor', {})
        
        # Map UI sensor device to DB device schema
        ui_dev = s.get('device', 'RASPI')
        db_device = 'RASPI' if ui_dev == 'RASPI' else s.get('connectionId', '')
        
        db.execute("INSERT OR REPLACE INTO sensors (id, name, type, pin, enabled, device, debounceMs, resistorType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (s.get('id'), s.get('name'), s.get('type'), s.get('pin'), 1 if s.get('enabled', True) else 0, db_device, s.get('debounceMs', 50), s.get('resistorType', 'NONE')))
        add_log(f"Yeni sensör eklendi: {s.get('name')} (Pin {s.get('pin')})")
        reload_hardware_config()

    elif action_type == 'REMOVE_SENSOR':
        sid_val = payload.get('id')
        db.execute("DELETE FROM sensors WHERE id = ?", (sid_val,))
        add_log(f"Sensör {sid_val} veritabanından kaldırıldı.")

    elif action_type == 'ADD_GATE':
        g = payload.get('gate', {})
        db.execute("INSERT OR REPLACE INTO gates (id, name, pin, dirPin, enablePin, stepsToOpen, stepsToClose, speed, isOpen, enabled, device, nanoId, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (g.get('id'), g.get('name'), g.get('pin'), g.get('dirPin'), g.get('enablePin'), g.get('stepsToOpen', 400), g.get('stepsToClose', 400), g.get('speed', 800), 0, 1 if g.get('enabled', True) else 0, g.get('device', 'NANO'), g.get('nanoId'), g.get('position', 0)))
        add_log(f"Yeni kilit motoru eklendi: {g.get('name')}")

    elif action_type == 'REMOVE_GATE':
        gid = payload.get('id')
        db.execute("DELETE FROM gates WHERE id = ?", (gid,))
        add_log(f"Kilit motoru {gid} silindi.")

    elif action_type == 'OPERATE_EXTRA_GATE':
        gid = payload.get('id')
        row = db.fetchone("SELECT isOpen, pin, device, nanoId FROM gates WHERE id = ?", (gid,))
        if row:
            new_state = 1 - row['isOpen']
            target_device = row['nanoId'] if row['device'] == 'NANO' else row['device']
            if not target_device or target_device == 'NANO':
                target_device = 'GatesNano'
            hw.control_gate(gid, row['pin'], new_state, target_device)
            db.execute("UPDATE gates SET isOpen = ? WHERE id = ?", (new_state, gid))
            add_log(f"Ek kilit {gid} durumu değiştirildi: {'AÇIK' if new_state else 'KAPALI'}")

    elif action_type == 'ADD_HARDWARE':
        n = payload.get('nano', {})
        db.execute("INSERT OR REPLACE INTO nanos (id, name, port, baudRate, status) VALUES (?, ?, ?, ?, 'OFFLINE')",
                   (n.get('id'), n.get('name'), n.get('port'), n.get('baudRate', 115200)))
        add_log(f"Yeni donanım denetleyici (Nano) tanımlandı: {n.get('name')}")

    elif action_type == 'REMOVE_HARDWARE':
        nid = payload.get('id')
        db.execute("DELETE FROM nanos WHERE id = ?", (nid,))
        add_log(f"Denetleyici {nid} kaldırıldı.")

    elif action_type == 'MANAGE_COUNTER':
        target = payload.get('target') # 'input' or 'output'
        op = payload.get('op', 'reset')
        key = 'inputCount' if target == 'input' else 'outputCount'
        row = db.fetchone("SELECT * FROM system_state WHERE id = 1")
        if row:
            val = row[key] or 0
            if op == 'inc':
                val += 1
            elif op == 'dec':
                val = max(0, val - 1)
            else:
                val = 0
            db.execute(f"UPDATE system_state SET {key} = ? WHERE id = 1", (val,))
            add_log(f"Üretim sayacı güncellendi ({target}): {op} -> {val}")

    elif action_type == 'SELECT_RECIPE':
        rid = payload.get('id')
        db.execute("UPDATE system_config SET recipeId = ? WHERE id = 1", (rid,))
        
        recipe = db.fetchone("SELECT * FROM recipes WHERE id = ?", (rid,))
        if recipe:
            db.execute("UPDATE system_config SET targetCount = ?, fillTimeMs = ?, volumeMl = ?, settlingTimeMs = ?, dripWaitTimeMs = ? WHERE id = 1",
                       (recipe["targetCount"], recipe["fillTimeMs"], recipe["volumeMl"], recipe["settlingTimeMs"], recipe["dripWaitTimeMs"]))
            add_log(f"Reçete seçildi: {recipe['name']}. Döngü parametreleri senkronize edildi.")
        else:
            add_log(f"Reçete ID seçildi: {rid}")

    elif action_type == 'ADD_RECIPE':
        r = payload.get('recipe', {})
        valve_durs = json.dumps(r.get('valveDurations', {}))
        db.execute("INSERT OR REPLACE INTO recipes (id, name, description, targetCount, fillTimeMs, volumeMl, settlingTimeMs, dripWaitTimeMs, valveDurations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (r.get('id'), r.get('name'), r.get('description'), r.get('targetCount', 10), r.get('fillTimeMs', 1000), r.get('volumeMl', 250), r.get('settlingTimeMs', 150), r.get('dripWaitTimeMs', 150), valve_durs))
        add_log(f"Yeni reçete kaydedildi: {r.get('name')}")

    elif action_type == 'REMOVE_RECIPE':
        rid = payload.get('id')
        db.execute("DELETE FROM recipes WHERE id = ?", (rid,))
        add_log(f"Reçete {rid} veritabanından silindi.")

    elif action_type == 'UPDATE_RECIPE':
        rid = payload.get('id')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            if k == 'valveDurations':
                v = json.dumps(v)
            db.execute(f"UPDATE recipes SET {k} = ? WHERE id = ?", (v, rid))
        
        # Sync changes to system_config if this is the active recipe
        active_cfg = db.fetchone("SELECT recipeId FROM system_config WHERE id = 1")
        if active_cfg and active_cfg["recipeId"] == rid:
            recipe = db.fetchone("SELECT * FROM recipes WHERE id = ?", (rid,))
            if recipe:
                db.execute("UPDATE system_config SET targetCount = ?, fillTimeMs = ?, volumeMl = ?, settlingTimeMs = ?, dripWaitTimeMs = ? WHERE id = 1",
                           (recipe["targetCount"], recipe["fillTimeMs"], recipe["volumeMl"], recipe["settlingTimeMs"], recipe["dripWaitTimeMs"]))
                
        add_log(f"Reçete {rid} parametreleri güncellendi.")

    elif action_type == 'ANSWER_PROMPT':
        db.execute("UPDATE system_state SET activePrompt = NULL WHERE id = 1")
        add_log("Kullanıcı doğrulaması yanıtlandı.")

    elif action_type == 'REQUEST_STOP_AFTER_CYCLE':
        row = db.fetchone("SELECT stopAfterCycleRequested FROM system_state WHERE id = 1")
        if row:
            new_val = 1 - row['stopAfterCycleRequested']
            db.execute("UPDATE system_state SET stopAfterCycleRequested = ? WHERE id = 1", (new_val,))
            add_log(f"Döngü sonu durdurma talebi: {'AKTİF' if new_val else 'İPTAL'}")

    elif action_type == 'SYSTEM_RESET':
        db.execute("DELETE FROM nanos")
        db.execute("DELETE FROM valves")
        db.execute("DELETE FROM sensors")
        db.execute("DELETE FROM gates")
        db.execute("DELETE FROM recipes")
        db.execute("DELETE FROM cycle_history")
        db.execute("DELETE FROM active_alerts")
        db.execute("DELETE FROM terminal_logs")
        db.execute("UPDATE system_config SET recipeId = '', targetCount = 0, fillTimeMs = 0 WHERE id = 1")
        db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE', inputCount = 0, outputCount = 0, tankLevelCm = 85, isWashingDone = 0, isWashingRequired = 0, stopAfterCycleRequested = 0, activePrompt = NULL WHERE id = 1")
        db.execute("INSERT OR IGNORE INTO gates (id, name, pin, isOpen, enabled, device) VALUES ('inputGate', 'Giriş Kapısı', 'G1', 0, 1, 'NANO')")
        db.execute("INSERT OR IGNORE INTO gates (id, name, pin, isOpen, enabled, device) VALUES ('outputGate', 'Çıkış Kapısı', 'G2', 0, 1, 'NANO')")
        hw.cleanup()
        add_log("Sistem tamamen sıfırlandı.")

    elif action_type == 'SOFT_REBOOT':
        # 1. Cancel active production loops
        prod.is_running = False
        if prod.step_task:
            try:
                prod.step_task.cancel()
            except:
                pass
            prod.step_task = None
        
        # 2. Force all valves off
        try:
            hw.all_valves_off()
        except Exception as e:
            print(f"[Soft Reboot] Valves off failed: {e}")
            
        # 3. Reset states in DB (keep settings, recipes)
        db.execute("UPDATE valves SET isOpen = 0")
        db.execute("UPDATE gates SET isOpen = 0, position = 0")
        db.execute("DELETE FROM active_alerts")
        db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE', stopAfterCycleRequested = 0, activePrompt = NULL WHERE id = 1")
        
        # 4. Cleanup connections
        try:
            hw.cleanup()
        except Exception as e:
            print(f"[Soft Reboot] Hardware cleanup failed: {e}")
            
        # 5. Reload hardware config
        reload_hardware_config()
        
        add_log("Sistem sanal sıfırlama (Soft Reboot) ve bağlantı yenileme işlemi yapıldı.")

    elif action_type == 'TEST_VALVE_PULSE':
        vid = payload.get('id')
        duration = payload.get('duration', 1000)
        row = db.fetchone("SELECT pin, device, nanoId FROM valves WHERE id = ?", (vid,))
        if row:
            target_device = row['nanoId'] if row['device'] == 'NANO' else row['device']
            if not target_device or target_device == 'NANO':
                target_device = 'ValvesNano'
            async def run_pulse():
                try:
                    db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (vid,))
                    broadcast_callback()
                    start_t = time.time()
                    await hw.pulse_valve(vid, row['pin'], duration, target_device)
                    elapsed = int((time.time() - start_t) * 1000)
                    add_log(f"Manuel valf darbe testi tamamlandı -> Valf: {vid}, Hedef: {duration} ms, Gerçekleşen: {elapsed} ms")
                finally:
                    db.execute("UPDATE valves SET isOpen = 0 WHERE id = ?", (vid,))
                    broadcast_callback()
            asyncio.create_task(run_pulse())
            add_log(f"Manuel valf darbe testi tetiklendi -> Valf: {vid}, Süre: {duration} ms")
        
    elif action_type == 'START_OPERATOR_FILL':
        method = payload.get('method', 'SEQUENTIAL')
        asyncio.create_task(prod.trigger_operator_fill(method))
        add_log(f"Operatör manuel dolum sırası tetiklendi (Yöntem: {method}).")
        
    elif action_type == 'RESET_GATES':
        target_port = next((p for p, d_id in hw.port_to_id_map.items() if d_id == "GatesNano"), None)
        if not target_port and "GatesNano" in hw.network_conns:
            target_port = "GatesNano"
            
        if target_port:
            hw.send_command("GET_LIMITS", target_port=target_port)
            add_log("Kilit sınır anahtarı durumları sorgulandı (Sıfırlandı).")
        else:
            add_log("Hata: GatesNano bağlı değil, kilit sınır anahtarları sorgulanamadı.")
        
    else:
        print(f"[Socket] Unknown action: {action_type}")

    # Actions that require reloading hardware configurations
    hw_actions = {
        'ADD_VALVE', 'REMOVE_VALVE', 'TOGGLE_HARDWARE_STATUS', 
        'UPDATE_NANO_CONFIG', 'UPDATE_VALVE', 'UPDATE_SENSOR', 
        'UPDATE_GATE', 'UPDATE_SYSTEM_GATE', 'TOGGLE_SENSOR_ENABLED', 
        'ADD_SENSOR', 'REMOVE_SENSOR', 'ADD_GATE', 'REMOVE_GATE', 
        'ADD_HARDWARE', 'REMOVE_HARDWARE', 'SYSTEM_RESET', 'UPDATE_CONFIG',
        'TOGGLE_GATE_ENABLED'
    }
    
    if action_type in hw_actions:
        reload_hardware_config()

    # Broadcast update
    broadcast_callback()

# Keep track of last reconnect attempt times to avoid console spam
last_reconnect_attempts = {}
last_port_scan_time = 0

# Background serial read polling loop
async def serial_polling_loop():
    global last_port_scan_time
    last_db_sync_time = 0.0
    while True:
        try:
            hw.update_serial_read()
            
            now = time.time()
            if now - last_db_sync_time > 2.0:
                last_db_sync_time = now
                
                # Sync connection statuses in DB
                nanos = db.fetchall("SELECT * FROM nanos")
                
                # 1. Self-healing for configured Nanos
                for n in nanos:
                    port = n["port"]
                    if port:
                        is_online = hw.is_port_online(port, expected_nano_id=n["id"])
                        status_str = "ONLINE" if is_online else "OFFLINE"
                        if n["status"] != status_str:
                            db.execute("UPDATE nanos SET status = ? WHERE id = ?", (status_str, n["id"]))
                            add_log(f"Denetleyici ({n['id']}) bağlantı durumu değişti: {status_str}")
                            broadcast_callback()
                            
                        # Self-healing auto reconnect with 10 seconds cooldown
                        if not is_online and not str(port).startswith("TCP:"):
                            last_attempt = last_reconnect_attempts.get(port, 0)
                            if now - last_attempt > 10.0:
                                last_reconnect_attempts[port] = now
                                hw.connect_to_port(port, n["baudRate"], expected_nano_id=n["id"])
                
                # 2. Auto-discovery for newly plugged-in or swapped ports
                if now - last_port_scan_time > 10.0:
                    last_port_scan_time = now
                    available_ports = hw.get_available_ports()
                    
                    for port in available_ports:
                        # Skip scanning hardware UART ports in auto-discovery to avoid freezing the main thread
                        if any(x in port.lower() for x in ["ttyama", "ttys"]):
                            continue
                            
                        resolved_p = hw.resolve_port_path(port)
                        # If this port is not currently connected in memory, scan it to discover its identity
                        if resolved_p not in hw.serial_conns:
                            connected = hw.connect_to_port(port, baudrate=115200, verbose=False)
                            if not connected:
                                hw.connect_to_port(port, baudrate=9600, verbose=False)
        except Exception as e:
            pass
        await asyncio.sleep(0.1) # Fast poll to keep serial responsive

# Background ultrasonic sensor reading loop (Periodic Averaging & GatesNano Relay control)
async def ultrasonic_polling_loop():
    global ultrasonic_session
    while True:
        try:
            config = db.fetchone("SELECT * FROM system_config WHERE id = 1")
            if config:
                interval_min = config.get("ultrasonicIntervalMin", 3)
                threshold_cm = config.get("ultrasonicThresholdCm", 30)
                relay_pin = config.get("ultrasonicRelayPin", "11")
                relay_duration_ms = config.get("ultrasonicRelayDurationMs", 5000)
                trig = config["ultrasonicTrigPin"]
                echo = config["ultrasonicEchoPin"]
                dev = config["ultrasonicDevice"]
                
                now = time.time()
                # Run periodically every `interval_min` minutes.
                # If first run (last_run == 0.0), trigger measurement after 10 seconds.
                if ultrasonic_session["last_run"] == 0.0:
                    ultrasonic_session["last_run"] = now - (interval_min * 60.0) + 10.0
                    
                interval_sec = interval_min * 60.0
                if now - ultrasonic_session["last_run"] >= interval_sec:
                    ultrasonic_session["last_run"] = now
                    ultrasonic_session["readings"] = []
                    ultrasonic_session["active"] = True
                    
                    add_log("Seviye Ölçümü: Periyodik ultrasonik ölçüm başladı (10 okuma toplanıyor)...")
                    
                    # Request 12 readings (0.5s interval) to guarantee we gather at least 10 valid values
                    for _ in range(12):
                        hw.request_ultrasonic_distance(trig, echo, dev)
                        await asyncio.sleep(0.5)
                        
                    ultrasonic_session["active"] = False
                    valid_readings = ultrasonic_session["readings"]
                    
                    if len(valid_readings) >= 5:
                        # Compute average of up to 10 valid readings
                        readings_to_use = valid_readings[:10]
                        avg_distance = sum(readings_to_use) / len(readings_to_use)
                        
                        prev_avg = ultrasonic_session["prev_average"]
                        diff_str = f" (Önceki: {prev_avg:.1f} cm)" if prev_avg is not None else ""
                        add_log(f"Seviye Ölçümü: 10 okuma ortalaması = {avg_distance:.1f} cm{diff_str}")
                        
                        # Update system state tankLevelCm with average value
                        db.execute("UPDATE system_state SET tankLevelCm = ? WHERE id = 1", (int(avg_distance),))
                        broadcast_callback()
                        
                        # Trigger GatesNano relay if level drops below threshold
                        if avg_distance < threshold_cm:
                            add_log(f"Kritik Seviye Uyarısı: Şerbet mesafesi ({avg_distance:.1f} cm) kritik sınırın ({threshold_cm} cm) altında! GatesNano Rölesi (D{relay_pin}) {relay_duration_ms / 1000.0:.1f} sn açılıyor...")
                            
                            # Turn GatesNano relay ON
                            hw.control_valve(None, relay_pin, True, "GatesNano")
                            # Wait for duration
                            await asyncio.sleep(relay_duration_ms / 1000.0)
                            # Turn GatesNano relay OFF
                            hw.control_valve(None, relay_pin, False, "GatesNano")
                            
                            add_log(f"GatesNano Rölesi (D{relay_pin}) kapatıldı.")
                            
                        ultrasonic_session["prev_average"] = avg_distance
                    else:
                        add_log("Seviye Ölçümü Hata: Yeterli miktarda güvenilir ultrasonik okuma alınamadı.")
        except Exception as e:
            print(f"[Ultrasonic Polling Error] {e}")
        await asyncio.sleep(5.0)

# Async Context helper to handle background loops
async def start_background_tasks(app):
    init_db()
    
    # Fetch and apply initial hardware and sensor configuration
    nanos = db.fetchall("SELECT * FROM nanos")
    sensors = db.fetchall("SELECT * FROM sensors")
    hw.apply_config(nanos, sensors)
    
    # Spawn core loops
    app['serial_task'] = asyncio.create_task(serial_polling_loop())
    app['ultrasonic_task'] = asyncio.create_task(ultrasonic_polling_loop())
    app['production_task'] = asyncio.create_task(prod.run_loop())
    app['tcp_task'] = asyncio.create_task(hw.start_tcp_server(host="0.0.0.0", port=1978))
    app['udp_task'] = asyncio.create_task(hw.start_udp_discovery_server(host="0.0.0.0", port=1978))

async def cleanup_background_tasks(app):
    app['serial_task'].cancel()
    app['ultrasonic_task'].cancel()
    app['production_task'].cancel()
    app['tcp_task'].cancel()
    app['udp_task'].cancel()
    await asyncio.gather(
        app['serial_task'], 
        app['ultrasonic_task'], 
        app['production_task'], 
        app['tcp_task'], 
        app['udp_task'], 
        return_exceptions=True
    )
    hw.cleanup()

# Server Startup
if __name__ == '__main__':
    app = web.Application()
    sio.attach(app)
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)
    
    port = 8000
    print(f"[Server] Starting python backend server on port {port}...")
    web.run_app(app, host='0.0.0.0', port=port)
