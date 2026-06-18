import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData, SystemConfig } from '../../../types/system';

interface ManualCalibrationUltrasonicProps {
  data: SystemData;
  onUpdateConfig?: (config: Partial<SystemConfig>) => void;
  simulatedDistance: number;
  setSimulatedDistance: (dist: number) => void;
  onTriggerManualUltrasonic?: () => void;
}

export const ManualCalibrationUltrasonic: React.FC<ManualCalibrationUltrasonicProps> = ({
  data,
  onUpdateConfig,
  simulatedDistance,
  setSimulatedDistance,
  onTriggerManualUltrasonic
}) => {
  return (
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

             <div className="border-t border-[#2D333F] pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[9px]">
                   <span className="text-gray-500">Fiziksel Sensör Son Değeri:</span>
                   <span className="font-mono font-bold text-blue-400">{data.tankLevelCm ?? '-'} cm</span>
                </div>
                <button
                   type="button"
                   onClick={() => onTriggerManualUltrasonic?.()}
                   className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20"
                >
                   <RefreshCw size={12} />
                   Fiziksel Sensör Testi Başlat (10 Okuma)
                </button>
             </div>
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
  );
};
