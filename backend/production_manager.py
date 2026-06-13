import asyncio
import time
from datetime import datetime

class ProductionManager:
    def __init__(self, db, hw, broadcast_callback):
        self.db = db
        self.hw = hw
        self.broadcast_callback = broadcast_callback
        self.is_running = False
        self.step_task = None

    async def run_loop(self):
        """Monitor current system mode and spawn/kill active production cycles."""
        try:
            while True:
                try:
                    state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                    mode = state_row["mode"] if state_row else "BEKLEMEDE"
                    
                    if mode == "OTOMATİK":
                        if not self.is_running:
                            self.is_running = True
                            self.step_task = asyncio.create_task(self.auto_production_cycle())
                    elif mode == "YIKAMA":
                        if not self.is_running:
                            self.is_running = True
                            self.step_task = asyncio.create_task(self.washing_cycle())
                    elif mode == "TAHLIYE":
                        if not self.is_running:
                            self.is_running = True
                            self.step_task = asyncio.create_task(self.flush_cycle())
                    else:
                        # BEKLEMEDE or ARIZA
                        if self.is_running:
                            self.is_running = False
                            if self.step_task:
                                self.step_task.cancel()
                                self.step_task = None
                            # Safety: Turn all valves off on exit
                            self.hw.all_valves_off()
                            
                except Exception as e:
                    print(f"[Production Loop Error] {e}")
                await asyncio.sleep(0.5)
        finally:
            self.is_running = False
            if self.step_task:
                try:
                    self.step_task.cancel()
                except Exception:
                    pass
                self.step_task = None
            try:
                self.hw.all_valves_off()
            except Exception:
                pass

    def log(self, message):
        """Append log to terminal_logs table and trigger broadcast update."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        self.db.execute("INSERT INTO terminal_logs (timestamp, message) VALUES (?, ?)", (timestamp, formatted))
        print(f"[Production Log] {formatted}")
        self.broadcast_callback()

    async def washing_cycle(self):
        self.log("YIKAMA: Valf çalkalama programı başlatıldı.")
        
        try:
            while True:
                state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                if not state_row or state_row["mode"] != "YIKAMA":
                    break
                    
                config_row = self.db.fetchone("SELECT washDurationMs, washValveIntervalMs FROM system_config WHERE id = 1")
                wash_duration = config_row["washDurationMs"] if config_row else 30000
                wash_interval = config_row["washValveIntervalMs"] if config_row else 2000
                
                valves = self.db.fetchall("SELECT id, pin, device, nanoId FROM valves WHERE enabled = 1")
                if not valves:
                    self.log("UYARI: Yıkama için aktif vana bulunamadı.")
                    await asyncio.sleep(2.0)
                    continue
                    
                # Sequential valve pulsing
                for v in valves:
                    # Check if mode changed during iteration
                    state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                    if not state_row or state_row["mode"] != "YIKAMA":
                        break
                        
                    self.log(f"YIKAMA: Valf {v['id']} ({v['pin']}) açıldı.")
                    target_device = v["nanoId"] if v["device"] == "NANO" else v["device"]
                    if not target_device or target_device == "NANO":
                        target_device = "ValvesNano"
                    self.hw.control_valve(v["id"], v["pin"], True, target_device)
                    self.db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (v["id"],))
                    self.broadcast_callback()
                    
                    await asyncio.sleep(wash_interval / 1000.0)
                    
                    target_device = v["nanoId"] if v["device"] == "NANO" else v["device"]
                    if not target_device or target_device == "NANO":
                        target_device = "ValvesNano"
                    self.hw.control_valve(v["id"], v["pin"], False, target_device)
                    self.db.execute("UPDATE valves SET isOpen = 0 WHERE id = ?", (v["id"],))
                    self.broadcast_callback()
                
                # Check wash timer limit or loop continuously
                # For safety, let's pulse once through and set wash done
                break
                
            self.db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', isWashingDone = 1 WHERE id = 1")
            self.log("YIKAMA: Temizleme işlemi tamamlandı, sistem beklemede.")
        except asyncio.CancelledError:
            pass
        finally:
            self.hw.all_valves_off()
            self.db.execute("UPDATE valves SET isOpen = 0")
            self.is_running = False

    async def flush_cycle(self):
        self.log("TAHLİYE: Şerbet kazanı boşaltma çevrimi başlatıldı.")
        
        try:
            valves = self.db.fetchall("SELECT id, pin, device, nanoId FROM valves WHERE enabled = 1")
            # Open all active valves
            for v in valves:
                target_device = v["nanoId"] if v["device"] == "NANO" else v["device"]
                if not target_device or target_device == "NANO":
                    target_device = "ValvesNano"
                self.hw.control_valve(v["id"], v["pin"], True, target_device)
                self.db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (v["id"],))
            self.broadcast_callback()
            
            # Keep exit gate open to let any remaining bottles pass
            out_gate = self.db.fetchone("SELECT pin, device, nanoId FROM gates WHERE id = 'outputGate'")
            if out_gate:
                target_device = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
                if not target_device or target_device == "NANO":
                    target_device = "GatesNano"
                self.hw.control_gate("outputGate", out_gate["pin"], True, target_device)
                self.db.execute("UPDATE gates SET isOpen = 1 WHERE id = 'outputGate'")
                
            while True:
                state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                if not state_row or state_row["mode"] != "TAHLIYE":
                    break
                await asyncio.sleep(0.5)
                
        except asyncio.CancelledError:
            pass
        finally:
            self.hw.all_valves_off()
            self.db.execute("UPDATE valves SET isOpen = 0")
            # Close exit gate
            if out_gate:
                target_device = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
                if not target_device or target_device == "NANO":
                    target_device = "GatesNano"
                self.hw.control_gate("outputGate", out_gate["pin"], False, target_device)
                self.db.execute("UPDATE gates SET isOpen = 0 WHERE id = 'outputGate'")
            self.is_running = False

    async def auto_production_cycle(self):
        self.log("OTOMATİK: Üretim programı yükleniyor...")
        
        try:
            # 1. Read config & active recipe
            config_row = self.db.fetchone("SELECT * FROM system_config WHERE id = 1")
            if not config_row:
                self.log("HATA: Sistem parametreleri yüklenemedi!")
                self.db.execute("UPDATE system_state SET mode = 'ARIZA' WHERE id = 1")
                return
                
            recipe_id = config_row["recipeId"]
            recipe = self.db.fetchone("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
            if not recipe:
                self.log(f"HATA: Seçili Reçete ({recipe_id}) veritabanında bulunamadı!")
                self.db.execute("UPDATE system_state SET mode = 'ARIZA' WHERE id = 1")
                return
                
            target_count = recipe["targetCount"]
            fill_time_ms = recipe["fillTimeMs"]
            settling_time_ms = recipe["settlingTimeMs"]
            drip_wait_ms = recipe["dripWaitTimeMs"]
            
            self.log(f"Reçete: {recipe['name']} | Şişe Hedefi: {target_count} | Dolum: {fill_time_ms}ms")
            
            # Fetch gate pins
            in_gate = self.db.fetchone("SELECT pin, device, nanoId FROM gates WHERE id = 'inputGate'")
            out_gate = self.db.fetchone("SELECT pin, device, nanoId FROM gates WHERE id = 'outputGate'")
            
            if not in_gate or not out_gate:
                self.log("HATA: Giriş/Çıkış kilit kapıları yapılandırılmamış!")
                self.db.execute("UPDATE system_state SET mode = 'ARIZA' WHERE id = 1")
                return
                
            # Close both gates at startup
            in_target = in_gate["nanoId"] if in_gate["device"] == "NANO" else in_gate["device"]
            if not in_target or in_target == "NANO": in_target = "GatesNano"
            out_target = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
            if not out_target or out_target == "NANO": out_target = "GatesNano"
            
            self.hw.control_gate("inputGate", in_gate["pin"], False, in_target)
            self.hw.control_gate("outputGate", out_gate["pin"], False, out_target)
            self.db.execute("UPDATE gates SET isOpen = 0 WHERE id IN ('inputGate', 'outputGate')")
            
            while True:
                # Check stop request
                state_row = self.db.fetchone("SELECT * FROM system_state WHERE id = 1")
                if not state_row or state_row["mode"] != "OTOMATİK":
                    break
                    
                if state_row["stopAfterCycleRequested"]:
                    self.db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', stopAfterCycleRequested = 0 WHERE id = 1")
                    self.log("Döngü sonu durdurma istendi. Üretim askıya alındı.")
                    break
                    
                cycle_start_time = time.time()
                
                # Reset counts
                self.db.execute("UPDATE system_state SET inputCount = 0, outputCount = 0, autoState = 'GIRIS_BEKLEME' WHERE id = 1")
                self.broadcast_callback()
                
                # ADIM 1: Giriş kapısını aç ve şişelerin girmesini bekle
                self.log("ADIM 1: Giriş kapısı açıldı. Şişeler bekleniyor...")
                in_target = in_gate["nanoId"] if in_gate["device"] == "NANO" else in_gate["device"]
                if not in_target or in_target == "NANO": in_target = "GatesNano"
                self.hw.control_gate("inputGate", in_gate["pin"], True, in_target)
                self.db.execute("UPDATE gates SET isOpen = 1 WHERE id = 'inputGate'")
                self.broadcast_callback()
                
                # Wait until inputCount reaches target
                while True:
                    state_row = self.db.fetchone("SELECT inputCount, mode FROM system_state WHERE id = 1")
                    if not state_row or state_row["mode"] != "OTOMATİK":
                        break
                    if state_row["inputCount"] >= target_count:
                        break
                    await asyncio.sleep(0.05)
                    
                state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                if not state_row or state_row["mode"] != "OTOMATİK":
                    break
                    
                # ADIM 2: Giriş kapısını kapat
                self.log(f"ADIM 2: {target_count} şişe içeri girdi. Giriş kapısı kapatılıyor...")
                in_target = in_gate["nanoId"] if in_gate["device"] == "NANO" else in_gate["device"]
                if not in_target or in_target == "NANO": in_target = "GatesNano"
                self.hw.control_gate("inputGate", in_gate["pin"], False, in_target)
                self.db.execute("UPDATE gates SET isOpen = 0 WHERE id = 'inputGate'")
                self.db.execute("UPDATE system_state SET autoState = 'GIRIS_KILITLI' WHERE id = 1")
                self.broadcast_callback()
                await asyncio.sleep(0.5) # Wait to fully close
                
                # ADIM 3: Sıvı Dengelenme/Yerleşme
                self.db.execute("UPDATE system_state SET autoState = 'DENGELEME' WHERE id = 1")
                self.log(f"ADIM 3: Sıvı dengelenmesi bekleniyor ({settling_time_ms}ms)...")
                await asyncio.sleep(settling_time_ms / 1000.0)
                
                # ADIM 4: Dolum
                self.db.execute("UPDATE system_state SET autoState = 'DOLUM' WHERE id = 1")
                self.log("ADIM 4: Valfler açılıyor, dolum başladı...")
                
                # Retrieve enabled valves and trigger them
                valves = self.db.fetchall("SELECT id, pin, device, nanoId, pulseDuration FROM valves WHERE enabled = 1")
                valve_actions = []
                for v in valves:
                    # Priority for valve duration:
                    # 1. Custom duration in recipe
                    # 2. Valve's own pulseDuration
                    # 3. Recipe's general fillTimeMs
                    duration = fill_time_ms
                    try:
                        recipe_valve_durs = json.loads(recipe.get("valveDurations") or "{}")
                        duration = recipe_valve_durs.get(str(v["id"])) or recipe_valve_durs.get(v["id"]) or v["pulseDuration"] or fill_time_ms
                    except:
                        duration = v["pulseDuration"] or fill_time_ms
                        
                    valve_actions.append({
                        "id": v["id"],
                        "pin": v["pin"],
                        "duration": duration,
                        "device": v["nanoId"] if v["device"] == "NANO" and v["nanoId"] else ("ValvesNano" if v["device"] == "NANO" else v["device"])
                    })
                    
                # Set active valves open in DB for UI
                for v in valves:
                    self.db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (v["id"],))
                self.broadcast_callback()
                
                # Pulse concurrently
                start_t = time.time()
                await self.hw.pulse_valves_concurrent(valve_actions)
                elapsed_ms = int((time.time() - start_t) * 1000)
                
                # Set all closed in DB
                self.db.execute("UPDATE valves SET isOpen = 0")
                self.broadcast_callback()
                self.log(f"Dolum aşaması tamamlandı. Hedef: {fill_time_ms} ms, Gerçekleşen: {elapsed_ms} ms")
                
                # ADIM 5: Damla bekleme
                self.db.execute("UPDATE system_state SET autoState = 'DAMLA_BEKLEME' WHERE id = 1")
                self.log(f"ADIM 5: Damlama süresi bekleniyor ({drip_wait_ms}ms)...")
                await asyncio.sleep(drip_wait_ms / 1000.0)
                
                # ADIM 6: Çıkış kapısını aç ve şişelerin çıkmasını bekle
                self.db.execute("UPDATE system_state SET autoState = 'TAHLIYE' WHERE id = 1")
                self.log("ADIM 6: Çıkış kapısı açıldı. Şişeler tahliye ediliyor...")
                out_target = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
                if not out_target or out_target == "NANO": out_target = "GatesNano"
                self.hw.control_gate("outputGate", out_gate["pin"], True, out_target)
                self.db.execute("UPDATE gates SET isOpen = 1 WHERE id = 'outputGate'")
                self.broadcast_callback()
                
                # Wait until outputCount reaches inputCount
                while True:
                    state_row = self.db.fetchone("SELECT inputCount, outputCount, mode FROM system_state WHERE id = 1")
                    if not state_row or state_row["mode"] != "OTOMATİK":
                        break
                    if state_row["outputCount"] >= state_row["inputCount"]:
                        break
                    await asyncio.sleep(0.05)
                    
                state_row = self.db.fetchone("SELECT mode FROM system_state WHERE id = 1")
                if not state_row or state_row["mode"] != "OTOMATİK":
                    break
                    
                # Close exit gate
                out_target = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
                if not out_target or out_target == "NANO": out_target = "GatesNano"
                self.hw.control_gate("outputGate", out_gate["pin"], False, out_target)
                self.db.execute("UPDATE gates SET isOpen = 0 WHERE id = 'outputGate'")
                self.db.execute("UPDATE system_state SET autoState = 'DOGRULAMA' WHERE id = 1")
                self.broadcast_callback()
                await asyncio.sleep(0.5) # Wait to close
                
                duration_ms = int((time.time() - cycle_start_time) * 1000)
                
                # ADIM 7: Doğrulama ve Döngü Sonu Kaydı
                state_row = self.db.fetchone("SELECT inputCount, outputCount FROM system_state WHERE id = 1")
                success = (state_row["inputCount"] == state_row["outputCount"])
                
                # Log to cycle_history
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.db.execute("INSERT INTO cycle_history (recipeId, timestamp, duration, inputCount, outputCount, status) VALUES (?, ?, ?, ?, ?, ?)",
                               (recipe_id, timestamp, duration_ms, state_row["inputCount"], state_row["outputCount"], "SUCCESS" if success else "COUNT_MISMATCH"))
                
                if success:
                    self.log(f"Döngü başarıyla tamamlandı ({duration_ms} ms).")
                    await asyncio.sleep(0.5)
                else:
                    self.db.execute("UPDATE system_state SET activePrompt = 'COUNT_MISMATCH' WHERE id = 1")
                    self.log(f"UYARI: Giren ({state_row['inputCount']}) ve çıkan ({state_row['outputCount']}) şişe sayıları eşit değil! Kullanıcı onayı bekleniyor...")
                    self.broadcast_callback()
                    
                    # Pause loop while prompt is active
                    while True:
                        state_row = self.db.fetchone("SELECT activePrompt, mode FROM system_state WHERE id = 1")
                        if not state_row or state_row["mode"] != "OTOMATİK":
                            break
                        if state_row["activePrompt"] is None:
                            break
                        await asyncio.sleep(0.1)
                        
            # End of program
            self.db.execute("UPDATE system_state SET mode = 'BEKLEMEDE', autoState = 'BEKLEMEDE' WHERE id = 1")
            self.log("OTOMATİK: Üretim durduruldu, sistem beklemede.")
        except asyncio.CancelledError:
            pass
        finally:
            self.hw.all_valves_off()
            self.db.execute("UPDATE valves SET isOpen = 0")
            if in_gate and out_gate:
                in_target = in_gate["nanoId"] if in_gate["device"] == "NANO" else in_gate["device"]
                if not in_target or in_target == "NANO": in_target = "GatesNano"
                out_target = out_gate["nanoId"] if out_gate["device"] == "NANO" else out_gate["device"]
                if not out_target or out_target == "NANO": out_target = "GatesNano"
                self.hw.control_gate("inputGate", in_gate["pin"], False, in_target)
                self.hw.control_gate("outputGate", out_gate["pin"], False, out_target)
                self.db.execute("UPDATE gates SET isOpen = 0 WHERE id IN ('inputGate', 'outputGate')")
            self.is_running = False
            self.broadcast_callback()

    async def trigger_operator_fill(self, method='SEQUENTIAL'):
        """Triggers semi-automatic sequential or concurrent filling in operator mode."""
        self.log(f"DOLUM: Operatör dolum sırası başlatıldı (Yöntem: {method}).")
        try:
            # Get active recipe parameters
            config_row = self.db.fetchone("SELECT * FROM system_config WHERE id = 1")
            recipe_id = config_row["recipeId"] if config_row else ""
            recipe = self.db.fetchone("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
            if not recipe:
                self.log("HATA: Aktif reçete bulunamadı!")
                return
                
            fill_time_ms = recipe["fillTimeMs"]
            
            # Fetch enabled valves
            valves = self.db.fetchall("SELECT id, pin, device, nanoId, pulseDuration FROM valves WHERE enabled = 1")
            if not valves:
                self.log("UYARI: Dolum için aktif vana bulunamadı.")
                return
                
            valve_actions = []
            for v in valves:
                duration = fill_time_ms
                try:
                    recipe_valve_durs = json.loads(recipe.get("valveDurations") or "{}")
                    duration = recipe_valve_durs.get(str(v["id"])) or recipe_valve_durs.get(v["id"]) or v["pulseDuration"] or fill_time_ms
                except:
                    duration = v["pulseDuration"] or fill_time_ms
                    
                valve_actions.append({
                    "id": v["id"],
                    "pin": v["pin"],
                    "duration": duration,
                    "device": v["nanoId"] if v["device"] == "NANO" and v["nanoId"] else ("ValvesNano" if v["device"] == "NANO" else v["device"])
                })
                
            if method == 'SEQUENTIAL':
                # Sequential (tek tek) fill
                for action in valve_actions:
                    self.log(f"DOLUM: Vana {action['id']} ({action['pin']}) açılıyor ({action['duration']} ms)...")
                    self.db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (action["id"],))
                    self.broadcast_callback()
                    
                    # Pulse this single valve
                    start_t = time.time()
                    await self.hw.pulse_valve(action["id"], action["pin"], action["duration"], action["device"])
                    elapsed = int((time.time() - start_t) * 1000)
                    
                    self.db.execute("UPDATE valves SET isOpen = 0 WHERE id = ?", (action["id"],))
                    self.broadcast_callback()
                    self.log(f"DOLUM: Vana {action['id']} dolum tamamlandı. Hedef: {action['duration']} ms, Gerçekleşen: {elapsed} ms")
            else:
                # Concurrent (eşzamanlı) fill
                for v in valves:
                    self.db.execute("UPDATE valves SET isOpen = 1 WHERE id = ?", (v["id"],))
                self.broadcast_callback()
                
                start_t = time.time()
                await self.hw.pulse_valves_concurrent(valve_actions)
                elapsed = int((time.time() - start_t) * 1000)
                
                self.db.execute("UPDATE valves SET isOpen = 0")
                self.broadcast_callback()
                self.log(f"DOLUM: Eşzamanlı dolum tamamlandı. Hedef: {fill_time_ms} ms, Gerçekleşen: {elapsed} ms")
                
            self.log("DOLUM: Operatör dolum sırası tamamlandı.")
        except Exception as e:
            self.log(f"DOLUM HATA: {e}")
            self.hw.all_valves_off()
            self.db.execute("UPDATE valves SET isOpen = 0")
            self.broadcast_callback()
