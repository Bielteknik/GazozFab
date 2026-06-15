import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Activity, Droplet, Target, ArrowDownUp, Save, Play, 
  Settings2, RefreshCw, Power, Timer, Info, Lock, Unlock, AlertCircle, Eye, Cpu, ArrowUp, ArrowDown, Wrench, Cylinder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { SystemData, SystemMode, Recipe, SensorState, GateState, SystemConfig } from '../../types/system';

interface ManualControlProps {
  data: SystemData;
  setMode: (mode: SystemMode) => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number, steps?: number, speed?: number) => void;
  toggleValve: (id: number) => void;
  testValvePulse: (id: number, duration: number) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  onUpdateSystemGate: (target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => void;
  onUpdateSensor: (id: string, updates: Partial<SensorState>) => void;
  sendNanoCommand: (nanoId: string, cmd: string) => void;
  onUpdateConfig?: (config: Partial<SystemConfig>) => void;
  onResetGates?: () => void;
}

export const ManualControl: React.FC<ManualControlProps> = ({ 
  data, setMode, operateGate, toggleValve, testValvePulse,
  onUpdateRecipe, onUpdateSystemGate, onUpdateSensor, sendNanoCommand, onUpdateConfig,
  onResetGates
}) => {
  
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'visual' | 'calibration'>('calibration');
  const [calSubTab, setCalSubTab] = useState<'valves' | 'gates' | 'sensors' | 'ultrasonic'>('valves');
  
  const [simulatedDistance, setSimulatedDistance] = useState<number>(
    (data.config.ultrasonicMaxHeightCm || 100) - (data.tankLevelCm || 85)
  );

  // Sync simulated distance with real tankLevelCm when not using manual test
  useEffect(() => {
    if (data.tankLevelCm !== undefined) {
      setSimulatedDistance(Math.max(0, (data.config.ultrasonicMaxHeightCm || 100) - data.tankLevelCm));
    }
  }, [data.tankLevelCm, data.config.ultrasonicMaxHeightCm]);
  
  // States for calibration
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedValveId, setSelectedValveId] = useState<number | null>(null);
  const [testDuration, setTestDuration] = useState(1000);
  const [measuredMl, setMeasuredMl] = useState<number | ''>('');
  const [gateCal, setGateCal] = useState({ target: 'inputGate' as 'inputGate' | 'outputGate', steps: 400, speed: 800 });
  const [lastLoadedTarget, setLastLoadedTarget] = useState<string | null>(null);
  const [sensorCal, setSensorCal] = useState({ id: 'input', debounceMs: 100 });
  const [lastLoadedSensorId, setLastLoadedSensorId] = useState<string | null>(null);

  useEffect(() => {
    const activeGate = data[gateCal.target];
    if (activeGate && lastLoadedTarget !== gateCal.target) {
      setGateCal(prev => ({
        ...prev,
        steps: activeGate.stepsToOpen || 400,
        speed: activeGate.speed || 800
      }));
      setLastLoadedTarget(gateCal.target);
    }
  }, [gateCal.target, data, lastLoadedTarget]);

  // Set initial sensor ID when data.sensors becomes available
  useEffect(() => {
    if (data.sensors?.length && !data.sensors.some(s => s.id === sensorCal.id)) {
      const firstSens = data.sensors[0];
      setSensorCal({
        id: firstSens.id,
        debounceMs: firstSens.debounceMs || 50
      });
      setLastLoadedSensorId(firstSens.id);
    }
  }, [data.sensors, sensorCal.id]);

  // Sync sensorCal with actual sensor settings when selection changes or sensor values update from database
  useEffect(() => {
    const activeSensor = data.sensors?.find(s => s.id === sensorCal.id);
    if (activeSensor && lastLoadedSensorId !== sensorCal.id) {
      setSensorCal(prev => ({
        ...prev,
        debounceMs: activeSensor.debounceMs || 50
      }));
      setLastLoadedSensorId(sensorCal.id);
    }
  }, [sensorCal.id, data.sensors, lastLoadedSensorId]);

  const isManual = data.mode === 'MANUEL';
  const timeLeft = 30; // Static for now

  const selectedRecipe = useMemo(() => 
    data.recipes?.find(r => r.id === selectedRecipeId), 
  [data.recipes, selectedRecipeId]);

  useEffect(() => {
    if (data.recipes?.length && !selectedRecipeId) {
      setSelectedRecipeId(data.recipes[0].id);
    }
    if (data.valves?.length && !selectedValveId) {
      setSelectedValveId(data.valves[0].id);
    }
  }, [data.recipes, data.valves]);

  useEffect(() => {
    if (selectedRecipe) {
      setTestDuration(selectedRecipe.fillTimeMs || 1000);
    }
  }, [selectedRecipe]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') {
      setIsAuthorized(true);
    } else {
      alert('Hatalı Şifre!');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0B0D11]">
        <div className="w-full max-w-md p-8 bg-[#151921] border border-[#2D333F] rounded-2xl shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto border border-orange-500/20 mb-4">
              <Shield className="text-orange-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight italic">Yetkili Girişi</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Gelişmiş Manuel Kontrol Erişimi</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-[#0D1016] border border-[#2D333F] rounded-xl p-4 text-center text-2xl tracking-[0.5em] focus:border-orange-500 outline-none text-white transition-all"
              autoFocus
            />
            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 uppercase text-xs tracking-widest">
              Sisteme Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1C2029] border border-[#374151] p-3 rounded shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-orange-500/10 rounded border border-orange-500/20">
            <Wrench className="text-orange-500" size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-200 tracking-tight uppercase">Kalibrasyon Merkezi</h2>
            <p className="text-[10px] text-gray-500">Sistem sensörlerini, kapıları, vanaları test edin ve kalibre edin.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black/20 border border-gray-800 rounded">
              <Timer size={12} className="text-orange-500" />
              <span className="text-[10px] font-mono font-bold text-orange-400">{timeLeft} DK KALDI</span>
           </div>
           <button 
              onClick={() => setMode(isManual ? 'BEKLEMEDE' : 'MANUEL')}
              className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold rounded shadow-lg shadow-orange-900/20 transition-all active:scale-95"
           >
              <Power size={14} />
              {isManual ? 'MANUEL MOD AKTİF' : 'MANUEL MODA GEÇ'}
           </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex space-x-1 border-b border-[#2D333F] shrink-0">
        <button
          onClick={() => setSelectedTab('calibration')}
          className={cn(
            "flex items-center space-x-2 px-6 py-2.5 text-[10px] font-bold transition-all border-b-2",
            selectedTab === 'calibration' 
              ? "border-orange-500 text-orange-400 bg-orange-500/5" 
              : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          <Settings2 size={14} />
          <span>CİHAZ KALİBRASYONLARI</span>
        </button>
        <button
          onClick={() => setSelectedTab('visual')}
          className={cn(
            "flex items-center space-x-2 px-6 py-2.5 text-[10px] font-bold transition-all border-b-2",
            selectedTab === 'visual' 
              ? "border-orange-500 text-orange-400 bg-orange-500/5" 
              : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          <Activity size={14} />
          <span>MANUEL KONTROL & AKIŞ</span>
        </button>
      </div>

      {!isManual ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-[#1C2029] rounded-full flex items-center justify-center mx-auto border border-dashed border-gray-700">
              <AlertCircle className="text-gray-600" size={24} />
            </div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Lütfen manuel modu aktif hale getirin</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden relative pb-4">
          <AnimatePresence mode="wait">
            {selectedTab === 'visual' ? (
              <motion.div 
                key="visual"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="h-full grid grid-cols-12 gap-4"
              >
                {/* Visual Flow (Left) */}
                <div className="col-span-12 lg:col-span-9 bg-[#151921] border border-[#2D333F] rounded p-6 flex flex-col relative overflow-hidden">
                   <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-orange-500" />
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sistem Akış Görünümü</h3>
                      </div>
                      <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-bold text-emerald-500 tracking-widest">LIVE</div>
                   </div>

                   <div className="flex-1 flex flex-col items-center justify-center relative">
                      <div className="w-full max-w-4xl h-24 bg-gradient-to-r from-gray-800/5 via-gray-800/15 to-gray-800/5 rounded-full border border-gray-800/20 flex items-center px-12 relative">
                         {/* Laser Sensors */}
                         <div className="absolute left-10 -top-8 flex flex-col items-center">
                            <div className={cn("w-2 h-2 rounded-full mb-1 transition-all duration-300", data.inputCount > 0 ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-gray-800")} />
                            <span className="text-[7px] text-gray-600 font-bold uppercase tracking-tighter">Giriş Lazer</span>
                         </div>

                         <div className="flex-1 flex justify-center gap-8">
                            {data.valves.map((v, i) => (
                               <div key={v.id} className="flex flex-col items-center gap-3 group">
                                  <div className={cn(
                                     "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300",
                                     v.isOpen ? "bg-blue-600/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-gray-800/20 border-gray-800"
                                  )}>
                                     <Droplet size={16} className={v.isOpen ? "text-blue-400" : "text-gray-700 group-hover:text-gray-600"} />
                                     {v.isOpen && (
                                       <div className="absolute -bottom-10 w-0.5 h-10 bg-gradient-to-b from-blue-500/50 to-transparent animate-pulse" />
                                     )}
                                  </div>
                                  <span className="text-[9px] font-mono text-gray-600 font-bold">{i + 1}</span>
                               </div>
                            ))}
                         </div>

                         <div className="absolute right-10 -top-8 flex flex-col items-center">
                            <div className={cn("w-2 h-2 rounded-full mb-1 transition-all duration-300", data.outputCount > 0 ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-gray-800")} />
                            <span className="text-[7px] text-gray-600 font-bold uppercase tracking-tighter">Çıkış Lazer</span>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#2D333F]">
                      {[
                        { label: 'GİRİŞ KAPISI', val: data.inputGate.isOpen ? 'AÇIK' : 'KAPALI', color: data.inputGate.isOpen ? 'text-emerald-500' : 'text-gray-600' },
                        { label: 'ÇIKIŞ KAPISI', val: data.outputGate.isOpen ? 'AÇIK' : 'KAPALI', color: data.outputGate.isOpen ? 'text-emerald-500' : 'text-gray-600' },
                        { label: 'SERİ BAĞLANTI', val: 'CONNECTED', color: 'text-blue-500' },
                        { label: 'HATA DURUMU', val: 'HATA YOK', color: 'text-emerald-500' }
                      ].map((s, idx) => (
                        <div key={idx} className="bg-black/20 p-3 rounded border border-gray-800/50">
                           <div className="text-[8px] text-gray-600 font-bold uppercase mb-1">{s.label}</div>
                           <div className={cn("text-[10px] font-bold tracking-tight", s.color)}>{s.val}</div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Quick Controls (Right) */}
                <div className="col-span-12 lg:col-span-3 space-y-4">
                   <div className="bg-[#151921] border border-[#2D333F] rounded p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Droplet size={12} className="text-blue-500" />
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manuel Vana</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {data.valves.map((v, i) => (
                          <button
                            key={v.id}
                            onClick={() => toggleValve(v.id)}
                            className={cn(
                              "p-3 rounded border text-[10px] font-bold transition-all active:scale-95",
                              v.isOpen ? "bg-blue-600 border-blue-400 text-white shadow-lg" : "bg-[#0D1117] border-gray-800 text-gray-600 hover:border-gray-700"
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="bg-[#151921] border border-[#2D333F] rounded p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Target size={12} className="text-orange-500" />
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manuel Kapı</h4>
                      </div>
                      <div className="space-y-2">
                         <button
                           onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 400)}
                           className={cn(
                             "w-full flex items-center justify-between p-3 rounded border text-[10px] font-bold transition-all active:scale-95",
                             data.inputGate.isOpen ? "bg-emerald-900/10 border-emerald-500/30 text-emerald-500" : "bg-[#0D1117] border-gray-800 text-gray-600"
                           )}
                         >
                           GİRİŞ KAPISI {data.inputGate.isOpen ? <Unlock size={12}/> : <Lock size={12}/>}
                         </button>
                         <button
                           onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 400)}
                           className={cn(
                             "w-full flex items-center justify-between p-3 rounded border text-[10px] font-bold transition-all active:scale-95",
                             data.outputGate.isOpen ? "bg-emerald-900/10 border-emerald-500/30 text-emerald-500" : "bg-[#0D1117] border-gray-800 text-gray-600"
                           )}
                         >
                           ÇIKIŞ KAPISI {data.outputGate.isOpen ? <Unlock size={12}/> : <Lock size={12}/>}
                         </button>
                         <button
                            onClick={() => onResetGates?.()}
                            className="w-full flex items-center justify-between p-3 rounded border text-[10px] font-bold transition-all active:scale-95 bg-orange-600/10 border-orange-500/30 text-orange-500 hover:bg-orange-600/20"
                          >
                            LİMİTLERİ OKU / SIFIRLA <RefreshCw size={12} />
                          </button>
                      </div>
                   </div>

                   <div className="bg-orange-500/5 border border-orange-500/10 rounded p-4">
                      <p className="text-[9px] text-orange-300/60 leading-relaxed italic">
                        * Butonlara tıklandığında ilgili donanım anında tepki verir. Dikkatli kullanın.
                      </p>
                   </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                 key="calibration"
                 initial={{ opacity: 0, x: 10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -10 }}
                 className="h-full flex flex-col space-y-4"
              >
                 {/* Sub Navigation */}
                 <div className="flex items-center gap-4 bg-[#151921]/50 p-2 rounded border border-[#2D333F] shrink-0">
                    {[
                      { id: 'valves', label: 'VALF TESTİ', icon: Droplet },
                      { id: 'gates', label: 'KAPI AYARI', icon: ArrowDownUp },
                      { id: 'sensors', label: 'SENSÖR TUNING', icon: Eye },
                      { id: 'ultrasonic', label: 'SEVİYE SENSÖRÜ', icon: Cylinder }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setCalSubTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-1.5 rounded text-[9px] font-bold transition-all",
                          calSubTab === tab.id 
                            ? "bg-[#1C2029] text-gray-100 shadow-sm border border-[#374151]" 
                            : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        <tab.icon size={12} />
                        {tab.label}
                      </button>
                    ))}
                 </div>

                 <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
                    <div className="flex-1 bg-[#151921] border border-[#2D333F] rounded flex flex-col overflow-hidden">
                       <div className="p-3 border-b border-[#2D333F] flex items-center bg-[#1C2029]">
                          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                             <Settings2 size={12} className="mr-2 text-orange-500" /> 
                             {calSubTab === 'valves' && "Hassas Valf Kalibrasyonu"}
                             {calSubTab === 'gates' && "Kapı Kalibrasyon Merkezi"}
                             {calSubTab === 'sensors' && "Sensör Hassasiyet Ayarı"}
                             {calSubTab === 'ultrasonic' && "Ultrasonik Seviye Sensör Kalibrasyonu"}
                          </h3>
                       </div>

                       <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                          {calSubTab === 'valves' && (
                            <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
                               <div className="grid grid-cols-2 gap-8">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">1. Reçete Seçimi</label>
                                    <select 
                                      value={selectedRecipeId || ''}
                                      onChange={(e) => setSelectedRecipeId(e.target.value)}
                                      className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50"
                                    >
                                      {(data.recipes || []).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">2. Test Edilecek Vana</label>
                                    <select 
                                      value={selectedValveId || ''}
                                      onChange={(e) => setSelectedValveId(Number(e.target.value))}
                                      className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50"
                                    >
                                      {(data.valves || []).filter(v => v.enabled).map(v => (
                                        <option key={v.id} value={v.id}>{v.name || `Vana ${v.id}`}</option>
                                      ))}
                                    </select>
                                  </div>
                               </div>

                               <div className="pt-6 border-t border-[#2D333F] space-y-6">
                                  <div className="flex items-center justify-between">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">3. Test Süresi (ms)</label>
                                     <div className="flex gap-1.5">
                                        {[500, 1000, 1500, 2000, 3000].map(ms => (
                                          <button 
                                            key={ms}
                                            onClick={() => setTestDuration(ms)}
                                            className={cn("px-2 py-1 rounded text-[9px] font-bold transition-all border", testDuration === ms ? "bg-orange-500/10 border-orange-500 text-orange-400" : "bg-transparent border-gray-800 text-gray-600 hover:border-gray-700")}
                                          >
                                            {ms}ms
                                          </button>
                                        ))}
                                     </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                     <div className="relative flex-1">
                                        <input 
                                          type="number"
                                          value={testDuration}
                                          onChange={(e) => setTestDuration(Number(e.target.value))}
                                          className="w-full bg-[#0D1016] border border-[#374151] rounded px-4 py-3 text-xl font-mono text-orange-400 font-black outline-none focus:border-orange-500/50"
                                        />
                                     </div>
                                     
                                     <div className="flex gap-2">
                                        <button 
                                          disabled={!selectedValveId}
                                          onClick={() => selectedValveId && testValvePulse(selectedValveId, testDuration)}
                                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white text-[10px] font-bold rounded shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all active:scale-95"
                                        >
                                          <Play size={14} /> TEST ET
                                        </button>
                                        <button 
                                          disabled={!selectedRecipeId || testDuration === selectedRecipe?.fillTimeMs}
                                          onClick={() => selectedRecipeId && onUpdateRecipe(selectedRecipeId, { fillTimeMs: testDuration })}
                                          className="px-6 py-3 border border-emerald-600/50 bg-emerald-900/10 hover:bg-emerald-800/20 text-emerald-500 text-[10px] font-bold rounded flex items-center gap-2 transition-all active:scale-95"
                                        >
                                          <RefreshCw size={14} /> GÜNCELLE
                                        </button>
                                     </div>
                                  </div>
                               </div>

                               {/* Akış Hızı Kalibrasyon Hesaplayıcı */}
                               <div className="pt-6 border-t border-[#2D333F] space-y-4">
                                  <div className="flex items-center gap-2">
                                     <Droplet size={14} className="text-orange-500" />
                                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Akış Hızı Kalibrasyon Hesaplayıcı</h4>
                                  </div>
                                  
                                  <div className="bg-[#1C2029]/30 p-4 border border-[#2D333F] rounded space-y-4">
                                     <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                           <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">4. Ölçülen Sıvı Miktarı (ml)</label>
                                           <input 
                                              type="number"
                                              value={measuredMl}
                                              onChange={(e) => setMeasuredMl(e.target.value === '' ? '' : Number(e.target.value))}
                                              placeholder="Örn: 5"
                                              className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-orange-400 outline-none focus:border-orange-500/50 font-mono"
                                           />
                                        </div>
                                        <div className="space-y-2">
                                           <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Hesaplanan Akış Hızı</label>
                                           <div className="h-8 flex items-center">
                                              {measuredMl !== '' && Number(measuredMl) > 0 ? (
                                                 <span className="text-xs font-mono font-bold text-emerald-400">
                                                    {(Number(measuredMl) / testDuration).toFixed(5)} ml/ms <span className="text-gray-500">({((Number(measuredMl) / testDuration) * 1000).toFixed(1)} ml/sn)</span>
                                                 </span>
                                              ) : (
                                                 <span className="text-xs text-gray-600 font-bold italic">Süre ve sıvı miktarı bekleniyor...</span>
                                              )}
                                           </div>
                                        </div>
                                     </div>

                                     {measuredMl !== '' && Number(measuredMl) > 0 && selectedRecipe && (
                                        <div className="pt-4 border-t border-[#2D333F]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                           <div className="space-y-1">
                                              <div className="text-[9px] font-bold text-gray-500 uppercase">Önerilen Reçete Süresi ({selectedRecipe.name})</div>
                                              <div className="text-xs font-bold text-gray-200">
                                                 Hedef Hacim: <span className="text-orange-400">{selectedRecipe.volumeMl} ml</span> | Hesaplanan Süre: <span className="text-blue-400">{Math.round(selectedRecipe.volumeMl / (Number(measuredMl) / testDuration))} ms</span>
                                              </div>
                                           </div>
                                           <button
                                              onClick={() => {
                                                 const flowRate = Number(measuredMl) / testDuration;
                                                 const calculatedDuration = Math.round(selectedRecipe.volumeMl / flowRate);
                                                 const currentValveDurations = selectedRecipe.valveDurations || {};
                                                 const updatedDurations = {
                                                    ...currentValveDurations,
                                                    [selectedValveId || 0]: calculatedDuration
                                                 };
                                                 onUpdateRecipe(selectedRecipe.id, { valveDurations: updatedDurations });
                                                 const targetValve = data.valves.find(v => v.id === selectedValveId);
                                                 const valveName = targetValve ? targetValve.name : `Vana ${selectedValveId}`;
                                                 alert(`${valveName} için ${calculatedDuration} ms süresi '${selectedRecipe.name}' reçetesine kaydedildi!`);
                                              }}
                                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded flex items-center gap-1.5 transition-all active:scale-95"
                                           >
                                              <Save size={12} /> REÇETEYE UYGULA
                                           </button>
                                        </div>
                                     )}
                                  </div>
                               </div>
                            </div>
                          )}

                          {calSubTab === 'gates' && (
                            <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
                               <div className="grid grid-cols-2 gap-8">
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">1. Hedef Kapı</label>
                                     <div className="flex gap-1 bg-[#0D1016] p-1 rounded border border-[#374151]">
                                        <button 
                                          onClick={() => { setGateCal(prev => ({ ...prev, target: 'inputGate' })); setLastLoadedTarget(null); }}
                                          className={cn("flex-1 py-1.5 text-[9px] font-bold rounded transition-all", gateCal.target === 'inputGate' ? "bg-[#1C2029] text-gray-100 shadow-sm border border-[#374151]" : "text-gray-500 hover:text-gray-400")}
                                        >GİRİŞ KAPISI</button>
                                        <button 
                                          onClick={() => { setGateCal(prev => ({ ...prev, target: 'outputGate' })); setLastLoadedTarget(null); }}
                                          className={cn("flex-1 py-1.5 text-[9px] font-bold rounded transition-all", gateCal.target === 'outputGate' ? "bg-[#1C2029] text-gray-100 shadow-sm border border-[#374151]" : "text-gray-500 hover:text-gray-400")}
                                        >ÇIKIŞ KAPISI</button>
                                     </div>
                                  </div>
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">2. Kalibrasyon Adımı</label>
                                     <input 
                                       type="number"
                                       value={gateCal.steps}
                                       onChange={(e) => setGateCal(prev => ({ ...prev, steps: Number(e.target.value) }))}
                                       className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                     />
                                  </div>
                               </div>

                               <div className="pt-6 border-t border-[#2D333F] space-y-6">
                                  <div className="grid grid-cols-2 gap-8">
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">3. Motor Hızı (Gecikme ms)</label>
                                        <div className="flex gap-4 items-center">
                                           <input 
                                             type="range"
                                             min="200"
                                             max="2000"
                                             step="50"
                                             value={gateCal.speed}
                                             onChange={(e) => setGateCal(prev => ({ ...prev, speed: Number(e.target.value) }))}
                                             className="flex-1 accent-orange-500 h-1.5 bg-[#0D1016] rounded-lg appearance-none cursor-pointer"
                                           />
                                           <span className="text-[10px] font-mono text-orange-400 w-12">{gateCal.speed}µs</span>
                                           <button 
                                              onClick={() => sendNanoCommand('GatesNano', `s${gateCal.speed}`)}
                                              className="p-1.5 bg-[#1C2029] hover:bg-[#2D333F] border border-[#374151] rounded text-gray-400 transition-all"
                                              title="Hızı Uygula"
                                           >
                                              <RefreshCw size={12} />
                                           </button>
                                        </div>
                                     </div>

                                     <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">4. Manuel Hareket Testi</label>
                                        <div className="flex gap-2">
                                           <button 
                                              onClick={() => operateGate(gateCal.target, -Number(gateCal.steps), Number(gateCal.steps), Number(gateCal.speed))}
                                              className="flex-1 py-2.5 bg-[#0D1016] hover:bg-[#1C2029] border border-[#374151] text-gray-300 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all active:scale-95"
                                           >
                                              <ArrowUp size={12} /> KAPAT
                                           </button>
                                           <button 
                                              onClick={() => operateGate(gateCal.target, Number(gateCal.steps), Number(gateCal.steps), Number(gateCal.speed))}
                                              className="flex-1 py-2.5 bg-[#0D1016] hover:bg-[#1C2029] border border-[#374151] text-gray-300 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all active:scale-95"
                                           >
                                              <ArrowDown size={12} /> AÇ
                                           </button>
                                        </div>
                                     </div>
                                     
                                     <div className="flex items-end">
                                        <button 
                                          onClick={() => onUpdateSystemGate(gateCal.target, { stepsToOpen: gateCal.steps, stepsToClose: gateCal.steps, speed: gateCal.speed })}
                                          className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold rounded shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                           <Save size={12} /> KAYDET
                                        </button>
                                     </div>
                                  </div>
                               </div>
                            </div>
                          )}

                          {calSubTab === 'sensors' && (
                            <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
                               <div className="grid grid-cols-2 gap-8">
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">1. Sensör Seçimi</label>
                                     <select 
                                        value={sensorCal.id}
                                        onChange={(e) => setSensorCal(prev => ({ ...prev, id: e.target.value }))}
                                        className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50"
                                     >
                                        {data.sensors.map(s => (
                                           <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                     </select>
                                  </div>
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">2. Gecikme Süresi (Debounce ms)</label>
                                     <input 
                                       type="number"
                                       value={sensorCal.debounceMs}
                                       onChange={(e) => setSensorCal(prev => ({ ...prev, debounceMs: Number(e.target.value) }))}
                                       className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                     />
                                  </div>
                               </div>

                               <div className="pt-6 border-t border-[#2D333F] flex justify-end">
                                  <button 
                                     onClick={() => onUpdateSensor(sensorCal.id, { debounceMs: sensorCal.debounceMs })}
                                     className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold rounded shadow-lg shadow-emerald-900/10 flex items-center gap-2 transition-all active:scale-95"
                                  >
                                     <Save size={12} /> HASSASİYETİ KAYDET
                                  </button>
                               </div>
                            </div>
                          )}

                          {calSubTab === 'ultrasonic' && (
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
                                {/* Left Side: Configuration Controls */}
                                <div className="space-y-4">
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">1. Bağlı Olduğu Donanım (Controller)</label>
                                      <select 
                                         value={data.config.ultrasonicDevice || 'RASPI'}
                                         onChange={(e) => onUpdateConfig?.({ ultrasonicDevice: e.target.value })}
                                         className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50"
                                      >
                                         <option value="RASPI">Raspberry Pi 5 (Dahili GPIO)</option>
                                         {data.nanos.map(n => (
                                            <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
                                         ))}
                                      </select>
                                   </div>

                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">2. TRIG PİN</label>
                                         <input 
                                            type="text"
                                            value={data.config.ultrasonicTrigPin || ''}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicTrigPin: e.target.value })}
                                            placeholder="Örn: 23, D6"
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-orange-400 outline-none focus:border-orange-500/50"
                                         />
                                      </div>
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">3. ECHO PİN</label>
                                         <input 
                                            type="text"
                                            value={data.config.ultrasonicEchoPin || ''}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicEchoPin: e.target.value })}
                                            placeholder="Örn: 24, D7"
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs font-mono text-orange-400 outline-none focus:border-orange-500/50"
                                         />
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-3 gap-4">
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">4. Tank Boyu (cm)</label>
                                         <input 
                                            type="number"
                                            value={data.config.ultrasonicMaxHeightCm || 100}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicMaxHeightCm: Number(e.target.value) })}
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                         />
                                      </div>
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">5. Kritik Alt Limit (%)</label>
                                         <input 
                                            type="number"
                                            value={data.config.ultrasonicCriticalLowPercent || 15}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicCriticalLowPercent: Number(e.target.value) })}
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                         />
                                      </div>
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">6. Filtre Gecikmesi (ms)</label>
                                         <input 
                                            type="number"
                                            value={data.config.ultrasonicDebounceMs || 100}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicDebounceMs: Number(e.target.value) })}
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                         />
                                      </div>
                                    </div>

                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">7. Ölçüm Yöntemi</label>
                                         <select 
                                            value={data.config.ultrasonicMeasurementType || 'CONTINUOUS'}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicMeasurementType: e.target.value as any })}
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50"
                                         >
                                            <option value="CONTINUOUS">Sürekli (Anlık) Ölçüm</option>
                                            <option value="CYCLE">Döngü Sonrası (Her Döngü Bitişinde)</option>
                                            <option value="CONSUMPTION">Hacim Tüketimine Göre (ml)</option>
                                         </select>
                                      </div>
                                      <div className="space-y-1">
                                         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">8. Ölçüm Hacim Eşiği (ml)</label>
                                         <input 
                                            type="number"
                                            value={data.config.ultrasonicMeasurementIntervalMl || 2000}
                                            onChange={(e) => onUpdateConfig?.({ ultrasonicMeasurementIntervalMl: Number(e.target.value) })}
                                            disabled={data.config.ultrasonicMeasurementType !== 'CONSUMPTION'}
                                            className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono disabled:opacity-30"
                                            placeholder="Örn: 2000"
                                         />
                                      </div>
                                   </div>

                                   <div className="border-t border-[#2D333F] pt-4 my-2 space-y-4">
                                       <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Periyodik Ölçüm & Röle Kontrol Ayarları</div>
                                       
                                       <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1">
                                             <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Ölçüm Sıklığı (Dakika)</label>
                                             <input 
                                                type="number"
                                                value={data.config.ultrasonicIntervalMin || 3}
                                                onChange={(e) => onUpdateConfig?.({ ultrasonicIntervalMin: Number(e.target.value) })}
                                                className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                                min="1"
                                             />
                                          </div>
                                          <div className="space-y-1">
                                             <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sınır Mesafe (cm)</label>
                                             <input 
                                                type="number"
                                                value={data.config.ultrasonicThresholdCm || 30}
                                                onChange={(e) => onUpdateConfig?.({ ultrasonicThresholdCm: Number(e.target.value) })}
                                                className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                                min="1"
                                             />
                                          </div>
                                       </div>

                                       <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1">
                                             <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">GatesNano Röle Pini</label>
                                             <input 
                                                type="text"
                                                value={data.config.ultrasonicRelayPin || '11'}
                                                onChange={(e) => onUpdateConfig?.({ ultrasonicRelayPin: e.target.value })}
                                                placeholder="Örn: 11, D11"
                                                className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-orange-400 outline-none focus:border-orange-500/50 font-mono"
                                             />
                                          </div>
                                          <div className="space-y-1">
                                             <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Röle Açık Kalma Süresi (ms)</label>
                                             <input 
                                                type="number"
                                                value={data.config.ultrasonicRelayDurationMs || 5000}
                                                onChange={(e) => onUpdateConfig?.({ ultrasonicRelayDurationMs: Number(e.target.value) })}
                                                className="w-full bg-[#0D1016] border border-[#374151] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-orange-500/50 font-mono"
                                                min="100"
                                                step="100"
                                             />
                                          </div>
                                       </div>
                                    </div>

                                   <div className="bg-[#1C2029]/50 p-4 border border-[#2D333F] rounded space-y-3">
                                      <div className="flex items-center justify-between">
                                         <div className="text-[10px] font-bold text-gray-400 uppercase">Şerbet Tankı Kalibrasyon & Seviye Görünümü</div>
                                         <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded text-[8px] font-bold tracking-widest">TEST / OKUMA</span>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="flex justify-between">
                                            <span className="text-[9px] text-gray-500">Okunan Mesafe (Sensörden Uzaklık)</span>
                                            <span className="text-[9px] font-mono font-bold text-orange-400">{simulatedDistance} cm</span>
                                         </div>
                                         <input 
                                            type="range"
                                            min="0"
                                            max={data.config.ultrasonicMaxHeightCm || 100}
                                            value={simulatedDistance}
                                            onChange={(e) => setSimulatedDistance(Number(e.target.value))}
                                            className="w-full accent-orange-500 h-1 bg-[#0D1016] rounded-lg appearance-none cursor-pointer"
                                         />
                                      </div>
                                      <p className="text-[8px] text-gray-600 leading-normal italic">
                                         * Bu sürgü, fiziksel ultrasonik sensörün tank tavanından sıvı yüzeyine olan mesafesini kalibre etmek veya test etmek için kullanılır. Sıvı yüksekliği arttıkça okunan mesafe düşer.
                                      </p>
                                   </div>
                                </div>

                                {/* Right Side: Visual Tank Simulator */}
                                <div className="flex flex-col items-center justify-center bg-black/10 border border-gray-800/40 rounded p-6 relative overflow-hidden min-h-[300px]">
                                   {(() => {
                                      const maxHeight = data.config.ultrasonicMaxHeightCm || 100;
                                      const critPercent = data.config.ultrasonicCriticalLowPercent || 15;
                                      const liquidH = Math.max(0, maxHeight - simulatedDistance);
                                      const liquidP = Math.max(0, Math.min(100, Math.round((liquidH / maxHeight) * 100)));
                                      const isCritical = liquidP <= critPercent;

                                      return (
                                         <div className="w-full flex flex-col items-center gap-6 z-10">
                                            {/* Tank Cylinder Wrapper */}
                                            <div className="w-52 h-60 bg-gradient-to-b from-[#1C2029]/80 to-[#0D1016]/90 border-2 border-gray-700/60 rounded-3xl relative overflow-hidden flex flex-col justify-end shadow-2xl backdrop-blur-sm">
                                               {/* Waving fluid simulation with gradient */}
                                               <div 
                                                  className={cn(
                                                     "w-full transition-all duration-500 ease-out relative",
                                                     isCritical 
                                                        ? "bg-gradient-to-t from-red-900/60 to-red-500/80" 
                                                        : "bg-gradient-to-t from-blue-900/60 to-cyan-500/80"
                                                  )}
                                                  style={{ height: `${liquidP}%` }}
                                               >
                                                  {/* Wave shape overlays for animations */}
                                                  <div className="absolute left-0 right-0 -top-2 h-4 bg-inherit opacity-40 rounded-full animate-pulse filter blur-[1px]"></div>
                                                  
                                                  {/* Floating bubbles inside the fluid */}
                                                  <div className="absolute bottom-2 left-8 w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"></div>
                                                  <div className="absolute bottom-10 right-14 w-2 h-2 bg-white/20 rounded-full animate-ping"></div>
                                                  <div className="absolute bottom-20 left-16 w-1 h-1 bg-white/15 rounded-full animate-bounce"></div>
                                                  <div className="absolute bottom-6 right-20 w-1.5 h-1.5 bg-white/25 rounded-full animate-bounce"></div>
                                               </div>

                                               {/* Tank Level Overlay Stats */}
                                               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                  <span className="text-2xl font-black font-mono text-white tracking-tighter drop-shadow-md">
                                                     %{liquidP}
                                                  </span>
                                                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest drop-shadow">
                                                     Sıvı Seviyesi
                                                  </span>
                                                  <span className="text-[10px] font-mono text-gray-300 mt-2 font-bold drop-shadow">
                                                     {liquidH} cm / {maxHeight} cm
                                                  </span>
                                               </div>

                                               {/* Critical Alarm Blinking Badge */}
                                               {isCritical && (
                                                  <div className="absolute top-4 left-0 right-0 mx-auto w-24 bg-red-600/95 text-white border border-red-500/30 text-[8px] font-black text-center py-1 rounded-full uppercase tracking-wider animate-bounce shadow-lg shadow-red-900/35">
                                                     Kritik Seviye!
                                                  </div>
                                               )}
                                            </div>

                                            {/* Mini parameters readback */}
                                            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                                               <div className="bg-[#0D1016] border border-gray-800 p-2 rounded text-center">
                                                  <div className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">Sıvı Yüksekliği</div>
                                                  <div className="text-xs font-mono font-bold text-blue-400">{liquidH} cm</div>
                                               </div>
                                               <div className="bg-[#0D1016] border border-gray-800 p-2 rounded text-center">
                                                  <div className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">Kritik Sınır</div>
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
                          )}
                       </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="w-full md:w-1/4 flex flex-col gap-4 shrink-0">
                       <div className="bg-[#151921] border border-[#2D333F] rounded p-4 space-y-4">
                          <div className="flex items-center gap-2 border-b border-[#2D333F] pb-2">
                             <Info size={12} className="text-orange-500" />
                             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kalibrasyon Kılavuzu</h4>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-relaxed italic">
                             {calSubTab === 'valves' && "1000ms test yapıp sıvıyı tartın. 250ml için 240ml gelirse süreyi %4 artırın."}
                             {calSubTab === 'gates' && "Kapıyı önce manuel hareketle tam açın. Doğru mesafeyi bulduğunuzda adımı kaydedin."}
                             {calSubTab === 'sensors' && "Hızlı geçişlerde süreyi düşürün (50ms). Çift sayım varsa süreyi artırın."}
                             {calSubTab === 'ultrasonic' && "Tank yüksekliğini cm olarak ölçün. Sensörün tavan payını da hesaba katıp üst limit değerini yazın. Kritik limitin altındaki seviyelerde üretim otomatik olarak durdurulacaktır."}
                          </p>
                       </div>
                       
                       <div className="bg-blue-500/5 border border-blue-500/10 rounded p-4">
                          <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Shield size={12} /> Sistem Güvenliği
                          </h4>
                          <p className="text-[9px] text-blue-300/60 leading-relaxed">
                             Kalibrasyon sırasında makineyi manuel modda tutun. Tüm değişiklikler veritabanına kalıcı olarak işlenir.
                          </p>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
