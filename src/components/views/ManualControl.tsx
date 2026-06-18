import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Activity, Droplet, Target, ArrowDownUp, Save, Play, 
  Settings2, RefreshCw, Power, Timer, Info, Lock, Unlock, AlertCircle, Eye, Cpu, ArrowUp, ArrowDown, Wrench, Cylinder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { SystemData, SystemMode, Recipe, SensorState, GateState, SystemConfig } from '../../types/system';
import { ManualCalibrationValves } from './manual/ManualCalibrationValves';
import { ManualCalibrationGates } from './manual/ManualCalibrationGates';
import { ManualCalibrationSensors } from './manual/ManualCalibrationSensors';
import { ManualCalibrationUltrasonic } from './manual/ManualCalibrationUltrasonic';

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
  onTriggerManualUltrasonic?: () => void;
}

export const ManualControl: React.FC<ManualControlProps> = ({ 
  data, setMode, operateGate, toggleValve, testValvePulse,
  onUpdateRecipe, onUpdateSystemGate, onUpdateSensor, sendNanoCommand, onUpdateConfig,
  onResetGates, onTriggerManualUltrasonic
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
                             <ManualCalibrationValves
                               data={data}
                               selectedRecipeId={selectedRecipeId}
                               setSelectedRecipeId={setSelectedRecipeId}
                               selectedValveId={selectedValveId}
                               setSelectedValveId={setSelectedValveId}
                               testDuration={testDuration}
                               setTestDuration={setTestDuration}
                               testValvePulse={testValvePulse}
                               onUpdateRecipe={onUpdateRecipe}
                               measuredMl={measuredMl}
                               setMeasuredMl={setMeasuredMl}
                               selectedRecipe={selectedRecipe}
                             />
                          )}

                          {calSubTab === 'gates' && (
                             <ManualCalibrationGates
                               gateCal={gateCal}
                               setGateCal={setGateCal}
                               setLastLoadedTarget={setLastLoadedTarget}
                               sendNanoCommand={sendNanoCommand}
                               operateGate={operateGate}
                               onUpdateSystemGate={onUpdateSystemGate}
                             />
                          )}

                          {calSubTab === 'sensors' && (
                             <ManualCalibrationSensors
                               data={data}
                               sensorCal={sensorCal}
                               setSensorCal={setSensorCal}
                               onUpdateSensor={onUpdateSensor}
                             />
                          )}

                          {calSubTab === 'ultrasonic' && (
                             <ManualCalibrationUltrasonic
                               data={data}
                               onUpdateConfig={onUpdateConfig}
                               simulatedDistance={simulatedDistance}
                               setSimulatedDistance={setSimulatedDistance}
                               onTriggerManualUltrasonic={onTriggerManualUltrasonic}
                             />
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
