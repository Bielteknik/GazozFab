import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SystemData, Recipe } from '../../types/system';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, RefreshCcw, ShieldAlert, Cpu, AlertTriangle, Unlock, Shield, Target, RefreshCw, Lock, Droplet, History, ArrowUp, ArrowDown, Cylinder } from 'lucide-react';
import { RecipeSelector } from './shared/RecipeSelector';
import { SystemMetricsRightPanel } from './shared/SystemMetricsRightPanel';
import { TerminalTabsPanel } from './shared/TerminalTabsPanel';
import { cn } from '../../lib/utils';

interface DashboardProps {
  data: SystemData;
  onStart: () => void;
  onStop: () => void;
  onStartWashing: () => void;
  onStopWashing: () => void;
  onResetCounter: (target: 'input' | 'output', op?: 'inc' | 'dec' | 'reset') => void;
  onSelectRecipe: (id: string) => void;
  onAnswerPrompt: (answer: boolean) => void;
  onStopAfterCycle: () => void;
  onStartFlush: () => void;
  onStopFlush: () => void;
  onToggleHardwareStatus: (id: number) => void;
}

export function Dashboard({ 
  data, 
  onStart, 
  onStop, 
  onStopAfterCycle,
  onStartWashing, 
  onStopWashing, 
  onResetCounter,
  onSelectRecipe,
  onAnswerPrompt,
  onStartFlush,
  onStopFlush,
  onToggleHardwareStatus
}: DashboardProps) {
  const [activeMsgTab, setActiveMsgTab] = React.useState<'LOGS' | 'ALERTS'>('LOGS');
  const isAuto = data.mode === 'OTOMATİK';
  const isWashing = data.mode === 'YIKAMA';
  const activeRecipe: Recipe = data?.recipes?.find(r => r.id === data?.config?.recipeId) || data?.recipes?.[0] || { 
    id: '', 
    name: 'Reçete Seçilmedi', 
    volumeMl: 0,
    targetCount: 0, 
    fillTimeMs: 0, 
    settlingTimeMs: 0,
    dripWaitTimeMs: 0,
    description: 'Reçete Yok',
    valveDurations: {}
  };
  
  const autoStateLabels: Record<string, string> = {
    BEKLEMEDE: 'Beklemede',
    GIRIS_SAYILIYOR: 'Giriş Sayılıyor',
    GIRIS_KILITLI: 'Giriş Kapısı Kilitleniyor',
    DENGELEME: 'Sıvı / Titreşim Dengeleniyor',
    DOLUM: 'Valfler Açık (Dolum)',
    DAMLA_BEKLEME: 'Damlama Bekleniyor',
    TAHLIYE: 'Çıkış Açık (Boşaltım)',
    DOGRULAMA: 'Döngü Pasaportu Doğrulanıyor'
  };

  const progress = isAuto && data.config.targetCount > 0 
      ? Math.min(100, Math.round(((data.autoState === 'TAHLIYE' || data.autoState === 'DOGRULAMA' 
          ? data.outputCount 
          : data.inputCount) / data.config.targetCount) * 100))
      : 0;

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shadow-lg flex-shrink-0 gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center">
              {isAuto ? (
                 <><RefreshCcw className="mr-2 text-green-400 animate-spin-slow" size={14} /> Üretim Devam Ediyor</>
              ) : isWashing ? (
                 <><Droplet className="mr-2 text-blue-400 animate-bounce" size={14} /> Yıkama Modu Aktif</>
              ) : data.mode === 'TAHLIYE' ? (
                 <><RefreshCcw className="mr-2 text-cyan-400 animate-spin" size={14} /> Tahliye Modu Aktif</>
              ) : (
                 <><Square className="mr-2 text-gray-500" size={14} /> Hazır Durumda</>
              )}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
              {isWashing ? 'Tüm Valfler Pulsing Modunda Çalkalanıyor' : (autoStateLabels[data.autoState] || data.autoState)} 
              {isAuto && <span className="ml-2 text-blue-400 font-bold">({progress}%)</span>}
            </p>
          </div>

          {!isAuto && !isWashing && (
             <div className={cn(
               "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5",
               data.isWashingDone ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
             )}>
                {data.isWashingDone ? <Shield size={10} /> : <AlertTriangle size={10} />}
                {data.isWashingDone ? 'YIKAMA TAMAM' : 'YIKAMA GEREKLİ'}
             </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isWashing && !isAuto && (
            <button
              onClick={onStartWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1e1b4b] border border-[#312e81] hover:bg-[#312e81] text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              <Droplet size={14} />
              <span>YIKAMAYI BAŞLAT</span>
            </button>
          )}

          {isWashing && (
            <button
              onClick={onStopWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/40 text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all whitespace-nowrap"
            >
              <Square size={14} />
              <span>YIKAMAYI DURDUR</span>
            </button>
          )}

          <button
            onClick={onStart}
            disabled={isAuto || isWashing || data.mode === 'ARIZA' || data.mode === 'BASLATMA'}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#052e16] border border-[#14532d] hover:bg-[#14532d] disabled:opacity-50 disabled:cursor-not-allowed text-[#4ade80] px-4 md:px-8 py-2 rounded font-bold text-[11px] transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <Play size={14} />
            <span>ÜRETİMİ BAŞLAT</span>
          </button>
          
          {isAuto && (
            <button
              onClick={onStopAfterCycle}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap",
                data.stopAfterCycleRequested 
                  ? "bg-amber-600/20 border-amber-500 text-amber-500 animate-pulse" 
                  : "bg-orange-900/40 border-orange-800 hover:bg-orange-900 text-orange-500"
              )}
            >
              <RefreshCw size={14} className={cn(data.stopAfterCycleRequested && "animate-spin")} />
              <span>{data.stopAfterCycleRequested ? 'DÖNGÜ SONU...' : 'BEKLEME MODU'}</span>
            </button>
          )}

          <button
            onClick={onStop}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/40 border border-red-800 hover:bg-red-900 text-red-500 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
          >
            <ShieldAlert size={14} />
            <span>ACİL DURDUR</span>
          </button>
          
          {data.mode === 'TAHLIYE' ? (
             <button
               onClick={onStopFlush}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan-900/40 border border-cyan-800 hover:bg-cyan-900 text-cyan-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
             >
               <Square size={14} />
               <span>TAHLİYEYİ DURDUR</span>
             </button>
          ) : (
             <button
               onClick={onStartFlush}
               disabled={isAuto || isWashing}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#151921] border border-cyan-800 hover:bg-cyan-900/40 text-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
             >
               <RefreshCcw size={14} />
               <span>TAHLİYE (FLUSH)</span>
             </button>
          )}
        </div>
      </div>

      {/* Recipe Selector - Large targets for HMI */}
      <RecipeSelector 
        data={data} 
        disabled={isAuto || isWashing} 
        onSelectRecipe={onSelectRecipe} 
      />

      {/* Main Flow Visualization */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto">
        
        {/* Left Column: Flow representation */}
        <div className="col-span-12 lg:col-span-8 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col relative overflow-hidden shadow-inner min-h-[400px]">
           <h2 className="text-[10px] font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
              <Cpu size={12} className="mr-2"/> Görsel Akış Kontrolü
           </h2>
           
           <div className="flex-1 flex flex-col justify-between items-center relative w-full pt-2 pb-16 z-10">
              
              {/* Target / Progress Line */}
              <div className="w-full flex items-center justify-between px-8 z-20 mb-4">
                  <div className="bg-[#0D1016]/95 backdrop-blur-sm p-2 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center shadow-lg">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-IN')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">GİRİŞ</div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => onResetCounter('input', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-orange-500/50 hover:text-orange-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-[#F97316] leading-none">{data.inputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => onResetCounter('input', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => onResetCounter('input', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    <div className="bg-[#1e1b4b]/95 backdrop-blur-sm p-2 rounded border border-[#312e81] text-center w-20 h-[46px] flex flex-col justify-center shadow-lg">
                       <div className="text-[9px] text-gray-400 mb-0.5 font-bold">HEDEF</div>
                       <div className="text-xl font-mono text-blue-400 leading-none">{data.config.targetCount}</div>
                    </div>

                    {/* Syrup Tank Visual Flow Representation */}
                    {(() => {
                       const maxH = data.config.ultrasonicMaxHeightCm || 100;
                       const levelCm = data.tankLevelCm !== undefined ? data.tankLevelCm : 85;
                       const liquidH = Math.max(0, maxH - levelCm);
                       const liquidP = Math.max(0, Math.min(100, Math.round((liquidH / maxH) * 100)));
                       const isCritical = liquidP <= (data.config.ultrasonicCriticalLowPercent || 15);

                       return (
                          <div className={cn(
                             "bg-[#0D1016]/95 backdrop-blur-sm p-1.5 rounded border flex items-center gap-2 w-32 h-[46px] transition-all shadow-lg",
                             isCritical ? "border-red-500/50 bg-red-950/20" : "border-[#1F2937]"
                          )}>
                             {/* Mini Tank Fluid Visual */}
                             <div className="w-4 h-7 border border-gray-700/60 bg-black/40 rounded relative overflow-hidden flex flex-col justify-end shrink-0">
                                <div 
                                   className={cn(
                                      "w-full transition-all duration-500 ease-out",
                                      isCritical ? "bg-red-500/70" : "bg-gradient-to-t from-orange-600/70 to-yellow-500/80"
                                   )}
                                   style={{ height: `${liquidP}%` }}
                                />
                             </div>
                             <div className="flex-1 flex flex-col justify-center min-w-0">
                                <div className="text-[7px] text-gray-500 font-bold uppercase tracking-wider truncate">Şerbet Tankı</div>
                                <div className={cn("text-xs font-mono font-bold leading-none mt-0.5", isCritical ? "text-red-400 animate-pulse" : "text-orange-400")}>
                                   %{liquidP}
                                </div>
                                <div className="text-[7px] text-gray-600 font-mono leading-none mt-0.5 truncate">{liquidH} cm</div>
                             </div>
                          </div>
                       );
                    })()}
                 </div>

                 <div className="bg-[#0D1016]/95 backdrop-blur-sm p-2 rounded border border-[#1F2937] text-center w-28 relative flex flex-col items-center shadow-lg">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                       <div className={cn("w-6 h-1 rounded-full", data.sensors.find(s=>s.id=='SENS-OUT')?.enabled ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]")} />
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1 font-bold">ÇIKIŞ</div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => onResetCounter('output', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-emerald-500/50 hover:text-emerald-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-green-400 leading-none">{data.outputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => onResetCounter('output', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => onResetCounter('output', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Conveyor graphic */}
              <div className="w-full mt-4 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative">
                 
                 {/* Input Gate */}
                 <div className="absolute left-10 -bottom-16 flex flex-col items-center z-20">
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.inputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.inputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                       <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                          <Lock size={14} className={cn(data.inputGate.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                          <Unlock size={14} className={cn(data.inputGate.isOpen ? "text-green-500" : "hidden")} />
                       </div>
                       <div className={cn("w-6 h-2 rounded-full mb-1", data.inputGate.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                       <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">GİRİŞ</div>
                    </div>
                 </div>
                 
                 {/* Valves */}
                 <div className="absolute left-32 right-32 top-0 flex justify-between px-2 -mt-4 z-10">
                    {[...data.valves].reverse().map((valve, i) => (
                       <div key={valve.id} className="flex flex-col items-center w-10">
                          <button 
                            onClick={() => onToggleHardwareStatus(valve.id)}
                            disabled={isAuto || isWashing}
                            title={valve.enabled ? 'Bypass Yap (İptal Et)' : 'Aktif Et'}
                            className={cn(
                             "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center disabled:cursor-not-allowed hover:ring-2 ring-white/20", 
                             !valve.enabled
                              ? "bg-red-900/50 border-red-800 text-red-500 opacity-50"
                              : (valve.isOpen || data.mode === 'YIKAMA') 
                                ? (data.mode === 'YIKAMA' ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]" : "bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.8)] text-white") 
                                : "bg-[#2D333F] border-[#1F2937] text-gray-500"
                           )}>
                                                         <span className="text-[10px] font-bold">{valve.name || valve.id}</span>
                            {!valve.enabled && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-0.5 bg-red-500 -rotate-45" /></div>}
                          </button>
                          <div className={cn("w-2.5 h-6 mt-1 rounded-b-sm relative z-20", !valve.enabled ? "bg-red-900/50 opacity-50" : "bg-[#1F2937]")} />
                         {/* Fluid drip animation */}
                         <AnimatePresence>
                           {(valve.isOpen || data.mode === 'YIKAMA') && (
                              <motion.div 
                                initial={{ height: 0, opacity: 1 }}
                                animate={{ height: 60, opacity: 0 }}
                                transition={{ 
                                  repeat: Infinity, 
                                  duration: data.mode === 'YIKAMA' ? 0.3 : 0.5 
                                }}
                                className={cn(
                                  "w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10",
                                  data.mode === 'YIKAMA' ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" : "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]"
                                )}
                              />
                           )}
                         </AnimatePresence>
                      </div>
                    ))}
                 </div>
                 
                 {/* Output Gate */}
                 <div className="absolute right-10 -bottom-16 flex flex-col items-center z-20">
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.outputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2", data.outputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                       <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                          <Lock size={14} className={cn(data.outputGate.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                          <Unlock size={14} className={cn(data.outputGate.isOpen ? "text-green-500" : "hidden")} />
                       </div>
                       <div className={cn("w-6 h-2 rounded-full mb-1", data.outputGate.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                       <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">ÇIKIŞ</div>
                    </div>
                 </div>
                 
                 {/* Bottles mapping */}
                 <div className="absolute left-32 right-32 bottom-0 flex justify-between px-2 z-0">
                    {[...data.valves].reverse().map((valve, i) => (
                       <div key={'bottle-'+valve.id} className="flex justify-center w-10">
                          {data.inputCount > 0 && (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }} 
                               animate={{ opacity: 1, y: 0 }}
                               className="w-10 h-20 bg-gradient-to-t from-[#374151] to-[#4B5563] rounded-t-lg border-b-2 border-gray-600 shadow-sm relative flex flex-col items-center justify-start pt-1"
                             >
                                <div className="absolute -top-4 w-4 h-5 bg-[#4B5563] rounded-t-sm border border-gray-500" />
                                <div className="w-6 h-px bg-white/10 mt-2" />
                             </motion.div>
                          )}
                       </div>
                    ))}
                 </div>

              </div>
           </div>

           {/* System Messages & Alerts Tabs */}
           <TerminalTabsPanel 
              data={data} 
              activeMsgTab={activeMsgTab} 
              setActiveMsgTab={setActiveMsgTab} 
           />
        </div>
        
        <SystemMetricsRightPanel 
          data={data} 
          activeRecipe={activeRecipe} 
          activeMsgTab={activeMsgTab} 
          setActiveMsgTab={setActiveMsgTab} 
        />

      </div>

      {/* Prompt Overlays */}
      <AnimatePresence>
         {data.activePrompt === 'BOTTLE_CHECK' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-[#151921] border-2 border-blue-500 rounded-xl max-w-lg w-full p-8 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
               >
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                        <Droplet size={40} className="text-blue-400" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2">Dolum Alanı Kontrolü</h3>
                     <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        Üretim döngüsü başlamadan önce lütfen kontrol edin:<br/>
                        <span className="text-white font-bold">Dolum alanında (şişe baskı bölgesinde) ürün var mı?</span>
                     </p>
                     
                     <div className="grid grid-cols-2 gap-4 w-full">
                        <button 
                          onClick={() => onAnswerPrompt(true)}
                          className="bg-red-500 hover:bg-red-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <ShieldAlert size={28} />
                           EVET, VAR
                        </button>
                        <button 
                          onClick={() => onAnswerPrompt(false)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <Target size={28} />
                           HAYIR, BOŞ
                        </button>
                     </div>
                     <p className="mt-6 text-gray-500 text-sm italic">
                        * Üretimin sağlıklı başlaması için alanın boş olması gerekmektedir.
                     </p>
                  </div>
               </motion.div>
            </motion.div>
         )}

         {data.activePrompt === 'COUNT_MISMATCH' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-[#151921] border-2 border-amber-500 rounded-xl max-w-lg w-full p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)]"
               >
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle size={40} className="text-amber-400" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2">Şişe Sayıları Eşit Değil</h3>
                     <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                        Giren şişe sayısı ile çıkan şişe sayısı uyuşmuyor.
                     </p>
                     <div className="grid grid-cols-2 gap-6 mb-8 w-full max-w-xs">
                        <div className="bg-[#0D1016] border border-[#1F2937] rounded-xl p-4 text-center">
                           <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Giren</div>
                           <div className="text-4xl font-mono font-bold text-[#F97316]">{data.promptData?.inputCount ?? 0}</div>
                        </div>
                        <div className="bg-[#0D1016] border border-[#1F2937] rounded-xl p-4 text-center">
                           <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Çıkan</div>
                           <div className="text-4xl font-mono font-bold text-emerald-400">{data.promptData?.outputCount ?? 0}</div>
                        </div>
                     </div>
                     <p className="text-gray-500 text-md mb-6">Yine de yeni döngü başlasın mı?</p>
                     
                     <div className="grid grid-cols-2 gap-4 w-full">
                        <button 
                          onClick={() => onAnswerPrompt(true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-lg font-bold text-lg transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <Target size={24} />
                           EVET, BAŞLAT
                        </button>
                        <button 
                          onClick={() => onAnswerPrompt(false)}
                          className="bg-red-600 hover:bg-red-500 text-white py-5 rounded-lg font-bold text-lg transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                        >
                           <ShieldAlert size={24} />
                           HAYIR, DURDUR
                        </button>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}
