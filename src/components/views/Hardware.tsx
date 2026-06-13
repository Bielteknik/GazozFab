import React, { useState, useEffect, useRef } from 'react';
import { Server, Trash2, Plus, Terminal, Send, Activity, Settings2, Link, RefreshCw, Edit2, Check, Cylinder } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { SystemData, NanoState, ValveState, SensorState, GateState, SystemConfig } from '../../types/system';
import { cn } from '../../lib/utils';

interface HardwareProps {
  socket?: any;
  data: SystemData;
  onAddHardware: () => void;
  onRemoveHardware: (id: number) => void;
  onToggleHardwareStatus: (id: number) => void;
  onSendNanoCommand: (nanoId: string, cmd: string) => void;
  onUpdateNanoConfig: (id: string, config: Partial<NanoState>) => void;
  onUpdateValve?: (id: number, updates: Partial<ValveState>) => void;
  onUpdateSensor?: (id: string, updates: Partial<SensorState>) => void;
  onUpdateGate?: (id: string, updates: Partial<GateState>) => void;
  onUpdateSystemGate?: (target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => void;
  onToggleSensorEnabled: (id: string) => void;
  onToggleGateEnabled: (target: 'inputGate' | 'outputGate') => void;
  onAddSensor?: () => void;
  onRemoveSensor?: (id: string) => void;
  onAddGate?: () => void;
  onRemoveGate?: (id: string) => void;
  onToggleExtraGateEnabled?: (id: string) => void;
  onAddNano: () => void;
  onRemoveNano: (id: string) => void;
  onUpdateConfig?: (config: Partial<SystemConfig>) => void;
}

export function Hardware({ socket, data, onAddHardware, onRemoveHardware, onToggleHardwareStatus, onSendNanoCommand, onUpdateNanoConfig, onUpdateValve, onUpdateSensor, onUpdateGate, onUpdateSystemGate, onToggleSensorEnabled, onToggleGateEnabled, onAddSensor, onRemoveSensor, onAddGate, onRemoveGate, onToggleExtraGateEnabled, onAddNano, onRemoveNano, onUpdateConfig }: HardwareProps) {
  const [cmdInput, setCmdInput] = useState('');
  const [selectedNano, setSelectedNano] = useState(data.nanos?.[0]?.id || 'ALL');
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [editingValveId, setEditingValveId] = useState<number | null>(null);
  const [tempValveName, setTempValveName] = useState("");

  const activeNanoId = (selectedNano === 'ALL' || data.nanos.some(n => n.id === selectedNano)) ? selectedNano : (data.nanos?.[0]?.id || 'ALL');

  const [rawSensorSignals, setRawSensorSignals] = useState<Record<string, 'ACTIVE' | 'INACTIVE'>>({});

  useEffect(() => {
    if (socket) {
      const handleRawSignal = ({ device, pin, status }: { device: string; pin: string; status: 'ACTIVE' | 'INACTIVE' }) => {
        const cleanedPin = pin.replace('D', '').trim();
        setRawSensorSignals(prev => ({
          ...prev,
          [`${device}:${cleanedPin}`]: status
        }));
      };
      socket.on('SENSOR_RAW_SIGNAL', handleRawSignal);
      return () => {
        socket.off('SENSOR_RAW_SIGNAL', handleRawSignal);
      };
    }
  }, [socket]);

  const [activeTab, setActiveTab] = useState<'VALVES' | 'SENSORS' | 'GATES' | 'NANOS' | 'TERMINAL' | 'KAZAN'>('VALVES');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (activeTab === 'TERMINAL' && terminalRef.current && !xtermRef.current) {
      const xterm = new XTerm({
        theme: {
          background: '#050505',
          foreground: '#9CA3AF',
          cursor: '#3B82F6',
        },
        fontFamily: 'monospace',
        fontSize: 12,
        cursorBlink: true,
      });
      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = xterm;

      xterm.writeln('\x1b[34;1m[SYS]\x1b[0m Haberleşme Terminali Başlatıldı...');
      xterm.writeln('Bağlanılan Nano portlarından gelen veriler burada akacaktır.');
      xterm.writeln('Komut yazıp ENTER\'a basabilirsiniz.\r\n');

      let currentLine = '';
      xterm.onData(d => {
         if (d === '\r') {
           xterm.writeln('');
           if (currentLine.trim()) {
              socket?.emit('TERMINAL_INPUT', { nanoId: activeNanoId, data: currentLine.trim() });
           }
           currentLine = '';
         } else if (d === '\u007f') { // Backspace
           if (currentLine.length > 0) {
             currentLine = currentLine.slice(0, -1);
             xterm.write('\b \b');
           }
         } else {
           currentLine += d;
           xterm.write(d);
         }
      });
      
      const resizeObserver = new ResizeObserver(() => fitAddon.fit());
      resizeObserver.observe(terminalRef.current);

      return () => {
        resizeObserver.disconnect();
        xterm.dispose();
        xtermRef.current = null;
      };
    }
  }, [activeTab, activeNanoId, socket]);

  useEffect(() => {
    if (socket) {
      const handler = ({ nanoId, data: termData }: { nanoId: string, data: string }) => {
         if (activeTab === 'TERMINAL' && xtermRef.current) {
            if (activeNanoId === 'ALL' || activeNanoId === nanoId) {
               xtermRef.current.writeln(`\x1b[32m[${nanoId}]\x1b[0m ${termData}`);
            }
         }
      };
      socket.on('TERMINAL_OUTPUT', handler);
      return () => { socket.off('TERMINAL_OUTPUT', handler); };
    }
  }, [socket, activeTab, activeNanoId]);

  useEffect(() => {
    if (socket) {
      socket.on('AVAILABLE_PORTS', (ports: string[]) => {
        setAvailablePorts(ports);
        setIsScanning(false);
      });
      // İlk açılışta bir kez tara
      socket.emit('SCAN_PORTS');
    }
  }, [socket]);

  const handleScan = () => {
     if (!socket) return;
     setIsScanning(true);
     socket.emit('SCAN_PORTS');
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    onSendNanoCommand(activeNanoId, cmdInput.trim());
    setCmdInput('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1C2029] border border-[#374151] p-3 rounded shrink-0">
        <div>
          <h2 className="text-sm font-bold text-blue-400 flex items-center">
            <Server className="mr-2" size={16} /> DONANIM BİRİMLERİ YÖNETİMİ
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Bağımlı mikrodenetleyicileri (Nano), valf modüllerini ve sensörleri izleyin, değiştirin veya test komutları gönderin.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#2D333F] shrink-0">
        <button 
           onClick={() => setActiveTab('VALVES')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'VALVES' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Valfler
        </button>
        <button 
           onClick={() => setActiveTab('SENSORS')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'SENSORS' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Sayaç Sensörleri
        </button>
        <button 
           onClick={() => setActiveTab('GATES')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'GATES' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Kilitler
        </button>
        <button 
           onClick={() => setActiveTab('KAZAN')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'KAZAN' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Şerbet Kazanı
        </button>
        <button 
           onClick={() => setActiveTab('NANOS')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'NANOS' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Mikrodenetleyiciler (Nanos)
        </button>
        <button 
           onClick={() => setActiveTab('TERMINAL')}
           className={cn("px-4 py-2 text-xs font-bold transition-colors border-b-2", activeTab === 'TERMINAL' ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Haberleşme Terminali
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'KAZAN' && (
        <div className="h-full overflow-y-auto pr-2 pb-10">
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-orange-500 pl-2 flex items-center">
                <Cylinder className="mr-2 text-orange-500" size={14} /> Şerbet Kazanı Tanıtma ve Parametreleri
              </h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-full overflow-y-auto pr-2 pb-4">
              {/* Left Side: Parameters Form */}
              <div className="bg-[#0D1016] border border-[#1F2937] p-4 rounded flex flex-col space-y-4">
                 <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">1. Bağlı Olduğu Donanım (Denetleyici)</label>
                    <select 
                       value={data.config.ultrasonicDevice || 'RASPI'}
                       onChange={(e) => onUpdateConfig?.({ ultrasonicDevice: e.target.value })}
                       disabled={data.mode === 'OTOMATİK'}
                       className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 disabled:opacity-50"
                    >
                       <option value="RASPI">Raspberry Pi 5 (Dahili GPIO)</option>
                       {data.nanos.map(n => (
                          <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
                       ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">2. TRIG PİN</label>
                       <input 
                          type="text"
                          value={data.config.ultrasonicTrigPin || ''}
                          onChange={(e) => onUpdateConfig?.({ ultrasonicTrigPin: e.target.value })}
                          placeholder="Örn: 23, D6"
                          disabled={data.mode === 'OTOMATİK'}
                          className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-orange-400 outline-none focus:border-orange-500/50 disabled:opacity-50"
                       />
                    </div>
                    <div className="flex flex-col space-y-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">3. ECHO PİN</label>
                       <input 
                          type="text"
                          value={data.config.ultrasonicEchoPin || ''}
                          onChange={(e) => onUpdateConfig?.({ ultrasonicEchoPin: e.target.value })}
                          placeholder="Örn: 24, D7"
                          disabled={data.mode === 'OTOMATİK'}
                          className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-orange-400 outline-none focus:border-orange-500/50 disabled:opacity-50"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-3 gap-3">
                     <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">4. Kazan Boyu (cm)</label>
                        <input 
                           type="number"
                           value={data.config.ultrasonicMaxHeightCm || 100}
                           onChange={(e) => onUpdateConfig?.({ ultrasonicMaxHeightCm: Number(e.target.value) })}
                           disabled={data.mode === 'OTOMATİK'}
                           className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono disabled:opacity-50"
                        />
                     </div>
                     <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">5. Kritik Limit (%)</label>
                        <input 
                           type="number"
                           value={data.config.ultrasonicCriticalLowPercent || 15}
                           onChange={(e) => onUpdateConfig?.({ ultrasonicCriticalLowPercent: Number(e.target.value) })}
                           disabled={data.mode === 'OTOMATİK'}
                           className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono disabled:opacity-50"
                        />
                     </div>
                     <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">6. Gecikme (ms)</label>
                        <input 
                           type="number"
                           value={data.config.ultrasonicDebounceMs || 100}
                           onChange={(e) => onUpdateConfig?.({ ultrasonicDebounceMs: Number(e.target.value) })}
                           disabled={data.mode === 'OTOMATİK'}
                           className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono disabled:opacity-50"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">7. Ölçüm Yöntemi</label>
                        <select 
                           value={data.config.ultrasonicMeasurementType || 'CONTINUOUS'}
                           onChange={(e) => onUpdateConfig?.({ ultrasonicMeasurementType: e.target.value as any })}
                           disabled={data.mode === 'OTOMATİK'}
                           className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 disabled:opacity-50"
                        >
                           <option value="CONTINUOUS">Sürekli (Anlık) Ölçüm</option>
                           <option value="CYCLE">Döngü Sonrası (Her Döngü Bitişinde)</option>
                           <option value="CONSUMPTION">Hacim Tüketimine Göre (ml)</option>
                        </select>
                     </div>
                     <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">8. Ölçüm Hacim Eşiği (ml)</label>
                        <input 
                           type="number"
                           value={data.config.ultrasonicMeasurementIntervalMl || 2000}
                           onChange={(e) => onUpdateConfig?.({ ultrasonicMeasurementIntervalMl: Number(e.target.value) })}
                           disabled={data.mode === 'OTOMATİK' || data.config.ultrasonicMeasurementType !== 'CONSUMPTION'}
                           className="w-full bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono disabled:opacity-50 disabled:opacity-30"
                           placeholder="Örn: 2000"
                        />
                     </div>
                  </div>
                  
                  <div className="text-[10px] text-gray-500 leading-relaxed bg-[#1C2029]/30 p-2.5 rounded border border-gray-800/40">
                     <p className="font-bold text-gray-400 mb-1">💡 Kazan Tanıtma Bilgilendirmesi:</p>
                     Şerbet kazanı doluluk takibi için ultrasonik mesafe sensörü kullanılır. Ölçüm yöntemi olarak <strong>Sürekli</strong>, <strong>Döngü Sonrası</strong> veya dolum hacmine bağlı olarak <strong>Tüketim Limitinde Bir</strong> tercih edilebilir. Sıvı yüksekliği <code className="text-orange-400">Yükseklik = Toplam Kazan Boyu - Okunan Mesafe</code> formülüyle hesaplanır.
                  </div>
              </div>
              
              {/* Right Side: Visual representation & Live values */}
              <div className="bg-[#0D1016] border border-[#1F2937] p-4 rounded flex flex-col items-center justify-center min-h-[300px] relative">
                 {(() => {
                    const maxHeight = data.config.ultrasonicMaxHeightCm || 100;
                    const critPercent = data.config.ultrasonicCriticalLowPercent || 15;
                    const levelCm = data.tankLevelCm !== undefined ? data.tankLevelCm : 85;
                    const liquidH = Math.max(0, maxHeight - levelCm);
                    const liquidP = Math.max(0, Math.min(100, Math.round((liquidH / maxHeight) * 100)));
                    const isCritical = liquidP <= critPercent;

                    return (
                       <div className="w-full flex flex-col items-center gap-6">
                          {/* Tank Cylinder Wrapper */}
                          <div className="w-48 h-52 bg-gradient-to-b from-[#1C2029]/80 to-[#0D1016]/90 border-2 border-gray-700/60 rounded-2xl relative overflow-hidden flex flex-col justify-end shadow-2xl backdrop-blur-sm">
                             {/* Waving fluid simulation with gradient */}
                             <div 
                                className={cn(
                                   "w-full transition-all duration-500 ease-out relative",
                                   isCritical 
                                      ? "bg-gradient-to-t from-red-900/60 to-red-500/80" 
                                      : "bg-gradient-to-t from-orange-650/60 to-yellow-500/80"
                                )}
                                style={{ height: `${liquidP}%` }}
                             >
                                {/* Wave shape overlays for animations */}
                                <div className="absolute left-0 right-0 -top-2 h-4 bg-inherit opacity-40 rounded-full animate-pulse filter blur-[1px]"></div>
                                
                                {/* Floating bubbles */}
                                <div className="absolute bottom-2 left-8 w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"></div>
                                <div className="absolute bottom-10 right-14 w-2 h-2 bg-white/20 rounded-full animate-ping"></div>
                                <div className="absolute bottom-20 left-16 w-1 h-1 bg-white/15 rounded-full animate-bounce"></div>
                                <div className="absolute bottom-6 right-20 w-1.5 h-1.5 bg-white/25 rounded-full animate-bounce"></div>
                             </div>

                             {/* Tank Level Overlay Stats */}
                             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xl font-black font-mono text-white tracking-tighter drop-shadow-md">
                                   %{liquidP}
                                </span>
                                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest drop-shadow">
                                   Kazan Seviyesi
                                </span>
                                <span className="text-[9px] font-mono text-gray-300 mt-1 font-bold drop-shadow">
                                   {liquidH} cm / {maxHeight} cm
                                </span>
                             </div>

                             {/* Critical Alarm Blinking Badge */}
                             {isCritical && (
                                <div className="absolute top-3 left-0 right-0 mx-auto w-20 bg-red-600/95 text-white border border-red-500/30 text-[7px] font-black text-center py-0.5 rounded-full uppercase tracking-wider animate-bounce shadow-lg shadow-red-900/35">
                                   Kritik Limit!
                                </div>
                             )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                             <div className="bg-[#1C2029] border border-gray-800 p-2 rounded text-center">
                                <div className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">Sıvı Yüksekliği</div>
                                <div className="text-xs font-mono font-bold text-blue-400">{liquidH} cm</div>
                             </div>
                             <div className="bg-[#1C2029] border border-gray-800 p-2 rounded text-center">
                                <div className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">Kritik Eşik Hacmi</div>
                                <div className="text-xs font-mono font-bold text-red-400">
                                   {Math.round((maxHeight * critPercent) / 100)} cm ({critPercent}%)
                                </div>
                             </div>
                          </div>
                       </div>
                    );
                 })()}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'NANOS' && (
        <div className="bg-[#151921] border border-[#2D333F] rounded p-4">
          <div className="flex justify-between items-center mb-4 border-b border-[#374151] pb-2">
            <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-indigo-500 pl-2 flex items-center">
              <Link className="mr-2 text-gray-500" size={14} /> Mikrodenetleyici Bağlantı Ayarları
            </h3>
            <button 
               onClick={onAddNano}
               disabled={data.mode === 'OTOMATİK'}
               className="flex items-center space-x-1 bg-[#1e1b4b] border border-[#312e81] hover:bg-[#312e81] text-[#a5b4fc] px-2 py-1 rounded font-bold disabled:opacity-50 text-[10px]"
            >
              <Plus size={12} />
              <span>NANO EKLE</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.nanos.map(nano => (
               <div key={nano.id} className="bg-[#0D1016] border border-[#1F2937] p-3 rounded flex flex-col space-y-3">
                  <div className="flex justify-between items-center bg-[#1C2029] px-2 py-1 rounded border border-[#374151]">
                     <input
                        type="text"
                        value={nano.name}
                        onChange={(e) => onUpdateNanoConfig(nano.id, { name: e.target.value })}
                        disabled={data.mode === 'OTOMATİK'}
                        className="bg-transparent text-[11px] font-bold text-gray-300 outline-none w-32 border-b border-transparent focus:border-indigo-500 disabled:opacity-80"
                     />
                     <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-[9px] font-bold">
                           <Activity size={10} className={nano.status === 'ONLINE' ? 'text-green-500' : 'text-red-500'} />
                           <span className={nano.status === 'ONLINE' ? 'text-green-400' : 'text-red-400'}>{nano.status}</span>
                        </div>
                        <button
                           onClick={() => onSendNanoCommand(nano.id, 'RESET')}
                           className="bg-yellow-900/60 border border-yellow-700/50 hover:bg-yellow-800 hover:text-white text-yellow-500 text-[9px] px-2 py-0.5 rounded transition-colors"
                           title="Nano'yu yeniden başlat (Reset)"
                        >
                           RESET
                        </button>
                        <button 
                          onClick={() => onRemoveNano(nano.id)} 
                          disabled={data.mode === 'OTOMATİK'} 
                          className="text-gray-500 hover:text-red-400 disabled:opacity-50 p-1"
                        >
                           <Trash2 size={12} />
                        </button>
                     </div>
                  </div>
                  <div className="flex space-x-3">
                     <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">Seri Port (COM)</label>
                        <div className="flex space-x-1">
                           <input
                              type="text"
                              list={`ports-list-${nano.id}`}
                              value={nano.port || ''}
                              onChange={(e) => onUpdateNanoConfig(nano.id, { port: e.target.value })}
                              disabled={data.mode === 'OTOMATİK'}
                              className="w-full bg-[#151921] border border-[#374151] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50"
                              placeholder="Örn: /dev/ttyUSB0 veya serial 0"
                           />
                           <datalist id={`ports-list-${nano.id}`}>
                              {Array.from(new Set([...(data.serialPorts || []), ...availablePorts, "serial 0", "serial 1", "/dev/ttyAMA0", "/dev/ttyAMA1"])).map(p => {
                                 const inUseBy = data.nanos.find(n => n.id !== nano.id && n.port === p);
                                 return (
                                   <option key={p} value={p}>
                                     {inUseBy ? `(Kullanımda: ${inUseBy.name})` : ''}
                                   </option>
                                 );
                              })}
                           </datalist>
                          <button 
                             onClick={handleScan} 
                             disabled={isScanning || data.mode === 'OTOMATİK'} 
                             className="bg-[#1C2029] border border-[#374151] rounded px-2 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-50"
                             title="Portları Yenile"
                          >
                             <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                          </button>
                        </div>
                     </div>
                     <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">Baud Rate</label>
                        <select 
                           value={nano.baudRate || 9600}
                           onChange={(e) => onUpdateNanoConfig(nano.id, { baudRate: Number(e.target.value) })}
                           disabled={data.mode === 'OTOMATİK'}
                           className="w-full bg-[#151921] border border-[#374151] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50"
                        >
                           <option value={9600}>9600</option>
                           <option value={19200}>19200</option>
                           <option value={38400}>38400</option>
                           <option value={57600}>57600</option>
                           <option value={115200}>115200</option>
                        </select>
                     </div>
                  </div>
               </div>
            ))}
            {data.nanos.length === 0 && (
               <div className="md:col-span-2 text-center text-gray-500 text-xs py-8 bg-[#0D1016] border border-[#1F2937] rounded">
                 Hiçbir nano yapılandırılmadı. NANO EKLE butonunu kullanarak ekleyebilirsiniz.
               </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'SENSORS' && (
        <div className="h-full overflow-y-auto pr-2 pb-10">
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-emerald-500 pl-2 flex items-center">
                <Settings2 className="mr-2 text-gray-500" size={14} /> Lazer ve Sayaç Sensörleri
              </h3>
              <button 
                 onClick={onAddSensor}
                 disabled={data.mode === 'OTOMATİK'}
                 className="flex items-center space-x-1 bg-[#052e16] border border-[#14532d] hover:bg-[#14532d] text-[#4ade80] px-2 py-1 rounded font-bold disabled:opacity-50 text-[10px]"
              >
                <Plus size={12} />
                <span>SENSÖR EKLE</span>
              </button>
            </div>

            {/* Lazer Kalibrasyon ve Test Paneli */}
            <div className="bg-[#0D1016] border border-[#1F2937] rounded p-4 mb-4 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-[#2D333F] pb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="text-emerald-500 animate-pulse" size={16} />
                  <h4 className="text-xs font-bold text-gray-200">LAZER SENSÖR HİZALAMA VE DEBOUNCE AYARI</h4>
                </div>
                <button
                  onClick={() => socket?.emit('ACTION', { type: 'RESET_TEST_COUNTERS' })}
                  className="flex items-center space-x-1.5 bg-blue-950/80 border border-blue-800 hover:bg-blue-900/60 text-blue-400 px-3 py-1 rounded font-bold text-[10px] transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>TEST SAYAÇLARINI SIFIRLA</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Giriş Lazer Sensörü Test Kartı */}
                {(() => {
                  const inputSensors = data.sensors.filter(s => s.type === 'INPUT');
                  if (inputSensors.length === 0) return (
                    <div className="bg-[#151921] border border-[#1F2937] p-4 rounded text-center text-gray-500 text-xs">
                      Giriş sayıcı lazer sensörü tanımlanmamış.
                    </div>
                  );
                  return inputSensors.map(sensor => {
                    const cleanedPin = sensor.pin.replace('D', '').trim();
                    const deviceKey = sensor.device === 'RASPI' ? 'RASPI' : (sensor.connectionId || 'GatesNano');
                    const isSignalActive = rawSensorSignals[`${deviceKey}:${cleanedPin}`] === 'ACTIVE';

                    return (
                      <div key={sensor.id} className="bg-[#151921] border border-[#1F2937] p-3 rounded flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-300">{sensor.name} (Giriş)</span>
                            <span className="text-[9px] text-gray-500 block font-mono">Pin: {sensor.pin} | Cihaz: {deviceKey}</span>
                          </div>
                          {/* Live Status Badge */}
                          <div className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider transition-all duration-100 flex items-center space-x-1",
                            isSignalActive 
                              ? "bg-green-950 border border-green-700 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]" 
                              : "bg-gray-950 border border-gray-800 text-gray-500"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isSignalActive ? "bg-green-400 animate-ping" : "bg-gray-600")} />
                            <span>{isSignalActive ? 'SİNYAL AKTİF (ENGEL)' : 'SİNYAL PASİF (AÇIK)'}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 bg-[#0D1016] border border-[#1F2937] p-3 rounded">
                          <div className="flex flex-col items-center justify-center shrink-0 w-20 border-r border-[#1F2937] pr-3">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Test Sayısı</span>
                            <span className="text-xl font-black text-blue-400 font-mono mt-1">{data.testInputCount ?? 0}</span>
                          </div>
                          <div className="flex-1 flex flex-col space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-gray-400">Gürültü Filtresi (Debounce)</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{sensor.debounceMs ?? 50} ms</span>
                            </div>
                            <input 
                              type="range"
                              min="10"
                              max="2000"
                              step="10"
                              value={sensor.debounceMs ?? 50}
                              onChange={(e) => onUpdateSensor?.(sensor.id, { debounceMs: Number(e.target.value) })}
                              className="w-full accent-emerald-500 cursor-pointer bg-gray-700 h-1 rounded outline-none"
                            />
                            <span className="text-[8px] text-gray-600 leading-normal">
                              EMI parazitlerini önlemek için filtre süresi. Valf/Motor çalışırken yanlış sayma varsa arttırın.
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Çıkış Lazer Sensörü Test Kartı */}
                {(() => {
                  const outputSensors = data.sensors.filter(s => s.type === 'OUTPUT');
                  if (outputSensors.length === 0) return (
                    <div className="bg-[#151921] border border-[#1F2937] p-4 rounded text-center text-gray-500 text-xs">
                      Çıkış sayıcı lazer sensörü tanımlanmamış.
                    </div>
                  );
                  return outputSensors.map(sensor => {
                    const cleanedPin = sensor.pin.replace('D', '').trim();
                    const deviceKey = sensor.device === 'RASPI' ? 'RASPI' : (sensor.connectionId || 'GatesNano');
                    const isSignalActive = rawSensorSignals[`${deviceKey}:${cleanedPin}`] === 'ACTIVE';

                    return (
                      <div key={sensor.id} className="bg-[#151921] border border-[#1F2937] p-3 rounded flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-300">{sensor.name} (Çıkış)</span>
                            <span className="text-[9px] text-gray-500 block font-mono">Pin: {sensor.pin} | Cihaz: {deviceKey}</span>
                          </div>
                          {/* Live Status Badge */}
                          <div className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider transition-all duration-100 flex items-center space-x-1",
                            isSignalActive 
                              ? "bg-green-950 border border-green-700 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]" 
                              : "bg-gray-950 border border-gray-800 text-gray-500"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isSignalActive ? "bg-green-400 animate-ping" : "bg-gray-600")} />
                            <span>{isSignalActive ? 'SİNYAL AKTİF (ENGEL)' : 'SİNYAL PASİF (AÇIK)'}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 bg-[#0D1016] border border-[#1F2937] p-3 rounded">
                          <div className="flex flex-col items-center justify-center shrink-0 w-20 border-r border-[#1F2937] pr-3">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Test Sayısı</span>
                            <span className="text-xl font-black text-blue-400 font-mono mt-1">{data.testOutputCount ?? 0}</span>
                          </div>
                          <div className="flex-1 flex flex-col space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-gray-400">Gürültü Filtresi (Debounce)</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{sensor.debounceMs ?? 50} ms</span>
                            </div>
                            <input 
                              type="range"
                              min="10"
                              max="2000"
                              step="10"
                              value={sensor.debounceMs ?? 50}
                              onChange={(e) => onUpdateSensor?.(sensor.id, { debounceMs: Number(e.target.value) })}
                              className="w-full accent-emerald-500 cursor-pointer bg-gray-700 h-1 rounded outline-none"
                            />
                            <span className="text-[8px] text-gray-600 leading-normal">
                              Hizalama kalitesini test etmek için live durum ışığını izleyin; kararlı şekilde yanıp sönmelidir.
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-full overflow-y-auto pr-2 pb-4">
              {data.sensors.map(sensor => (
                <div key={sensor.id} className={cn(
                  "p-3 rounded border flex flex-col justify-between space-y-3",
                  sensor.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
                )}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", sensor.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
                    <input 
                       type="text" 
                       value={sensor.name} 
                       onChange={(e) => onUpdateSensor?.(sensor.id, { name: e.target.value })}
                       disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                       className={cn("text-xs font-bold bg-transparent outline-none border-b border-transparent focus:border-[#374151] w-full", sensor.enabled ? "text-gray-200" : "text-gray-500")}
                    />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
                        <select 
                           value={sensor.device || 'RASPI'} 
                           onChange={(e) => onUpdateSensor?.(sensor.id, { device: e.target.value as 'RASPI' | 'NANO' })}
                           disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                           className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="RASPI">Raspberry Pi</option>
                           <option value="NANO">Arduino Nano</option>
                        </select>
                      </div>
                      
                      {sensor.device === 'NANO' ? (
                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
                          <select 
                             value={sensor.connectionId || ''} 
                             onChange={(e) => onUpdateSensor?.(sensor.id, { connectionId: e.target.value })}
                             disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                             className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded pl-2 pr-6 py-1 truncate outline-none disabled:opacity-50"
                          >
                             <option value="">Seçiniz...</option>
                             {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-500 font-bold mb-1">Tür</label>
                          <select 
                             value={sensor.type || 'INPUT'} 
                             onChange={(e) => onUpdateSensor?.(sensor.id, { type: e.target.value as 'INPUT' | 'OUTPUT' })}
                             disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                             className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                          >
                             <option value="INPUT">Giriş (Input)</option>
                             <option value="OUTPUT">Çıkış (Output)</option>
                          </select>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">{sensor.device === 'RASPI' ? 'GPIO Pin' : 'Sensör Pini'}</label>
                        <input 
                          type="text" 
                          value={sensor.pin || ''} 
                          placeholder={sensor.device === 'RASPI' ? 'Örn: GPIO14' : 'Örn: D2, A1'}
                          onChange={(e) => onUpdateSensor?.(sensor.id, { pin: e.target.value })}
                          disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                          className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Direnç (Resistor)</label>
                        <select 
                           value={sensor.resistorType || 'NONE'} 
                           onChange={(e) => onUpdateSensor?.(sensor.id, { resistorType: e.target.value as any })}
                           disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                           className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="NONE">Yok</option>
                           <option value="PULLUP">Pull-Up</option>
                           <option value="PULLDOWN">Pull-Down</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                       <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1" title="Sinyal bekleme süresi">Debounce (ms)</label>
                        <input 
                          type="number" 
                          value={sensor.debounceMs || 50} 
                          onChange={(e) => onUpdateSensor?.(sensor.id, { debounceMs: Number(e.target.value) })}
                          disabled={!sensor.enabled || data.mode === 'OTOMATİK'}
                          className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
                    <button 
                      onClick={() => onToggleSensorEnabled(sensor.id)}
                      disabled={data.mode === 'OTOMATİK'}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
                        sensor.enabled 
                           ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
                           : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
                      )}
                    >
                      {sensor.enabled ? 'PASİFE AL' : 'AKTİFLEŞTİR'}
                    </button>
                    <button 
                      onClick={() => onRemoveSensor?.(sensor.id)}
                      disabled={data.mode === 'OTOMATİK' || data.sensors.length <= 1}
                      className="p-1.5 text-gray-500 bg-[#0D1016] border border-[#1F2937] hover:text-red-400 hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
                      title="Sensörü Çıkar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {data.sensors.length === 0 && (
                 <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center text-gray-500 text-xs py-8">Sistemdeki tüm sensörler çıkarıldı.</div>
              )}
            </div>
          </div>
        </div>
        )}

        {activeTab === 'GATES' && (
        <div className="h-full overflow-y-auto pr-2 pb-10">
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-pink-500 pl-2 flex items-center">
                <Settings2 className="mr-2 text-gray-500" size={14} /> Step Sürücüler (NEMA 17)
              </h3>
              <button 
                 onClick={onAddGate}
                 disabled={data.mode === 'OTOMATİK'}
                 className="flex items-center space-x-1 bg-[#4a044e] border border-[#701a75] hover:bg-[#701a75] text-[#fbcfe8] px-2 py-1 rounded font-bold disabled:opacity-50 text-[10px]"
              >
                <Plus size={12} />
                <span>KİLİT EKLE</span>
              </button>
            </div>
            
            <div className="space-y-6 max-h-full overflow-y-auto pr-2 pb-4">
              <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 font-bold px-1 mb-2">SİSTEM KİLİTLERİ (SABİT)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <div className={cn(
                      "p-3 rounded border flex flex-col justify-between space-y-3",
                      data.inputGate.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
                    )}>
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", data.inputGate.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
                        <div>
                          <div className={cn("text-xs font-bold", data.inputGate.enabled ? "text-gray-200" : "text-gray-500")}>Giriş Kapısı Motoru</div>
                          <div className="text-[9px] font-mono text-gray-500">{data.inputGate.enabled ? 'AKTİF' : 'DEVRE DIŞI'}</div>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
                            <select 
                               value={data.inputGate.device || 'NANO'} 
                               onChange={(e) => {
                                 const newDevice = e.target.value as 'RASPI' | 'NANO';
                                 onUpdateSystemGate?.('inputGate', { 
                                   device: newDevice,
                                   nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                                 });
                               }}
                               disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                               className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            >
                               <option value="RASPI">Raspberry Pi 5</option>
                               <option value="NANO">Arduino Nano</option>
                            </select>
                          </div>
                          
                          {(!data.inputGate.device || data.inputGate.device === 'NANO') ? (
                            <div className="flex flex-col">
                              <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
                              <select 
                                 value={data.inputGate.nanoId && data.inputGate.nanoId !== 'RASPI' ? data.inputGate.nanoId : ''} 
                                 onChange={(e) => onUpdateSystemGate?.('inputGate', { nanoId: e.target.value })}
                                 disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                                 className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                              >
                                 <option value="">Seçiniz...</option>
                                 {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
                              <div className="text-[10px] text-blue-400 font-semibold px-2 py-1.5 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                                Pi 5 Dahili GPIO
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Step Pin</label>
                            <input 
                              type="text" 
                              value={data.inputGate.pin || ''} 
                              placeholder="Örn: 2"
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { pin: e.target.value })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Dir Pin</label>
                            <input 
                              type="text" 
                              value={data.inputGate.dirPin || ''} 
                              placeholder="Örn: 3"
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { dirPin: e.target.value })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">EN Pin</label>
                            <input 
                              type="text" 
                              value={data.inputGate.enablePin || ''} 
                              placeholder="Ops."
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { enablePin: e.target.value })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Açılırken atılacak adım">Açılma (Adım)</label>
                            <input 
                              type="number" 
                              value={data.inputGate.stepsToOpen || 200} 
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { stepsToOpen: Number(e.target.value) })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Kapanırken atılacak adım">Kapanma (Adım)</label>
                            <input 
                              type="number" 
                              value={data.inputGate.stepsToClose || 200} 
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { stepsToClose: Number(e.target.value) })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Hız (Adım/sn)</label>
                            <input 
                              type="number" 
                              value={data.inputGate.speed || 1000} 
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { speed: Number(e.target.value) })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">İvme (Adım/sn²)</label>
                            <input 
                              type="number" 
                              value={data.inputGate.acceleration || 500} 
                              onChange={(e) => onUpdateSystemGate?.('inputGate', { acceleration: Number(e.target.value) })}
                              disabled={!data.inputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
                        <button 
                          onClick={() => onToggleGateEnabled('inputGate')}
                          disabled={data.mode === 'OTOMATİK'}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
                            data.inputGate.enabled 
                               ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
                               : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
                          )}
                        >
                          {data.inputGate.enabled ? 'PASİFE AL' : 'AKTİFLEŞTİR'}
                        </button>
                      </div>
                    </div>
                    <div className={cn(
                      "p-3 rounded border flex flex-col justify-between space-y-3",
                      data.outputGate.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
                    )}>
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", data.outputGate.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
                        <div>
                          <div className={cn("text-xs font-bold", data.outputGate.enabled ? "text-gray-200" : "text-gray-500")}>Çıkış Kapısı Motoru</div>
                          <div className="text-[9px] font-mono text-gray-500">{data.outputGate.enabled ? 'AKTİF' : 'DEVRE DIŞI'}</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
                            <select 
                               value={data.outputGate.device || 'NANO'} 
                               onChange={(e) => {
                                 const newDevice = e.target.value as 'RASPI' | 'NANO';
                                 onUpdateSystemGate?.('outputGate', { 
                                   device: newDevice,
                                   nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                                 });
                               }}
                               disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                               className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            >
                               <option value="RASPI">Raspberry Pi 5</option>
                               <option value="NANO">Arduino Nano</option>
                            </select>
                          </div>
                          
                          {(!data.outputGate.device || data.outputGate.device === 'NANO') ? (
                            <div className="flex flex-col">
                              <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
                              <select 
                                 value={data.outputGate.nanoId && data.outputGate.nanoId !== 'RASPI' ? data.outputGate.nanoId : ''} 
                                 onChange={(e) => onUpdateSystemGate?.('outputGate', { nanoId: e.target.value })}
                                 disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                                 className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                              >
                                 <option value="">Seçiniz...</option>
                                 {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
                              <div className="text-[10px] text-blue-400 font-semibold px-2 py-1.5 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                                Pi 5 Dahili GPIO
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Step Pin</label>
                            <input 
                              type="text" 
                              value={data.outputGate.pin || ''} 
                              placeholder="Örn: 4"
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { pin: e.target.value })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Dir Pin</label>
                            <input 
                              type="text" 
                              value={data.outputGate.dirPin || ''} 
                              placeholder="Örn: 5"
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { dirPin: e.target.value })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">EN Pin</label>
                            <input 
                              type="text" 
                              value={data.outputGate.enablePin || ''} 
                              placeholder="Ops."
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { enablePin: e.target.value })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Açılırken atılacak adım">Açılma (Adım)</label>
                            <input 
                              type="number" 
                              value={data.outputGate.stepsToOpen || 200} 
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { stepsToOpen: Number(e.target.value) })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Kapanırken atılacak adım">Kapanma (Adım)</label>
                            <input 
                              type="number" 
                              value={data.outputGate.stepsToClose || 200} 
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { stepsToClose: Number(e.target.value) })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">Hız (Adım/sn)</label>
                            <input 
                              type="number" 
                              value={data.outputGate.speed || 1000} 
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { speed: Number(e.target.value) })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[9px] text-gray-500 font-bold mb-1">İvme (Adım/sn²)</label>
                            <input 
                              type="number" 
                              value={data.outputGate.acceleration || 500} 
                              onChange={(e) => onUpdateSystemGate?.('outputGate', { acceleration: Number(e.target.value) })}
                              disabled={!data.outputGate.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
                        <button 
                          onClick={() => onToggleGateEnabled('outputGate')}
                          disabled={data.mode === 'OTOMATİK'}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
                            data.outputGate.enabled 
                               ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
                               : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
                          )}
                        >
                          {data.outputGate.enabled ? 'PASİFE AL' : 'AKTİFLEŞTİR'}
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
              
              {data.extraGates && data.extraGates.length > 0 && (
                 <div className="space-y-2">
                   <div className="text-[10px] text-gray-500 font-bold px-1 mb-2">EK KİLİTLER</div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                     {data.extraGates.map((gate) => (
                        <div key={gate.id} className={cn(
                          "p-3 rounded border flex flex-col justify-between space-y-3",
                          gate.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
                        )}>
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", gate.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
                            <input 
                               type="text" 
                               value={gate.name || ''} 
                               onChange={(e) => onUpdateGate?.(gate.id!, { name: e.target.value })}
                               disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                               className={cn("text-xs font-bold bg-transparent outline-none border-b border-transparent focus:border-[#374151] w-full", gate.enabled ? "text-gray-200" : "text-gray-500")}
                            />
                          </div>

                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
                                <select 
                                   value={gate.device || 'NANO'} 
                                   onChange={(e) => {
                                     const newDevice = e.target.value as 'RASPI' | 'NANO';
                                     onUpdateGate?.(gate.id!, { 
                                       device: newDevice,
                                       nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                                     });
                                   }}
                                   disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                   className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                >
                                   <option value="RASPI">Raspberry Pi 5</option>
                                   <option value="NANO">Arduino Nano</option>
                                </select>
                              </div>
                              
                              {(!gate.device || gate.device === 'NANO') ? (
                                <div className="flex flex-col">
                                  <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
                                  <select 
                                     value={gate.nanoId && gate.nanoId !== 'RASPI' ? gate.nanoId : ''} 
                                     onChange={(e) => onUpdateGate?.(gate.id!, { nanoId: e.target.value })}
                                     disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                     className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                  >
                                     <option value="">Seçiniz...</option>
                                     {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
                                  <div className="text-[10px] text-blue-400 font-semibold px-2 py-1.5 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                                    Pi 5 Dahili GPIO
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">Step Pin</label>
                                <input 
                                  type="text" 
                                  value={gate.pin || ''} 
                                  placeholder="Örn: 6"
                                  onChange={(e) => onUpdateGate?.(gate.id!, { pin: e.target.value })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">Dir Pin</label>
                                <input 
                                  type="text" 
                                  value={gate.dirPin || ''} 
                                  placeholder="Örn: 7"
                                  onChange={(e) => onUpdateGate?.(gate.id!, { dirPin: e.target.value })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">EN Pin</label>
                                <input 
                                  type="text" 
                                  value={gate.enablePin || ''} 
                                  placeholder="Ops."
                                  onChange={(e) => onUpdateGate?.(gate.id!, { enablePin: e.target.value })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1" title="Açılırken atılacak adım">Açılma (Adım)</label>
                                <input 
                                  type="number" 
                                  value={gate.stepsToOpen || 200} 
                                  onChange={(e) => onUpdateGate?.(gate.id!, { stepsToOpen: Number(e.target.value) })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1" title="Kapanırken atılacak adım">Kapanma (Adım)</label>
                                <input 
                                  type="number" 
                                  value={gate.stepsToClose || 200} 
                                  onChange={(e) => onUpdateGate?.(gate.id!, { stepsToClose: Number(e.target.value) })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">Hız (Adım/sn)</label>
                                <input 
                                  type="number" 
                                  value={gate.speed || 1000} 
                                  onChange={(e) => onUpdateGate?.(gate.id!, { speed: Number(e.target.value) })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <label className="text-[9px] text-gray-500 font-bold mb-1">İvme (Adım/sn²)</label>
                                <input 
                                  type="number" 
                                  value={gate.acceleration || 500} 
                                  onChange={(e) => onUpdateGate?.(gate.id!, { acceleration: Number(e.target.value) })}
                                  disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
                            <button 
                              onClick={() => onToggleExtraGateEnabled?.(gate.id!)}
                              disabled={data.mode === 'OTOMATİK'}
                              className={cn(
                                "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
                                gate.enabled 
                                   ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
                                   : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
                              )}
                            >
                              {gate.enabled ? 'PASİFE AL' : 'AKTİFLEŞTİR'}
                            </button>
                            <button 
                              onClick={() => onRemoveGate?.(gate.id!)}
                              disabled={data.mode === 'OTOMATİK'}
                              className="p-1.5 text-gray-500 bg-[#0D1016] border border-[#1F2937] hover:text-red-400 hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
                              title="Kilidi Çıkar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                     ))}
                   </div>
                 </div>
              )}
            </div>
          </div>
        </div>
        )}

        {activeTab === 'VALVES' && (
        <div className="h-full overflow-y-auto pr-2 pb-10">
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-[#F97316] pl-2 flex items-center">
                <Settings2 className="mr-2 text-gray-500" size={14} /> Valf Modülleri
              </h3>
              <button 
                 onClick={onAddHardware}
                 disabled={data.mode === 'OTOMATİK'}
                 className="flex items-center space-x-1 bg-[#052e16] border border-[#14532d] hover:bg-[#14532d] text-[#4ade80] px-2 py-1 rounded font-bold disabled:opacity-50 text-[10px]"
              >
                <Plus size={12} />
                <span>MODÜL EKLE</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-full overflow-y-auto pr-2 pb-4">
              {data.valves.map(valve => (
                <div key={valve.id} className={cn(
                  "p-3 rounded border flex flex-col justify-between space-y-3",
                  valve.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", valve.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
                      <div>
                        {editingValveId === valve.id ? (
                          <input 
                            type="text"
                            value={tempValveName}
                            onChange={(e) => setTempValveName(e.target.value)}
                            className="bg-[#0D1016] border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-white font-bold outline-none w-32"
                            autoFocus
                          />
                        ) : (
                          <div className={cn("text-xs font-bold", valve.enabled ? "text-gray-200" : "text-gray-500")}>
                            {valve.name || `Valf Modülü #${valve.id}`}
                          </div>
                        )}
                        <div className="text-[9px] font-mono text-gray-500">{valve.enabled ? 'AKTİF (İZLENİYOR)' : 'PASİF (DEVRE DIŞI)'}</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {editingValveId === valve.id ? (
                        <button 
                          onClick={() => {
                            onUpdateValve?.(valve.id, { name: tempValveName });
                            setEditingValveId(null);
                          }}
                          className="p-1 hover:bg-emerald-500/10 text-emerald-500 rounded transition-colors"
                        >
                          <Check size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingValveId(valve.id);
                            setTempValveName(valve.name || `Valf Modülü #${valve.id}`);
                          }}
                          className="p-1 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 rounded transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
                        <select 
                           value={valve.device || 'NANO'} 
                           onChange={(e) => {
                             const newDevice = e.target.value as 'RASPI' | 'NANO';
                             onUpdateValve?.(valve.id, { 
                               device: newDevice,
                               nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                             });
                           }}
                           disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                           className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="RASPI">Raspberry Pi 5</option>
                           <option value="NANO">Arduino Nano</option>
                        </select>
                      </div>
                      
                      {(!valve.device || valve.device === 'NANO') ? (
                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
                          <select 
                             value={valve.nanoId && valve.nanoId !== 'RASPI' ? valve.nanoId : ''} 
                             onChange={(e) => onUpdateValve?.(valve.id, { nanoId: e.target.value })}
                             disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                             className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded pl-2 pr-6 py-1 truncate outline-none disabled:opacity-50"
                          >
                             <option value="">Seçiniz...</option>
                             {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
                          <div className="text-[10px] text-blue-400 font-semibold px-2 py-1 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                            Pi 5 Dahili GPIO
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Pin Bağlantısı</label>
                        <input 
                          type="text" 
                          value={valve.pin || ''} 
                          placeholder={valve.device === 'RASPI' ? 'Örn: GPIO23' : 'Örn: D3, A0'}
                          onChange={(e) => onUpdateValve?.(valve.id, { pin: e.target.value })}
                          disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                          className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Çalışma Modu</label>
                        <select 
                           value={valve.mode || 'PULSE'} 
                           onChange={(e) => onUpdateValve?.(valve.id, { mode: e.target.value as 'PULSE' | 'CONTINUOUS' })}
                           disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                           className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="PULSE">PULSE (Zamanlı)</option>
                           <option value="CONTINUOUS">CONTINUOUS (Sürekli)</option>
                        </select>
                      </div>
                      <div className="flex flex-col w-16 group relative shrink-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1" title="Süre veya Hız ayarı">{valve.mode === 'CONTINUOUS' ? 'Hız (%)' : 'Açık (ms)'}</label>
                        {valve.mode === 'CONTINUOUS' ? (
                           <input 
                              type="number" 
                              value={valve.speed ?? 100} 
                              step="10"
                              min="0"
                              max="100"
                              onChange={(e) => onUpdateValve?.(valve.id, { speed: Number(e.target.value) })}
                              disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                           />
                        ) : (
                           <input 
                              type="number" 
                              value={valve.pulseDuration || 1000} 
                              step="100"
                              min="100"
                              onChange={(e) => onUpdateValve?.(valve.id, { pulseDuration: Number(e.target.value) })}
                              disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                           />
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Röle Tipi</label>
                        <select 
                           value={valve.relayType || 'NO'} 
                           onChange={(e) => onUpdateValve?.(valve.id, { relayType: e.target.value as any })}
                           disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                           className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="NO">NO (Açık)</option>
                           <option value="NC">NC (Kapalı)</option>
                        </select>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Tetikleme</label>
                        <select 
                           value={valve.relayInversion ? 'LOW' : 'HIGH'} 
                           onChange={(e) => onUpdateValve?.(valve.id, { relayInversion: e.target.value === 'LOW' })}
                           disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                           className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="HIGH">Aktif Yük. (5V)</option>
                           <option value="LOW">Aktif Düş. (0V)</option>
                        </select>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[9px] text-gray-500 font-bold mb-1">Sinyal Türü</label>
                        <select 
                           value={valve.signalType || 'DIGITAL'} 
                           onChange={(e) => onUpdateValve?.(valve.id, { signalType: e.target.value as any })}
                           disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                           className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
                        >
                           <option value="DIGITAL">Dijital</option>
                           <option value="PWM">PWM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
                    <button 
                      onClick={() => onToggleHardwareStatus(valve.id)}
                      disabled={data.mode === 'OTOMATİK'}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
                        valve.enabled 
                           ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
                           : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
                      )}
                    >
                      {valve.enabled ? 'DEVRE DIŞI BIRAK' : 'AKTİFLEŞTİR'}
                    </button>
                    <button 
                      onClick={() => onRemoveHardware(valve.id)}
                      disabled={data.mode === 'OTOMATİK' || data.valves.length <= 1}
                      className="p-1.5 text-gray-500 bg-[#0D1016] border border-[#1F2937] hover:text-red-400 hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
                      title="Modülü Çıkar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {data.valves.length === 0 && (
                 <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center text-gray-500 text-xs py-8">Sistemdeki tüm valf modülleri çıkarıldı.</div>
              )}
            </div>
          </div>
        </div>
        )}

        {activeTab === 'TERMINAL' && (
          <div className="bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 border-b border-[#374151] pb-2 shrink-0">
              <h3 className="text-[11px] uppercase font-bold text-gray-300 border-l-2 border-blue-500 pl-2 flex items-center">
                <Terminal className="mr-2 text-gray-500" size={14} /> Haberleşme Terminali
              </h3>
              <div className="flex space-x-2">
                 {data.nanos?.map(nano => (
                    <div key={nano.id} className="flex items-center text-[9px] font-mono text-gray-400 bg-[#0D1016] border border-[#1F2937] px-2 py-0.5 rounded">
                       <Activity size={10} className="text-green-500 mr-1" />
                       {nano.id}: {nano.pingMs}ms
                    </div>
                 ))}
              </div>
            </div>

            <div className="flex-1 bg-[#050505] border border-[#1F2937] rounded flex flex-col min-h-0 relative">
               <div ref={terminalRef} className="absolute inset-0 p-2 overflow-hidden" />
            </div>

            {/* Quick Commands Bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2 shrink-0">
               <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mr-1">Kısayollar:</span>
               
               {/* System Commands */}
               <div className="flex gap-1 border-r border-[#2D333F] pr-2">
                  {[
                    { label: 'STATUS', cmd: 'STATUS', color: 'text-emerald-500 border-emerald-900/30 bg-emerald-900/10' },
                    { label: 'PING', cmd: 'PING', color: 'text-blue-500 border-blue-900/30 bg-blue-900/10' },
                    { label: 'WHOAMI', cmd: 'WHOAMI', color: 'text-purple-500 border-purple-900/30 bg-purple-900/10' },
                  ].map(btn => (
                    <button key={btn.cmd} type="button" onClick={() => onSendNanoCommand(activeNanoId, btn.cmd)}
                      className={cn("px-2 py-1 rounded border text-[9px] font-bold transition-all hover:scale-105 active:scale-95", btn.color)}>
                      {btn.label}
                    </button>
                  ))}
               </div>

               {/* Valve Tests */}
               <div className="flex gap-1 border-r border-[#2D333F] pr-2">
                  {[1, 2, 3].map(id => (
                    <button key={`V${id}`} type="button" onClick={() => onSendNanoCommand(activeNanoId, `VALVE_${id}_TEST`)}
                      className="px-2 py-1 rounded border border-orange-900/30 bg-orange-900/10 text-orange-500 text-[9px] font-bold transition-all hover:scale-105 active:scale-95">
                      V{id} TEST
                    </button>
                  ))}
               </div>

               {/* Sensor Checks */}
               <div className="flex gap-1 border-r border-[#2D333F] pr-2">
                  {[
                    { label: 'S-GİRİŞ', cmd: 'SENS_IN_READ' },
                    { label: 'S-ÇIKIŞ', cmd: 'SENS_OUT_READ' },
                  ].map(btn => (
                    <button key={btn.cmd} type="button" onClick={() => onSendNanoCommand(activeNanoId, btn.cmd)}
                      className="px-2 py-1 rounded border border-yellow-900/30 bg-yellow-900/10 text-yellow-500 text-[9px] font-bold transition-all hover:scale-105 active:scale-95">
                      {btn.label}
                    </button>
                  ))}
               </div>

               {/* Utility */}
               <button type="button" onClick={() => onSendNanoCommand(activeNanoId, 'CLEAR')}
                 className="px-2 py-1 rounded border border-gray-800 bg-gray-900/10 text-gray-500 text-[9px] font-bold transition-all hover:scale-105 active:scale-95">
                 TEMİZLE
               </button>
            </div>

            <form onSubmit={handleCommandSubmit} className="mt-2 flex space-x-2 shrink-0">
              <select 
                value={activeNanoId === 'ALL' && !data.nanos.some(n=>n.id==='ALL') ? 'ALL' : activeNanoId} 
                onChange={e => setSelectedNano(e.target.value)}
                className="bg-[#0D1016] border border-[#374151] text-xs text-gray-200 px-2 py-1.5 rounded outline-none w-56 focus:border-blue-500 font-mono"
              >
                <option value="ALL">BROADCAST</option>
                {data.nanos?.map(nano => (
                  <option key={nano.id} value={nano.id}>{nano.name}</option>
                ))}
              </select>
              
              <input 
                type="text" 
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                placeholder="Komut (örn. STATUS, PING)..."
                className="flex-1 bg-[#0D1016] border border-[#374151] text-xs text-blue-400 px-3 py-1.5 rounded outline-none font-mono focus:border-blue-500"
              />
              
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded flex items-center justify-center transition-colors"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
