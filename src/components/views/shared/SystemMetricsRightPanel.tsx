import React from 'react';
import { motion } from 'motion/react';
import { Cylinder, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData, Recipe } from '../../../types/system';

interface SystemMetricsRightPanelProps {
  data: SystemData;
  activeRecipe: Recipe;
  activeMsgTab: 'LOGS' | 'ALERTS';
  setActiveMsgTab: (tab: 'LOGS' | 'ALERTS') => void;
}

export const SystemMetricsRightPanel: React.FC<SystemMetricsRightPanelProps> = ({ 
  data, 
  activeRecipe, 
  activeMsgTab, 
  setActiveMsgTab 
}) => {
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col space-y-3 min-h-0">
      
      {/* Syrup Tank/Kettle Details Panel */}
      <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-1 flex flex-col min-h-0 overflow-hidden shadow-lg">
        <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-orange-500 pl-2 flex items-center">
            <Cylinder size={12} className="mr-2 text-orange-500"/> Şerbet Tankı / Kazan Durumu
        </h2>
        {(() => {
            const maxH = data.config.ultrasonicMaxHeightCm || 100;
            const levelCm = data.tankLevelCm !== undefined ? data.tankLevelCm : 85;
            const liquidH = Math.max(0, maxH - levelCm);
            const liquidP = Math.max(0, Math.min(100, Math.round((liquidH / maxH) * 100)));
            const isCritical = liquidP <= (data.config.ultrasonicCriticalLowPercent || 15);

            return (
                <div className="flex gap-4 mt-2 flex-1 items-stretch min-h-0 overflow-hidden">
                  {/* Visual Tank (Left Side) */}
                  <div className="w-[110px] bg-gradient-to-b from-[#0D1016]/40 to-black/30 border border-gray-700/40 rounded-xl relative overflow-hidden flex flex-col justify-end shadow-inner shrink-0 min-h-[130px]">
                      {/* Fluid liquid */}
                      <div 
                        className={cn(
                            "w-full transition-all duration-500 ease-out relative",
                            isCritical 
                              ? "bg-gradient-to-t from-red-900/50 to-red-500/70" 
                              : "bg-gradient-to-t from-orange-600/50 to-yellow-500/70"
                        )}
                        style={{ height: `${liquidP}%` }}
                      >
                        {/* Wave animation */}
                        <div className="absolute left-0 right-0 -top-1.5 h-3 bg-inherit opacity-45 rounded-full animate-pulse filter blur-[0.5px]"></div>
                        
                        {/* Small bubbles inside tank */}
                        <div className="absolute bottom-4 left-6 w-1 h-1 bg-white/20 rounded-full animate-bounce"></div>
                        <div className="absolute bottom-10 right-10 w-1.5 h-1.5 bg-white/10 rounded-full animate-ping"></div>
                        <div className="absolute bottom-16 left-16 w-0.5 h-0.5 bg-white/30 rounded-full animate-bounce"></div>
                        <div className="absolute bottom-6 right-16 w-1 h-1 bg-white/25 rounded-full animate-bounce"></div>
                      </div>

                      {/* Fluid percent overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black font-mono text-white tracking-tighter drop-shadow-md leading-none">
                            %{liquidP}
                        </span>
                        <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            Doluluk
                        </span>
                        <span className="text-[8px] font-mono text-gray-500 mt-1 font-semibold">
                            {liquidH} cm
                        </span>
                      </div>

                      {/* Critical indicator badge */}
                      {isCritical && (
                        <div className="absolute top-2 left-0 right-0 mx-auto w-16 bg-red-650 text-white text-[6px] font-bold text-center py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-md">
                            DÜŞÜK!
                        </div>
                      )}
                  </div>

                  {/* Parameter details & status (Right Side) */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] border-b border-gray-800/40 pb-0.5">
                            <span className="text-gray-500">Cihaz:</span>
                            <span className="font-mono text-gray-300 truncate max-w-[80px]">
                              {data.config.ultrasonicDevice === 'RASPI' ? 'Pi 5 dahili' : (data.config.ultrasonicDevice || 'Bilinmiyor')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] border-b border-gray-800/40 pb-0.5">
                            <span className="text-gray-500">TRIG/ECHO:</span>
                            <span className="font-mono text-orange-400">
                              {data.config.ultrasonicTrigPin || '-'} / {data.config.ultrasonicEchoPin || '-'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] border-b border-gray-800/40 pb-0.5">
                            <span className="text-gray-500">Mesafe:</span>
                            <span className="font-mono text-gray-300">{levelCm} cm</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] border-b border-gray-800/40 pb-0.5">
                            <span className="text-gray-500">Kazan/Sıvı:</span>
                            <span className="font-mono text-blue-400">{liquidH}/{maxH} cm</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] border-b border-gray-800/40 pb-0.5">
                            <span className="text-gray-500">Filtre:</span>
                            <span className="font-mono text-gray-400">{data.config.ultrasonicDebounceMs || 100} ms</span>
                        </div>
                      </div>

                      <div className={cn(
                        "p-1.5 rounded border text-[8px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-2 text-center",
                        isCritical 
                            ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse" 
                            : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500"
                      )}>
                        {isCritical ? (
                            <><AlertTriangle size={10} /> Kritik Seviye! Blokaj Aktif</>
                        ) : (
                            'Kazan Seviye: Normal'
                        )}
                      </div>
                  </div>
                </div>
            );
        })()}
      </div>
      
      {/* Cycle Metrics & OEE */}
      <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0 shadow-lg">
        <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-blue-500 pl-2 flex items-center justify-between">
            <span>Mevcut Üretim Planı & OEE</span>
        </h2>
        <div className="space-y-1.5 mt-2">
            <div className="flex justify-between items-center text-[10px] border-b border-gray-800/40 pb-1">
              <span className="text-gray-500">Seçili Reçete:</span>
              <span className="font-mono text-white truncate max-w-[220px]">{activeRecipe.name}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] border-b border-gray-800/40 pb-1">
              <span className="text-gray-500">Hedef Şişe:</span>
              <span className="font-mono text-blue-400">{Math.min(activeRecipe.targetCount, data.valves.filter(v=>v.enabled).length)} Adet</span>
            </div>
            
            <div className="flex justify-between items-center pt-2 mt-2 gap-2">
              <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center shadow-inner">
                  <div className="text-[8px] text-gray-500 font-bold mb-1">HIZ (BPM)</div>
                  <div className="text-lg font-mono text-emerald-400 leading-none">
                    {data.cycleHistory.length > 0 ? Math.round((60000 / (data.cycleHistory.slice(0,5).reduce((a,c)=>a+c.duration,0)/Math.min(data.cycleHistory.length,5))) * data.cycleHistory[0].outputCount) : 0}
                  </div>
              </div>
              <div className="flex-1 bg-[#0D1016] border border-[#1F2937] rounded p-2 text-center shadow-inner">
                  <div className="text-[8px] text-gray-500 font-bold mb-1">OEE SKORU</div>
                  <div className={cn("text-lg font-mono leading-none", data.mode === 'ARIZA' ? "text-red-500" : "text-blue-400")}>
                    {(() => {
                        if (data.mode === 'ARIZA') return '0%';
                        if (data.cycleHistory.length === 0) {
                          return data.mode === 'OTOMATİK' ? '95%' : '85%';
                        }
                        const successful = data.cycleHistory.filter(c => c.validationStatus === 'PASS').length;
                        const quality = successful / data.cycleHistory.length;
                        const availability = data.activeAlerts.length > 0 ? 0.85 : 0.98;
                        const performance = 0.96;
                        return `${Math.round(availability * performance * quality * 100)}%`;
                    })()}
                  </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};
