import os
import sys
import json
import time
import asyncio
import sqlite3
from datetime import datetime
import socketio
from aiohttp import web

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
                        # Ignore issues if columns/tables exist
                        pass
            conn.commit()
            conn.close()
            print("[DB] Schema structure check completed.")
        except Exception as e:
            print(f"[DB] Error checking schema structure: {e}")

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

    # Convert config row to dict
    config = dict(config_row) if config_row else {}
    config.pop("id", None)
    # Convert booleans
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

    # Merge everything
    system_data = {
        "mode": state_row.get("mode", "BEKLEMEDE") if state_row else "BEKLEMEDE",
        "autoState": state_row.get("autoState", "BEKLEMEDE") if state_row else "BEKLEMEDE",
        "inputCount": state_row.get("inputCount", 0) if state_row else 0,
        "outputCount": state_row.get("outputCount", 0) if state_row else 0,
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

# State & Sim Variables
class SimulationState:
    def __init__(self):
        self.step_timer = 0
        self.wash_timer = 0
        self.flush_timer = 0
        self.current_valve_pulse = {} # valve_id: duration_left

sim_state = SimulationState()

# Socket event: Connect
@sio.event
async def connect(sid, environ):
    print(f"[Socket] Client connected: {sid}")

# Socket event: Disconnect
@sio.event
async def disconnect(sid):
    print(f"[Socket] Client disconnected: {sid}")

# Socket event: GET_STATE
@sio.on('GET_STATE')
async def handle_get_state(sid):
    state = get_full_state_sync()
    await sio.emit('STATE_UPDATE', state, to=sid)

# Socket event: SCAN_PORTS
@sio.on('SCAN_PORTS')
async def handle_scan_ports(sid):
    import serial.tools.list_ports
    ports = [p.device for p in serial.tools.list_ports.comports()]
    if not ports:
        ports = ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyACM0"]
    await sio.emit('AVAILABLE_PORTS', ports, to=sid)

# Socket event: ACTION
@sio.on('ACTION')
async def handle_action(sid, data):
    action_type = data.get('type')
    payload = data.get('payload', {})
    
    print(f"[Socket] Action received: {action_type} with payload: {payload}")
    
    # DB transaction handle
    if action_type == 'SET_MODE':
        new_mode = payload.get('mode', 'BEKLEMEDE')
        db.execute("UPDATE system_state SET mode = ? WHERE id = 1", (new_mode,))
        if new_mode == 'YIKAMA':
            db.execute("UPDATE system_state SET isWashingDone = 0 WHERE id = 1")
        add_log(f"Sistem çalışma modu güncellendi: {new_mode}")
        
    elif action_type == 'START_AUTO_CYCLE':
        # Reset counters and trigger cycle
        db.execute("UPDATE system_state SET mode = 'OTOMATİK', autoState = 'BEKLEMEDE', inputCount = 0, outputCount = 0 WHERE id = 1")
        # Acknowledge any critical low error alert resolved
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
        row = db.fetchone("SELECT isOpen FROM valves WHERE id = ?", (vid,))
        if row:
            new_state = 1 - row['isOpen']
            db.execute("UPDATE valves SET isOpen = ? WHERE id = ?", (new_state, vid))
            add_log(f"Valf {vid} durumu değiştirildi: {'AÇIK' if new_state else 'KAPALI'}")

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
        position = payload.get('position', 0)
        is_open = 1 if position > 0 else 0
        db.execute("UPDATE gates SET position = ?, isOpen = ? WHERE id = ?", (position, is_open, target))
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
        db.execute("UPDATE valves SET isOpen = 0") # Close all valves
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
        add_log(f"Komut gönderildi -> ({nano_id}): {cmd}")
        # Send back a terminal response simulator
        response = f"\r\n[Nano-{nano_id} OK] Command processed successfully: {cmd}\r\n"
        await sio.emit('TERMINAL_OUTPUT', response, to=sid)

    elif action_type == 'UPDATE_NANO_CONFIG':
        nid = payload.get('id')
        config = payload.get('config', {})
        for k, v in config.items():
            db.execute(f"UPDATE nanos SET {k} = ? WHERE id = ?", (v, nid))
        add_log(f"Arduino Nano ({nid}) donanım ayarları güncellendi.")

    elif action_type == 'UPDATE_VALVE':
        vid = payload.get('id')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            db.execute(f"UPDATE valves SET {k} = ? WHERE id = ?", (v, vid))
        add_log(f"Valf {vid} ayarları güncellendi.")

    elif action_type == 'UPDATE_SENSOR':
        sid_val = payload.get('id')
        updates = payload.get('updates', {})
        for k, v in updates.items():
            db.execute(f"UPDATE sensors SET {k} = ? WHERE id = ?", (v, sid_val))
        add_log(f"Sayaç Sensörü {sid_val} ayarları güncellendi.")

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

    elif action_type == 'ADD_SENSOR':
        s = payload.get('sensor', {})
        db.execute("INSERT OR REPLACE INTO sensors (id, name, type, pin, enabled, device, debounceMs, resistorType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (s.get('id'), s.get('name'), s.get('type'), s.get('pin'), 1 if s.get('enabled', True) else 0, s.get('device', 'RASPI'), s.get('debounceMs', 50), s.get('resistorType', 'NONE')))
        add_log(f"Yeni sensör eklendi: {s.get('name')} (Pin {s.get('pin')})")

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
        row = db.fetchone("SELECT isOpen FROM gates WHERE id = ?", (gid,))
        if row:
            new_state = 1 - row['isOpen']
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
        
        # Pull recipe target count and configurations and sync into system_config
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
        # Re-seed default gates
        db.execute("INSERT OR IGNORE INTO gates (id, name, pin, isOpen, enabled, device) VALUES ('inputGate', 'Giriş Kapısı', 'G1', 0, 1, 'NANO')")
        db.execute("INSERT OR IGNORE INTO gates (id, name, pin, isOpen, enabled, device) VALUES ('outputGate', 'Çıkış Kapısı', 'G2', 0, 1, 'NANO')")
        add_log("Sistem tamamen fabrika ayarlarına sıfırlandı.")

    elif action_type == 'TEST_VALVE_PULSE':
        vid = payload.get('id')
        duration = payload.get('duration', 1000)
        db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (vid,))
        sim_state.current_valve_pulse[vid] = duration
        add_log(f"Manuel valf darbe testi tetiklendi -> Valf: {vid}, Süre: {duration} ms")
        
    elif action_type == 'START_OPERATOR_FILL':
        # Trigger temporary operator fill sequence
        add_log("Operatör manuel dolum sırası tetiklendi.")
        
    else:
        print(f"[Socket] Unknown action: {action_type}")

    # After any action, broadcast the updated state
    state = get_full_state_sync()
    await sio.emit('STATE_UPDATE', state)


# Asynchronous state machine simulation loop
async def simulation_loop():
    print("[Simulator] Background simulation loop started.")
    while True:
        try:
            state_row = db.fetchone("SELECT * FROM system_state WHERE id = 1")
            if not state_row:
                await asyncio.sleep(0.5)
                continue
                
            mode = state_row["mode"]
            auto_state = state_row["autoState"]
            input_count = state_row["inputCount"]
            output_count = state_row["outputCount"]
            tank_level = state_row["tankLevelCm"]
            stop_after_cycle = state_row["stopAfterCycleRequested"]

            config_row = db.fetchone("SELECT * FROM system_config WHERE id = 1")
            target_count = config_row["targetCount"] if config_row else 10
            fill_time_ms = config_row["fillTimeMs"] if config_row else 1000
            settling_time_ms = config_row["settlingTimeMs"] if config_row else 150
            drip_wait_ms = config_row["dripWaitTimeMs"] if config_row else 150
            
            state_changed = False

            # 1. Manual Valve Pulse Timer handler
            pulse_keys_to_del = []
            for vid, time_left in sim_state.current_valve_pulse.items():
                new_time = time_left - 500
                if new_time <= 0:
                    db.execute("UPDATE valves SET isOpen = 0 WHERE id = ?", (vid,))
                    pulse_keys_to_del.append(vid)
                    add_log(f"Valf {vid} darbe süresi doldu, kapatıldı.")
                    state_changed = True
                else:
                    sim_state.current_valve_pulse[vid] = new_time
            for k in pulse_keys_to_del:
                del sim_state.current_valve_pulse[k]

            # 2. Modes simulation
            if mode == "OTOMATİK":
                if auto_state == "BEKLEMEDE":
                    auto_state = "GIRIS_BEKLEME"
                    db.execute("UPDATE system_state SET autoState = 'GIRIS_BEKLEME' WHERE id = 1")
                    add_log("Otomatik üretim başlatıldı. Şişe bekleniyor...")
                    state_changed = True

                elif auto_state == "GIRIS_BEKLEME":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= 1500: # Wait for bottle
                        sim_state.step_timer = 0
                        auto_state = "GIRIS_KILITLI"
                        db.execute("UPDATE sensors SET enabled = 1 WHERE id = 'SENS-IN'")
                        db.execute("UPDATE gates SET isOpen = 1 WHERE id = 'inputGate'") # open entry gate
                        db.execute("UPDATE system_state SET autoState = 'GIRIS_KILITLI' WHERE id = 1")
                        add_log("Şişe giriş lazeri algılandı. Giriş kilidi açıldı.")
                        state_changed = True

                elif auto_state == "GIRIS_KILITLI":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= 1000: # Wait to lock
                        sim_state.step_timer = 0
                        auto_state = "DENGELEME"
                        input_count += 1
                        db.execute("UPDATE gates SET isOpen = 0 WHERE id = 'inputGate'") # close entry gate
                        db.execute("UPDATE system_state SET autoState = 'DENGELEME', inputCount = ? WHERE id = 1", (input_count,))
                        add_log(f"Giriş kilidi kapatıldı. Şişe kilitlendi. Toplam Giriş: {input_count}")
                        state_changed = True

                elif auto_state == "DENGELEME":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= settling_time_ms:
                        sim_state.step_timer = 0
                        auto_state = "DOLUM"
                        # Open active valves
                        db.execute("UPDATE valves SET isOpen = 1 WHERE enabled = 1")
                        db.execute("UPDATE system_state SET autoState = 'DOLUM' WHERE id = 1")
                        add_log("Dolum başlatıldı. Valfler açıldı.")
                        state_changed = True

                elif auto_state == "DOLUM":
                    sim_state.step_timer += 500
                    # Consume syrup
                    tank_level = max(0, tank_level - 1)
                    db.execute("UPDATE system_state SET tankLevelCm = ? WHERE id = 1", (tank_level,))
                    
                    critical_limit = config_row["ultrasonicCriticalLowPercent"] if config_row else 15
                    max_height = config_row["ultrasonicMaxHeightCm"] if config_row else 100
                    pct = ((max_height - tank_level) / max_height) * 100
                    
                    if pct <= critical_limit:
                        alert_id = f"ALERT-{int(time.time())}"
                        db.execute("INSERT OR IGNORE INTO active_alerts (id, code, message, severity, timestamp) VALUES (?, 'ERR_ULTRASONIC_LOW', 'Şerbet tankı seviyesi kritik derecede düşük!', 'CRITICAL', ?)",
                                   (alert_id, time.time()))
                        add_log("HATA: Şerbet tank seviyesi kritik limitin altında!")
                        mode = "ARIZA"
                        auto_state = "BEKLEMEDE"
                        db.execute("UPDATE system_state SET mode = 'ARIZA', autoState = 'BEKLEMEDE' WHERE id = 1")
                        db.execute("UPDATE valves SET isOpen = 0") # Close all valves
                        state_changed = True
                    elif sim_state.step_timer >= fill_time_ms:
                        sim_state.step_timer = 0
                        auto_state = "DAMLA_BEKLEME"
                        db.execute("UPDATE valves SET isOpen = 0") # Close all valves
                        db.execute("UPDATE system_state SET autoState = 'DAMLA_BEKLEME' WHERE id = 1")
                        add_log("Dolum tamamlandı. Damlama bekleniyor.")
                        state_changed = True

                elif auto_state == "DAMLA_BEKLEME":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= drip_wait_ms:
                        sim_state.step_timer = 0
                        auto_state = "TAHLIYE"
                        db.execute("UPDATE gates SET isOpen = 1 WHERE id = 'outputGate'") # open exit gate
                        db.execute("UPDATE system_state SET autoState = 'TAHLIYE' WHERE id = 1")
                        add_log("Damlama tamamlandı. Çıkış kilidi açıldı, tahliye ediliyor.")
                        state_changed = True

                elif auto_state == "TAHLIYE":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= 1000:
                        sim_state.step_timer = 0
                        auto_state = "DOGRULAMA"
                        output_count += 1
                        db.execute("UPDATE gates SET isOpen = 0 WHERE id = 'outputGate'") # close exit gate
                        db.execute("UPDATE system_state SET autoState = 'DOGRULAMA', outputCount = ? WHERE id = 1", (output_count,))
                        add_log(f"Çıkış kilidi kapatıldı. Toplam Çıkış: {output_count}")
                        state_changed = True

                elif auto_state == "DOGRULAMA":
                    sim_state.step_timer += 500
                    if sim_state.step_timer >= 500:
                        sim_state.step_timer = 0
                        
                        # Validation pass
                        if stop_after_cycle:
                            mode = "BEKLEMEDE"
                            auto_state = "BEKLEMEDE"
                            db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE', stopAfterCycleRequested = 0 WHERE id = 1")
                            add_log("Döngü sonu durdurma talebi tamamlandı. Üretim sonlandırıldı.")
                            
                            # Log cycle history
                            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            db.execute("INSERT INTO cycle_history (recipeId, timestamp, duration, inputCount, outputCount, status) VALUES (?, ?, ?, ?, ?, 'SUCCESS')",
                                       (config_row["recipeId"] if config_row else "", timestamp, fill_time_ms + settling_time_ms + drip_wait_ms + 3000, input_count, output_count))
                        elif input_count >= target_count:
                            mode = "BEKLEMEDE"
                            auto_state = "BEKLEMEDE"
                            db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE' WHERE id = 1")
                            add_log(f"Hedef üretim adedine ulaşıldı ({target_count}). Üretim tamamlandı.")
                            
                            # Log cycle history
                            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            db.execute("INSERT INTO cycle_history (recipeId, timestamp, duration, inputCount, outputCount, status) VALUES (?, ?, ?, ?, ?, 'SUCCESS')",
                                       (config_row["recipeId"] if config_row else "", timestamp, fill_time_ms + settling_time_ms + drip_wait_ms + 3000, input_count, output_count))
                        else:
                            auto_state = "GIRIS_BEKLEME"
                            db.execute("UPDATE system_state SET autoState = 'GIRIS_BEKLEME' WHERE id = 1")
                            add_log("Sonraki şişe bekleniyor...")
                        state_changed = True

            elif mode == "YIKAMA":
                wash_duration = config_row["washDurationMs"] if config_row else 30000
                wash_interval = config_row["washValveIntervalMs"] if config_row else 2000
                
                sim_state.wash_timer += 500
                if sim_state.wash_timer >= wash_duration:
                    sim_state.wash_timer = 0
                    db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', isWashingDone = 1 WHERE id = 1")
                    db.execute("UPDATE valves SET isOpen = 0")
                    add_log("Yıkama işlemi başarıyla tamamlandı. Sistem beklemede.")
                    state_changed = True
                else:
                    valves_list = db.fetchall("SELECT id FROM valves WHERE enabled = 1")
                    if valves_list:
                        active_idx = int(sim_state.wash_timer / wash_interval) % len(valves_list)
                        active_valve_id = valves_list[active_idx]["id"]
                        db.execute("UPDATE valves SET isOpen = 0")
                        db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (active_valve_id,))
                        state_changed = True

            elif mode == "TAHLIYE":
                db.execute("UPDATE valves SET isOpen = 1 WHERE enabled = 1")
                if tank_level < 100:
                    tank_level = min(100, tank_level + 2) # fill height goes to 100 (which is empty)
                    db.execute("UPDATE system_state SET tankLevelCm = ? WHERE id = 1", (tank_level,))
                    state_changed = True
                else:
                    db.execute("UPDATE system_state SET mode = 'BEKLEMEDE' WHERE id = 1")
                    db.execute("UPDATE valves SET isOpen = 0")
                    add_log("Tahliye tamamlandı. Şerbet kazanı boşaltıldı.")
                    state_changed = True

            if state_changed:
                state = get_full_state_sync()
                await sio.emit("STATE_UPDATE", state)

        except Exception as e:
            print(f"[Simulator Loop Error] {e}")
            
        await asyncio.sleep(0.5)

# Async Context helper to handle background loop
async def start_background_tasks(app):
    init_db()
    app['sim_task'] = asyncio.create_task(simulation_loop())

async def cleanup_background_tasks(app):
    app['sim_task'].cancel()
    await app['sim_task']

# Server Startup
if __name__ == '__main__':
    app = web.Application()
    sio.attach(app)
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)
    
    port = 8000
    print(f"[Server] Starting python backend server on port {port}...")
    web.run_app(app, host='0.0.0.0', port=port)
