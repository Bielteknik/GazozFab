import os
import time
import serial
import serial.tools.list_ports
import asyncio
import threading

class HardwareManager:
    def __init__(self):
        self.serial_conns = {}    # {port: SerialInstance}
        self.port_to_id_map = {}   # {port: 'GatesNano' or 'ValvesNano'}
        self.network_conns = {}    # {nano_id: (reader, writer)}
        self.on_sensor_event = None # callback(device_id, sensor_type) e.g. callback("GatesNano", "IN")
        self.on_distance_read = None # callback(distance_cm)
        self.on_nano_discovered = None # callback(nano_id, name, port, baudrate)
        self.on_nano_disconnected = None # callback(nano_id)
        self.on_terminal_output = None # callback(device_id, data)
        self.sensor_config = []
        self.configured_nanos = []
        self.polling_active = False
        self.lgpio_h = None
        self.pi_poll_thread = None

    def get_available_ports(self):
        """List serial ports matching ttyUSB, ttyACM, ttyAMA, ttyS (common on Mac/Linux) or COM (Windows)."""
        ports = [p.device for p in serial.tools.list_ports.comports()]
        
        # Scan /dev directly on Linux/Mac to catch hardware UARTs (like /dev/ttyAMA0)
        if os.path.exists("/dev"):
            try:
                for dev in os.listdir("/dev"):
                    if dev.startswith("ttyAMA") or dev.startswith("ttyS") or dev.startswith("ttyUSB") or dev.startswith("ttyACM") or dev.startswith("tty.usb"):
                        full_path = os.path.join("/dev", dev)
                        if full_path not in ports:
                            ports.append(full_path)
            except Exception:
                pass
                
        filtered = [p for p in ports if any(x in p for x in ["ttyUSB", "ttyACM", "tty.usb", "ttyAMA", "ttyS", "COM"])]
        return sorted(filtered)

    def resolve_port_path(self, port_name):
        if not port_name:
            return port_name
        
        normalized = port_name.lower().strip()
        
        # Mapping generic serial/uart names to Raspberry Pi UART devices
        if normalized in ["serial0", "serial 0", "uart0", "uart 0", "serial_0"]:
            for candidate in ["/dev/serial0", "/dev/ttyAMA0", "/dev/ttyS0"]:
                if os.path.exists(candidate):
                    return candidate
            return "/dev/ttyAMA0"
            
        if normalized in ["serial1", "serial 1", "uart1", "uart 1", "serial_1"]:
            for candidate in ["/dev/serial1", "/dev/ttyAMA1", "/dev/ttyS1"]:
                if os.path.exists(candidate):
                    return candidate
            return "/dev/ttyAMA1"
            
        # Resolve ttyUSB0 / ttyACM0 fallback dynamically if the specified one doesn't exist
        if "ttyusb" in normalized or "ttyacm" in normalized:
            if not os.path.exists(port_name):
                for candidate in ["/dev/ttyUSB0", "/dev/ttyACM0", "/dev/ttyUSB1", "/dev/ttyACM1"]:
                    if os.path.exists(candidate):
                        return candidate

        # Add support for simple "ttyAMA0" or "ttyUSB0" input by prepending "/dev/"
        if (normalized.startswith("tty") or normalized.startswith("serial")) and not port_name.startswith("/"):
            full_path = f"/dev/{port_name}"
            if os.path.exists(full_path):
                return full_path
                
        return port_name

    def process_incoming_line(self, device_id, line):
        clean_line = line.strip()
        # 1. Check Sensor Events
        # Format: EVENT:PIN:D2:ACTIVE or EVENT:PIN:D12:ACTIVE
        if "EVENT:PIN:" in clean_line:
            parts = clean_line.split(":")
            if len(parts) >= 4 and parts[3].strip() == "ACTIVE":
                pin_str = parts[2].strip() # e.g. "D12"
                norm_pin = pin_str.replace("D", "").strip()
                
                matched_sensor = None
                if self.sensor_config:
                    for s in self.sensor_config:
                        s_pin = str(s.get("pin", "")).replace("D", "").strip()
                        if s_pin == norm_pin:
                            matched_sensor = s
                            break
                
                if matched_sensor:
                    s_type = matched_sensor.get("type") # 'INPUT' or 'OUTPUT'
                    if s_type == "INPUT":
                        if self.on_sensor_event:
                            self.on_sensor_event(device_id, "IN")
                    elif s_type == "OUTPUT":
                        if self.on_sensor_event:
                            self.on_sensor_event(device_id, "OUT")
                else:
                    # Fallback to legacy hardcoded mapping if s_pin doesn't match dynamic config
                    if norm_pin == "2" or norm_pin == "12":
                        if self.on_sensor_event:
                            self.on_sensor_event(device_id, "IN")
                    elif norm_pin == "3" or norm_pin == "13":
                        if self.on_sensor_event:
                            self.on_sensor_event(device_id, "OUT")
                    
        # 2. Check Ultrasonic Distance replies
        # Format: EVENT:HCSR04:240 (mm) or EVENT:HCSR04:D7:D8:240
        elif "EVENT:HCSR04:" in clean_line:
            parts = clean_line.split(":")
            try:
                dist_mm = int(parts[-1])
                dist_cm = dist_mm / 10.0
                if self.on_distance_read:
                    self.on_distance_read(dist_cm)
            except Exception:
                pass

    async def start_udp_discovery_server(self, host="0.0.0.0", port=1978):
        loop = asyncio.get_running_loop()
        
        class DiscoveryProtocol(asyncio.DatagramProtocol):
            def connection_made(self, transport):
                self.transport = transport
                print(f"[Hardware UDP] Discovery server listening on UDP {port}")
                
            def datagram_received(self, data, addr):
                msg = data.decode('utf-8', errors='ignore').strip()
                if msg == "GAZOZFAB:DISCOVER":
                    try:
                        self.transport.sendto(b"GAZOZFAB:IP", addr)
                        print(f"[Hardware UDP] Discovery request from {addr} responded.")
                    except Exception as e:
                        print(f"[Hardware UDP Error] Failed to send reply to {addr}: {e}")
                        
        try:
            transport, protocol = await loop.create_datagram_endpoint(
                lambda: DiscoveryProtocol(),
                local_addr=(host, port)
            )
            self.udp_transport = transport
        except Exception as e:
            print(f"[Hardware UDP Error] Failed to start discovery server: {e}")

    async def start_tcp_server(self, host="0.0.0.0", port=1978):
        server = await asyncio.start_server(self.handle_tcp_client, host, port)
        addr = server.sockets[0].getsockname()
        print(f"[Hardware TCP] Server listening on {addr}")
        async with server:
            await server.serve_forever()

    async def handle_tcp_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        print(f"[Hardware TCP] Client connected from {addr}")
        
        try:
            # Read first line as handshake
            line_bytes = await reader.readline()
            if not line_bytes:
                writer.close()
                return
            line = line_bytes.decode('utf-8', errors='ignore').strip()
            print(f"[Hardware TCP] Received handshake from {addr}: '{line}'")
            
            clean_line = line.strip()
            matched_id = None
            matched_name = None
            
            # Format: ID:xxx;NAME:xxx
            if "ID:" in clean_line and "NAME:" in clean_line:
                try:
                    delimiters = [';', ',', '|']
                    parts = [clean_line]
                    for d in delimiters:
                        if d in clean_line:
                            parts = clean_line.split(d)
                            break
                    for p_part in parts:
                        p_clean = p_part.strip()
                        if p_clean.startswith("ID:"):
                            matched_id = p_clean[3:].strip()
                        elif p_clean.startswith("NAME:"):
                            matched_name = p_clean[5:].strip()
                except Exception:
                    pass
            
            if not matched_id:
                if clean_line.startswith("ID:"):
                    matched_id = clean_line[3:].strip()
                else:
                    matched_id = clean_line
            
            if not matched_name:
                legacy_map = {
                    "Sensors": "GatesNano",
                    "Valfler": "ValvesNano",
                    "GatesNano": "GatesNano",
                    "ValvesNano": "ValvesNano"
                }
                matched_name = legacy_map.get(matched_id, matched_id)

            allowed_ids = [n.get("id") for n in getattr(self, "configured_nanos", [])]
            
            final_id = None
            if matched_id in allowed_ids:
                final_id = matched_id
            else:
                for aid in allowed_ids:
                    if aid.lower() == matched_id.lower():
                        final_id = aid
                        break
                        
            if not final_id:
                final_id = matched_id
                
            if final_id and matched_name:
                # Save client socket connection
                self.network_conns[final_id] = (reader, writer)
                print(f"[Hardware TCP] Nano '{final_id}' ({matched_name}) registered on socket {addr}")
                
                # Trigger discovery callback
                if getattr(self, "on_nano_discovered", None):
                    self.on_nano_discovered(final_id, matched_name, f"TCP:{addr[0]}:{addr[1]}", 115200)
                    
                # Read loop
                while True:
                    data_bytes = await reader.readline()
                    if not data_bytes:
                        break
                    data_line = data_bytes.decode('utf-8', errors='ignore').strip()
                    if data_line:
                        # Process sensor/ultrasonic event
                        self.process_incoming_line(final_id, data_line)
                        if getattr(self, "on_terminal_output", None):
                            self.on_terminal_output(final_id, f"RX: {data_line}")
                        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Hardware TCP Error] Client {addr} disconnected with error: {e}")
        finally:
            print(f"[Hardware TCP] Client {addr} disconnected.")
            # Clean up connection
            for nid, conns in list(self.network_conns.items()):
                if conns[1] == writer:
                    del self.network_conns[nid]
                    if getattr(self, "on_nano_disconnected", None):
                        self.on_nano_disconnected(nid)
                    break
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    def connect_to_port(self, port, baudrate=115200, verbose=True):
        """Attempts to open port, reads startup broadcast, or sends WHOAMI to confirm identity."""
        if not port:
            return False
        if str(port).startswith("TCP:"):
            return False
        resolved_port = self.resolve_port_path(port)
        try:
            if resolved_port in self.serial_conns:
                conn = self.serial_conns[resolved_port]
                if conn.is_open:
                    if conn.baudrate == baudrate:
                        return True
                    else:
                        if verbose:
                            print(f"[Hardware] Baudrate changed for {resolved_port} (old: {conn.baudrate}, new: {baudrate}). Reconnecting...")
                        self._close_port(resolved_port)
            
            if verbose:
                print(f"[Hardware] Connecting to serial port: {resolved_port} (configured as: {port}) ({baudrate} baud)...")
            
            conn = serial.Serial(resolved_port, baudrate, timeout=1.0)
            
            # If the port corresponds to a configured Nano, bypass handshake and statically register it
            configured_id = None
            configured_name = None
            for n in getattr(self, "configured_nanos", []):
                cfg_port = n.get("port")
                if cfg_port and (self.resolve_port_path(cfg_port) == resolved_port or cfg_port == port):
                    configured_id = n.get("id")
                    configured_name = n.get("name") or configured_id
                    break

            if configured_id:
                self.serial_conns[resolved_port] = conn
                self.port_to_id_map[resolved_port] = configured_id
                print(f"[Hardware] Statically mapped port {resolved_port} to Nano ID '{configured_id}' (Bypassed handshake)")
                if getattr(self, "on_nano_discovered", None):
                    self.on_nano_discovered(configured_id, configured_name, resolved_port, baudrate)
                return True

            time.sleep(2.0) # Wait for Arduino to boot and broadcast its identity
            
            # Read any startup broadcast from the buffer first
            startup_data = ""
            if conn.in_waiting > 0:
                startup_data = conn.read(conn.in_waiting).decode('utf-8', errors='ignore')
                
            startup_lines = [l.strip() for l in startup_data.split('\n') if l.strip()]
            
            matched_id = None
            matched_name = None
            
            # Try to parse the boot broadcast lines first
            for clean_line in startup_lines:
                if verbose:
                    print(f"[Hardware] Boot broadcast line from {resolved_port}: '{clean_line}'")
                
                # Format: ID:xxx;NAME:xxx
                if "ID:" in clean_line and "NAME:" in clean_line:
                    try:
                        delimiters = [';', ',', '|']
                        parts = [clean_line]
                        for d in delimiters:
                            if d in clean_line:
                                parts = clean_line.split(d)
                                break
                        for p_part in parts:
                            p_clean = p_part.strip()
                            if p_clean.startswith("ID:"):
                                matched_id = p_clean[3:].strip()
                            elif p_clean.startswith("NAME:"):
                                matched_name = p_clean[5:].strip()
                    except Exception:
                        pass
                
                if not matched_id:
                    if clean_line.startswith("ID:"):
                        matched_id = clean_line[3:].strip()
                    elif clean_line in ["Sensors", "Valfler", "GatesNano", "ValvesNano"]:
                        matched_id = clean_line
                
                if matched_id:
                    break
            
            # If identity was found in startup broadcast
            if matched_id:
                if not matched_name:
                    legacy_map = {
                        "Sensors": "GatesNano",
                        "Valfler": "ValvesNano",
                        "GatesNano": "GatesNano",
                        "ValvesNano": "ValvesNano"
                    }
                    matched_name = legacy_map.get(matched_id, matched_id)
                
                allowed_ids = [n.get("id") for n in getattr(self, "configured_nanos", [])]
                final_id = matched_id
                for aid in allowed_ids:
                    if aid.lower() == matched_id.lower():
                        final_id = aid
                        break
                
                if not final_id:
                    final_id = matched_id
                
                self.serial_conns[resolved_port] = conn
                self.port_to_id_map[resolved_port] = final_id
                print(f"[Hardware] Verified by boot broadcast: {resolved_port} successfully mapped to Nano ID '{final_id}' (Name: '{matched_name}')")
                
                if getattr(self, "on_nano_discovered", None):
                    self.on_nano_discovered(final_id, matched_name, resolved_port, baudrate)
                return True
            
            # No startup broadcast found, clear buffer and send WHOAMI query
            conn.reset_input_buffer()
            conn.reset_output_buffer()
            
            # Send WHOAMI handshake command
            for attempt in range(3):
                if verbose:
                    print(f"[Hardware] Sending WHOAMI handshake to {resolved_port} (Attempt {attempt+1})...")
                conn.write(b"WHOAMI\n")
                
                # Check response
                for _ in range(10):
                    line = conn.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        if verbose:
                            print(f"[Hardware] Handshake response from {resolved_port}: '{line}'")
                        
                        clean_line = line.strip()
                        matched_id = None
                        matched_name = None
                        
                        # Parse ID:xxx;NAME:xxx
                        if "ID:" in clean_line and "NAME:" in clean_line:
                            try:
                                delimiters = [';', ',', '|']
                                parts = [clean_line]
                                for d in delimiters:
                                    if d in clean_line:
                                        parts = clean_line.split(d)
                                        break
                                for p_part in parts:
                                    p_clean = p_part.strip()
                                    if p_clean.startswith("ID:"):
                                        matched_id = p_clean[3:].strip()
                                    elif p_clean.startswith("NAME:"):
                                        matched_name = p_clean[5:].strip()
                            except Exception:
                                pass
                        
                        if not matched_id:
                            if clean_line.startswith("ID:"):
                                matched_id = clean_line[3:].strip()
                            else:
                                matched_id = clean_line
                        
                        if not matched_name:
                            legacy_map = {
                                "Sensors": "GatesNano",
                                "Valfler": "ValvesNano",
                                "GatesNano": "GatesNano",
                                "ValvesNano": "ValvesNano"
                            }
                            matched_name = legacy_map.get(matched_id, matched_id)

                        allowed_ids = [n.get("id") for n in getattr(self, "configured_nanos", [])]
                        
                        final_id = None
                        if matched_id in allowed_ids:
                            final_id = matched_id
                        else:
                            for aid in allowed_ids:
                                if aid.lower() == matched_id.lower():
                                    final_id = aid
                                    break
                                    
                        if not final_id:
                            final_id = matched_id
                            
                        if final_id and matched_name:
                            self.serial_conns[resolved_port] = conn
                            self.port_to_id_map[resolved_port] = final_id
                            print(f"[Hardware] Verified by WHOAMI: {resolved_port} successfully mapped to Nano ID '{final_id}' (Name: '{matched_name}')")
                            
                            if getattr(self, "on_nano_discovered", None):
                                self.on_nano_discovered(final_id, matched_name, resolved_port, baudrate)
                            return True
                            
                time.sleep(0.5)
            
            if verbose:
                print(f"[Hardware] Handshake failed on {resolved_port}. No valid ID.")
            conn.close()
            return False
        except Exception as e:
            if verbose:
                print(f"[Hardware] Error connecting to {resolved_port}: {e}")
            return False

    def find_and_connect(self, target_id):
        """Scan all ports and connect to target Nano if found."""
        available = self.get_available_ports()
        for port in available:
            resolved_port = self.resolve_port_path(port)
            if resolved_port in self.serial_conns:
                if self.port_to_id_map.get(resolved_port) == target_id:
                    return True
                continue
                
            if self.connect_to_port(port):
                if self.port_to_id_map.get(resolved_port) == target_id:
                    return True
                else:
                    # Wrong device, close and remove it
                    self.serial_conns[resolved_port].close()
                    del self.serial_conns[resolved_port]
                    if resolved_port in self.port_to_id_map:
                        del self.port_to_id_map[resolved_port]
        return False

    def is_port_online(self, port):
        if not port:
            return False
        # Check if port matches a connected TCP Nano ID
        if port in self.network_conns:
            return True
        # Or check if port starts with "TCP:" and matches a socket connection's address
        if str(port).startswith("TCP:"):
            for nid, (reader, writer) in list(self.network_conns.items()):
                addr = writer.get_extra_info('peername')
                if addr:
                    conn_port_str = f"TCP:{addr[0]}:{addr[1]}"
                    if conn_port_str == port:
                        return True
            return False
            
        resolved_port = self.resolve_port_path(port)
        conn = self.serial_conns.get(resolved_port)
        return conn is not None and conn.is_open

    def send_command(self, cmd, target_port=None):
        """Write command string to port (or broadcast to all if target_port is None)."""
        full_cmd = f"{cmd}\n" if not cmd.endswith('\n') else cmd
        encoded = full_cmd.encode('utf-8')
        
        # Log TX message to terminal
        if getattr(self, "on_terminal_output", None):
            device_id = target_port
            if target_port:
                resolved_p = self.resolve_port_path(target_port)
                if resolved_p in self.port_to_id_map:
                    device_id = self.port_to_id_map[resolved_p]
            else:
                device_id = "ALL"
            self.on_terminal_output(device_id, f"TX: {cmd.strip()}")
        
        if target_port:
            # 1. Check if target_port is a connected TCP Nano ID
            if target_port in self.network_conns:
                reader, writer = self.network_conns[target_port]
                try:
                    writer.write(encoded)
                except Exception as e:
                    print(f"[Hardware] TCP write error on {target_port}: {e}")
                return
                
            # 2. Check if target_port starts with "TCP:" and match by connection address
            if str(target_port).startswith("TCP:"):
                for nid, (reader, writer) in list(self.network_conns.items()):
                    addr = writer.get_extra_info('peername')
                    if addr:
                        conn_port_str = f"TCP:{addr[0]}:{addr[1]}"
                        if conn_port_str == target_port:
                            try:
                                writer.write(encoded)
                            except Exception as e:
                                print(f"[Hardware] TCP write error on {target_port}: {e}")
                                try:
                                    writer.close()
                                except: pass
                            return
                return
            
            # Fallback to serial
            resolved_port = self.resolve_port_path(target_port)
            conn = self.serial_conns.get(resolved_port)
            if conn and conn.is_open:
                try:
                    conn.write(encoded)
                except Exception as e:
                    print(f"[Hardware] Serial write error on {resolved_port}: {e}")
                    self._close_port(resolved_port)
        else:
            # Broadcast to all TCP clients
            for nid, (reader, writer) in list(self.network_conns.items()):
                try:
                    writer.write(encoded)
                except Exception as e:
                    print(f"[Hardware] TCP broadcast write error on {nid}: {e}")
            
            # Broadcast to all Serial clients
            for port, conn in list(self.serial_conns.items()):
                if conn.is_open:
                    try:
                        conn.write(encoded)
                    except Exception as e:
                        print(f"[Hardware] Serial write error on {port}: {e}")
                        self._close_port(port)

    def _close_port(self, port):
        resolved_port = self.resolve_port_path(port)
        try:
            if resolved_port in self.serial_conns:
                self.serial_conns[resolved_port].close()
                del self.serial_conns[resolved_port]
            if resolved_port in self.port_to_id_map:
                del self.port_to_id_map[resolved_port]
        except:
            pass

    def apply_config(self, nanos, sensors):
        self.sensor_config = sensors
        self.configured_nanos = nanos
        
        # Close disconnected ports
        active_ports = [self.resolve_port_path(n.get("port")) for n in nanos if n.get("port")]
        for port in list(self.serial_conns.keys()):
            if port not in active_ports:
                print(f"[Hardware] Closing unused port: {port}")
                self._close_port(port)
                
        # Connect to newly configured Nanos
        for n in nanos:
            port = n.get("port")
            baud = n.get("baudRate", 115200)
            if port:
                self.connect_to_port(port, baud)
                
        # Setup local Raspberry Pi GPIO if needed
        self.setup_pi_gpio(sensors)

    def control_valve(self, valve_id, pin, state, device="NANO"):
        """Toggles valve on ValvesNano or Raspberry Pi GPIO."""
        if device == "RASPI":
            # Direct Pi 5 GPIO output control
            try:
                import lgpio
                if not self.lgpio_h:
                    self.lgpio_h = lgpio.gpiochip_open(0)
                gpio_pin = int(pin)
                lgpio.gpio_claim_output(self.lgpio_h, gpio_pin)
                lgpio.gpio_write(self.lgpio_h, gpio_pin, 1 if state else 0)
                print(f"[GPIO Output] Pin {gpio_pin} -> {'HIGH' if state else 'LOW'}")
                return True
            except Exception as e:
                print(f"[GPIO Output Error] Could not write to Pi Pin {pin}: {e}")
                return False
        else:
            # ValvesNano command
            # 1. Check if connected via TCP first
            if "ValvesNano" in self.network_conns:
                full_cmd = f"VALVE:{'ON' if state else 'OFF'}:D{pin}"
                print(f"[Hardware Command TCP] {full_cmd} -> ValvesNano")
                self.send_command(full_cmd, target_port="ValvesNano")
                return True

            port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
            if not port:
                # Retry discovery
                self.find_and_connect("ValvesNano")
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
                
            if port:
                # Format: VALVE:ON:D2 or VALVE:OFF:D2
                full_cmd = f"VALVE:{'ON' if state else 'OFF'}:D{pin}"
                print(f"[Hardware Command] {full_cmd} -> {port}")
                self.send_command(full_cmd, target_port=port)
                return True
            else:
                print("[Hardware Error] ValvesNano not connected!")
                return False

    async def pulse_valve(self, valve_id, pin, duration_ms, device="NANO"):
        """Pulse a single valve synchronously."""
        try:
            duration = float(duration_ms)
            self.control_valve(valve_id, pin, True, device)
            await asyncio.sleep(duration / 1000.0)
        except Exception as e:
            print(f"[Hardware Pulse Error] {e}")
        finally:
            self.control_valve(valve_id, pin, False, device)

    async def pulse_valves_concurrent(self, valve_actions):
        """
        valve_actions: list of dicts {"id": valve_id, "pin": pin, "duration": duration_ms, "device": "NANO"|"RASPI"}
        """
        if not valve_actions:
            return
        tasks = []
        for v in valve_actions:
            tasks.append(self.pulse_valve(v["id"], v["pin"], v["duration"], v["device"]))
        await asyncio.gather(*tasks)

    def control_gate(self, gate_id, pin, state, device="NANO"):
        """Toggles Gate (Stepper/Solenoid) open/closed."""
        if device == "RASPI":
            try:
                import lgpio
                if not self.lgpio_h:
                    self.lgpio_h = lgpio.gpiochip_open(0)
                gpio_pin = int(pin)
                lgpio.gpio_claim_output(self.lgpio_h, gpio_pin)
                lgpio.gpio_write(self.lgpio_h, gpio_pin, 1 if state else 0)
                print(f"[GPIO Output] Gate Pin {gpio_pin} -> {'HIGH' if state else 'LOW'}")
                return True
            except Exception as e:
                print(f"[GPIO Output Error] Could not write to Gate Pin {pin}: {e}")
                return False
        else:
            # GatesNano command
            # Dynamic lookup from database if self.db exists
            step_pin = pin
            dir_pin = "D6"
            enable_pin = "D7"
            steps = 400
            speed = 2000
            
            if hasattr(self, 'db') and self.db:
                try:
                    row = self.db.fetchone(
                        "SELECT pin, dirPin, enablePin, stepsToOpen, stepsToClose, speed FROM gates WHERE id = ?",
                        (gate_id,)
                    )
                    if row:
                        if row["pin"]: step_pin = row["pin"]
                        if row["dirPin"]: dir_pin = row["dirPin"]
                        if row["enablePin"]: enable_pin = row["enablePin"]
                        steps = row["stepsToOpen"] if state else row["stepsToClose"]
                        if row["speed"]: speed = row["speed"]
                except Exception as e:
                    print(f"[Hardware DB Error] Could not fetch gate config: {e}")
            
            # Format prefixes cleanly (e.g. D5, D6, D8)
            step_str = f"D{str(step_pin).replace('D', '')}"
            dir_str = f"D{str(dir_pin).replace('D', '')}"
            en_str = f"D{str(enable_pin).replace('D', '')}"
            steps_val = steps if steps else 400
            speed_val = speed if speed else 2000
            
            # Format: GATE:<OPEN|CLOSE>:<STEP_PIN>:<DIR_PIN>:<EN_PIN>:<STEPS>:<SPEED>
            full_cmd = f"GATE:{'OPEN' if state else 'CLOSE'}:{step_str}:{dir_str}:{en_str}:{steps_val}:{speed_val}"
            
            target_port = device
            if not target_port or target_port == 'NANO':
                target_port = 'GatesNano'
                
            # 1. Check if connected via TCP first
            if target_port in self.network_conns:
                print(f"[Hardware Command TCP] {full_cmd} -> {target_port}")
                self.send_command(full_cmd, target_port=target_port)
                return True

            port = next((p for p, d_id in self.port_to_id_map.items() if d_id == target_port), None)
            if not port:
                self.find_and_connect(target_port)
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == target_port), None)
                
            if port:
                print(f"[Hardware Command] {full_cmd} -> {port}")
                self.send_command(full_cmd, target_port=port)
                return True
            else:
                print(f"[Hardware Error] {target_port} not connected!")
                return False

    def request_ultrasonic_distance(self, trig_pin, echo_pin, device="NANO"):
        """Asks GatesNano to read HC-SR04 or reads it from Pi 5 directly."""
        if device == "RASPI":
            # Direct Pi 5 ultrasonic reading
            try:
                import lgpio
                if not self.lgpio_h:
                    self.lgpio_h = lgpio.gpiochip_open(0)
                t_pin = int(trig_pin)
                e_pin = int(echo_pin)
                
                lgpio.gpio_claim_output(self.lgpio_h, t_pin)
                lgpio.gpio_claim_input(self.lgpio_h, e_pin)
                
                # Pulse Trig
                lgpio.gpio_write(self.lgpio_h, t_pin, 0)
                time.sleep(0.000002)
                lgpio.gpio_write(self.lgpio_h, t_pin, 1)
                time.sleep(0.00001)
                lgpio.gpio_write(self.lgpio_h, t_pin, 0)
                
                # Measure pulse duration on Echo
                start = time.time()
                timeout = start + 0.03
                
                while lgpio.gpio_read(self.lgpio_h, e_pin) == 0:
                    start_time = time.time()
                    if start_time > timeout:
                        return
                        
                end_time = time.time()
                while lgpio.gpio_read(self.lgpio_h, e_pin) == 1:
                    end_time = time.time()
                    if end_time > timeout:
                        break
                        
                duration = end_time - start_time
                distance_cm = (duration * 34300) / 2
                
                if self.on_distance_read:
                    self.on_distance_read(distance_cm)
            except Exception as e:
                pass
        else:
            # Query the configured Nano device (e.g., GatesNano, ValvesNano, etc.)
            target_id = device if device and device != "NANO" else "GatesNano"
            # 1. Check if connected via TCP first
            if target_id in self.network_conns:
                full_cmd = f"READ:HCSR04:D{trig_pin}:D{echo_pin}"
                self.send_command(full_cmd, target_port=target_id)
                return

            port = next((p for p, d_id in self.port_to_id_map.items() if d_id == target_id), None)
            if not port:
                self.find_and_connect(target_id)
                port = next((p for p, d_id in self.port_to_id_map.items() if d_id == target_id), None)
                
            if port:
                # Format: READ:HCSR04:D7:D8
                full_cmd = f"READ:HCSR04:D{trig_pin}:D{echo_pin}"
                self.send_command(full_cmd, target_port=port)

    def all_valves_off(self):
        # 1. Check if connected via TCP first
        if "ValvesNano" in self.network_conns:
            self.send_command("VALVE:ALL_OFF", target_port="ValvesNano")

        port = next((p for p, d_id in self.port_to_id_map.items() if d_id == "ValvesNano"), None)
        if port:
            self.send_command("VALVE:ALL_OFF", target_port=port)
            
        # Also clean Pi GPIO valves if any
        try:
            import lgpio
            if self.lgpio_h:
                for s in self.sensor_config:
                    # we don't have valve pin list in memory unless we store it, 
                    # but simple cleanup handles it
                    pass
        except:
            pass

    def setup_pi_gpio(self, sensors):
        """Start thread to monitor active laser sensors connected directly to Pi 5."""
        if self.polling_active:
            self.polling_active = False
            if self.pi_poll_thread and self.pi_poll_thread.is_alive():
                self.pi_poll_thread.join(timeout=0.5)
        try:
            import lgpio
            if not self.lgpio_h:
                self.lgpio_h = lgpio.gpiochip_open(0)
                
            # Filter active Pi 5 sensors
            pi_sensors = [s for s in sensors if s.get("device") == "RASPI" and s.get("enabled")]
            if not pi_sensors:
                return
                
            for s in pi_sensors:
                pin = int(s.get("pin", 0))
                if pin > 0:
                    lgpio.gpio_claim_input(self.lgpio_h, pin, lgpio.SET_PULL_UP)
            
            self.polling_active = True
            
            def poll_loop():
                last_trigger = {} # pin: time
                debounce_delay = 0.2
                
                while self.polling_active:
                    now = time.time()
                    for s in pi_sensors:
                        pin = int(s.get("pin", 0))
                        if pin <= 0: continue
                        
                        try:
                            # NPN NC sensor pulls to LOW when object is in front
                            val = lgpio.gpio_read(self.lgpio_h, pin)
                            if val == 0:
                                last_time = last_trigger.get(pin, 0)
                                if (now - last_time) > debounce_delay:
                                    last_trigger[pin] = now
                                    stype = s.get("type", "INPUT") # "INPUT" or "OUTPUT"
                                    if self.on_sensor_event:
                                        self.on_sensor_event("RASPI", "IN" if stype == "INPUT" else "OUT")
                        except Exception as ex:
                            break
                    time.sleep(0.01)
                    
            self.pi_poll_thread = threading.Thread(target=poll_loop, daemon=True)
            self.pi_poll_thread.start()
            print("[GPIO] Monitoring active sensors on local Pi 5 GPIO pins.")
        except Exception as e:
            # Not on Pi or lgpio unavailable, fallback safely
            pass

    def update_serial_read(self):
        """Read serial buffers non-blocking, parse sensor events and distance replies."""
        for port, conn in list(self.serial_conns.items()):
            try:
                if not conn.is_open: continue
                while conn.in_waiting > 0:
                    line_bytes = conn.readline()
                    if not line_bytes: break
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    if not line: continue
                    
                    device_id = self.port_to_id_map.get(port)
                    # Print raw outputs to server terminal for diagnosis
                    print(f"[Serial Nano -> {device_id}] {line}")
                    
                    if getattr(self, "on_terminal_output", None):
                        self.on_terminal_output(device_id or "UNKNOWN", f"RX: {line}")
                    
                    # 1. Check Handshake Query reply
                    if line.startswith("ID:"):
                        clean_id = line.replace("ID:", "").strip()
                        if clean_id in ["Sensors", "Valfler"]:
                            mapped = "GatesNano" if clean_id == "Sensors" else "ValvesNano"
                            self.port_to_id_map[port] = mapped
                            print(f"[Hardware] Identified {port} as {mapped}")
                            device_id = mapped
                            
                    # Process via standard incoming line processor
                    if device_id:
                        self.process_incoming_line(device_id, line)
            except Exception as e:
                pass

    def cleanup(self):
        self.polling_active = False
        for port, conn in list(self.serial_conns.items()):
            try:
                conn.close()
            except: pass
        self.serial_conns.clear()
        self.port_to_id_map.clear()
        
        try:
            import lgpio
            if self.lgpio_h:
                lgpio.gpiochip_close(self.lgpio_h)
                self.lgpio_h = None
        except:
            pass
        print("[Hardware] Cleaned up serial and GPIO connections.")
