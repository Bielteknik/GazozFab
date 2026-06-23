import React, { useState, useEffect } from 'react';
import { SystemData, SystemMode, ValveState, GateState, Recipe } from '../../types/system';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, RefreshCcw, ShieldAlert, Cpu, AlertTriangle, 
  Unlock, Shield, Target, RefreshCw, Lock, Droplet, Cylinder, UserCheck,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { RecipeSelector } from './shared/RecipeSelector';
import { SystemMetricsRightPanel } from './shared/SystemMetricsRightPanel';
import { TerminalTabsPanel } from './shared/TerminalTabsPanel';
import { cn } from '../../lib/utils';

interface OperatorControlProps {
  data: SystemData;
  setMode: (mode: SystemMode) => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number, steps?: number, speed?: number) => void;
  testValvePulse: (id: number, duration: number) => void;
  resetCounter: (target: 'input' | 'output', op?: 'inc' | 'dec' | 'reset') => void;
  onSelectRecipe: (id: string) => void;
  startOperatorFill: (method?: 'SEQUENTIAL' | 'CONCURRENT') => void;
}

export function OperatorControl({ 
  data, 
  setMode, 
  operateGate, 
  testValvePulse, 
  resetCounter, 
  onSelectRecipe, 
  startOperatorFill
}: OperatorControlProps) {
  const [activeMsgTab, setActiveMsgTab] = useState<'LOGS' | 'ALERTS'>('LOGS');
  const [isFilling, setIsFilling] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);
  const [fillMethod, setFillMethod] = useState<'SEQUENTIAL' | 'CONCURRENT'>('SEQUENTIAL');

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



  const handleStartFilling = () => {
    if (isFilling) return;
    setIsFilling(true);
    setFillProgress(0);
    
    // Start backend action
    if (data.mode === 'MANUEL' || data.mode === 'BEKLEMEDE') {
       setMode('BEKLEMEDE'); 
    }
    
    // Trigger backend pulse sequence
    startOperatorFill(fillMethod);
  };

  // Progress effect only for UI feedback
  useEffect(() => {
    if (isFilling) {
      const duration = data.config.fillTimeMs || 1000;
      const interval = 50;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += interval;
        setFillProgress(Math.min((elapsed / duration) * 100, 100));
        if (elapsed >= duration) {
          clearInterval(timer);
          setIsFilling(false);
          setFillProgress(0);
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [isFilling, data.config.fillTimeMs]);

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      
      {/* Top action bar - Operator Control version */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shadow-lg flex-shrink-0 gap-4 lg:gap-0 w-full">
        {/* Header Info & Exit Mode */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center">
              <UserCheck className="mr-2 text-blue-400" size={14} /> OPERATÖR KONTROLÜ AKTİF
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
              {isFilling ? 'Şerbet Dolumu Yapılıyor' : 'Tüm süreç manuel tetikleme bekliyor'} 
              {isFilling && <span className="ml-2 text-blue-400 font-bold">({Math.round(fillProgress)}%)</span>}
            </p>
          </div>
          <div className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
            Yarı-Otomatik Mod
          </div>
        </div>

        {/* Row 2: Action Buttons & Exit Mode (moved to top row as flex items) */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Step 1: Entry Gate */}
          <button
            onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 400)}
            className={cn(
              "flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded font-bold text-[10px] transition-all border whitespace-nowrap active:scale-95 h-[34px]",
              data.inputGate.isOpen 
                ? "bg-red-900/20 border-red-800 text-red-500 hover:bg-red-900/40" 
                : "bg-emerald-900/40 border-emerald-800 text-emerald-400 hover:bg-emerald-900"
            )}
          >
            {data.inputGate.isOpen ? <Square size={12} /> : <Play size={12} />}
            <span>{data.inputGate.isOpen ? '1. GİRİŞİ KAPAT' : '1. GİRİŞİ BAŞLAT'}</span>
          </button>

          {/* Fill Method Selection */}
          <select
            value={fillMethod}
            onChange={(e) => setFillMethod(e.target.value as 'SEQUENTIAL' | 'CONCURRENT')}
            disabled={isFilling}
            className="flex-1 lg:flex-none bg-[#1C2029] border border-[#374151] rounded px-3 py-2 text-[10px] font-bold text-[#4ade80] focus:border-[#4ade80]/50 outline-none disabled:opacity-50 h-[34px] cursor-pointer text-center"
          >
            <option value="SEQUENTIAL">Sıralı Doldur (Tek Tek)</option>
            <option value="CONCURRENT">Eşzamanlı Doldur (Hepsi)</option>
          </select>

          {/* Step 2: Manual Fill */}
          <button
            onClick={handleStartFilling}
            disabled={isFilling || data.inputGate.isOpen || data.outputGate.isOpen}
            title={
              isFilling 
                ? 'Dolum devam ediyor' 
                : (data.inputGate.isOpen || data.outputGate.isOpen) 
                  ? 'Giriş/Çıkış kilitleri açıkken dolum yapılamaz!' 
                  : 'Dolum işlemini başlat'
            }
            className={cn(
              "flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded font-bold text-[10px] transition-all active:scale-95 border whitespace-nowrap relative overflow-hidden h-[34px]",
              isFilling 
                ? "bg-blue-600/20 border-blue-500 text-blue-400" 
                : (data.inputGate.isOpen || data.outputGate.isOpen)
                  ? "bg-red-950/20 border-red-900/40 text-red-500/50 opacity-60 cursor-not-allowed"
                  : "bg-blue-900/40 border-blue-800 text-blue-400 hover:bg-blue-900 disabled:opacity-50"
            )}
          >
            {isFilling && (
              <motion.div 
                className="absolute bottom-0 left-0 h-0.5 bg-blue-400" 
                initial={{ width: 0 }} 
                animate={{ width: `${fillProgress}%` }}
              />
            )}
            <Droplet size={12} className={cn(isFilling && "animate-bounce")} />
            <span>
              {isFilling 
                ? '2. DOLUM YAPILIYOR...' 
                : (data.inputGate.isOpen || data.outputGate.isOpen) 
                  ? '2. KİLİTLER AÇIK (BLOKE)' 
                  : '2. DOLUMU BAŞLAT'}
            </span>
          </button>

          {/* Step 3: Exit Gate */}
          <button
            onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 400)}
            className={cn(
              "flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded font-bold text-[10px] transition-all border whitespace-nowrap active:scale-95 h-[34px]",
              data.outputGate.isOpen 
                ? "bg-orange-900/20 border-orange-800 text-orange-500 hover:bg-orange-900/40" 
                : "bg-orange-600/20 border-orange-500 text-orange-400 hover:bg-orange-650/40"
            )}
          >
            {data.outputGate.isOpen ? <Square size={12} /> : <RefreshCw size={12} />}
            <span>{data.outputGate.isOpen ? '3. TAHLİYEYİ DURDUR' : '3. TAHLİYEYİ BAŞLAT'}</span>
          </button>

          {/* Exit Mode Button */}
          <button
            onClick={() => setMode('BEKLEMEDE')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-red-900/40 border border-red-800 hover:bg-red-900 text-red-500 px-3 py-2 rounded font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap h-[34px]"
          >
            <ShieldAlert size={12} />
            <span>MODDAN ÇIK</span>
          </button>
        </div>
      </div>

      {/* Recipe Selector - Kept same as Dashboard */}
      <RecipeSelector 
        data={data} 
        disabled={isAuto || isWashing} 
        onSelectRecipe={onSelectRecipe} 
      />

      {/* Main Flow Visualization - Same layout as Dashboard */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto">
        
        {/* Left Column: Flow representation + Bottom tabbed messages inside */}
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
                       <button onClick={() => resetCounter('input', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-orange-500/50 hover:text-orange-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-[#F97316] leading-none">{data.inputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => resetCounter('input', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => resetCounter('input', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
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
                                      isCritical ? "bg-red-500/70" : "bg-gradient-to-t from-orange-650/70 to-yellow-500/80"
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
                       <button onClick={() => resetCounter('output', 'reset')} className="p-1 hover:bg-gray-800 rounded transition-colors text-emerald-500/50 hover:text-emerald-500"><RefreshCw size={10} /></button>
                       <div className="text-2xl font-mono text-green-400 leading-none">{data.outputCount}</div>
                       <div className="flex flex-col gap-0.5">
                          <button onClick={() => resetCounter('output', 'inc')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowUp size={8} /></button>
                          <button onClick={() => resetCounter('output', 'dec')} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ArrowDown size={8} /></button>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Conveyor graphic */}
              <div className="w-full mt-4 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative shadow-inner">
                 
                 {/* Input Gate (INTERACTIVE) */}
                 <div 
                   onClick={() => operateGate('inputGate', data.inputGate.isOpen ? 0 : 400)}
                   className="absolute left-10 -bottom-16 flex flex-col items-center z-20 cursor-pointer group"
                   title="Giriş Kapısını Manuel Aç/Kapat"
                 >
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.inputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2 group-hover:ring-4 ring-white/10", data.inputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2 group-hover:border-blue-500 transition-colors">
                       <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                          <Lock size={14} className={cn(data.inputGate.isOpen ? "text-green-500 hidden" : "text-red-500")} />
                          <Unlock size={14} className={cn(data.inputGate.isOpen ? "text-green-500" : "hidden")} />
                       </div>
                       <div className={cn("w-6 h-2 rounded-full mb-1", data.inputGate.isOpen ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                       <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">GİRİŞ</div>
                    </div>
                 </div>
                 
                 {/* Valves (INTERACTIVE) */}
                 <div className="absolute left-32 right-32 top-0 flex justify-between px-2 -mt-4 z-10">
                    {[...data.valves].reverse().map((valve, i) => {
                       const isValveOpen = valve.isOpen || (isFilling && valve.enabled);
                       return (
                          <div key={valve.id} className="flex flex-col items-center w-10">
                             <button 
                               onClick={() => {
                                  if (valve.enabled && !isFilling) {
                                    let valveDur = (activeRecipe as Recipe).fillTimeMs || 1000;
                                    if ((activeRecipe as Recipe).valveDurations) {
                                      const durVal = (activeRecipe as Recipe).valveDurations[valve.id] || (activeRecipe.valveDurations as Record<string, number>)[String(valve.id)];
                                      if (durVal) {
                                        valveDur = durVal;
                                      }
                                    }
                                    testValvePulse(valve.id, valveDur);
                                  }
                                }}
                               title={valve.isOpen ? 'Kapat' : 'Aç'}
                               className={cn(
                                "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center hover:ring-2 ring-white/20", 
                                !valve.enabled
                                 ? "bg-red-900/50 border-red-800 text-red-500 opacity-50"
                                 : isValveOpen 
                                   ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                                   : "bg-[#2D333F] border-[#1F2937] text-gray-500"
                              )}>
                                <span className="text-[10px] font-bold">{valve.name || valve.id}</span>
                                {!valve.enabled && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-0.5 bg-red-500 -rotate-45" /></div>}
                             </button>
                             <div className={cn("w-2.5 h-6 mt-1 rounded-b-sm relative z-20", !valve.enabled ? "bg-red-900/50 opacity-50" : "bg-[#1F2937]")} />
                            {/* Fluid drip animation */}
                            <AnimatePresence>
                              {isValveOpen && (
                                 <motion.div 
                                   initial={{ height: 0, opacity: 1 }}
                                   animate={{ height: 60, opacity: 0 }}
                                   transition={{ repeat: Infinity, duration: 0.5 }}
                                   className="w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                                 />
                              )}
                            </AnimatePresence>
                          </div>
                       );
                    })}
                 </div>
                 
                 {/* Output Gate (INTERACTIVE) */}
                 <div 
                   onClick={() => operateGate('outputGate', data.outputGate.isOpen ? 0 : 400)}
                   className="absolute right-10 -bottom-16 flex flex-col items-center z-20 cursor-pointer group"
                   title="Çıkış Kapısını Manuel Aç/Kapat"
                 >
                    <div className="h-44 w-6 flex items-end overflow-hidden">
                       <motion.div 
                         initial={false}
                         animate={{ y: data.outputGate.isOpen ? '100%' : '0%' }}
                         transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                         className={cn("w-full h-32 rounded-t-md transition-colors border-2 group-hover:ring-4 ring-white/10", data.outputGate.isOpen ? "bg-green-500/80 border-green-400" : "bg-red-500 border-red-700")}
                       />
                    </div>
                    <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2 group-hover:border-blue-500 transition-colors">
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

            {/* System Messages & Alerts Tabs - INSIDE Left Column to match Dashboard layout exactly */}
            <TerminalTabsPanel 
               data={data} 
               activeMsgTab={activeMsgTab} 
               setActiveMsgTab={setActiveMsgTab} 
            />
         </div>
        
        {/* Right Column: Status & Syrup Tank details - EXACTLY like Dashboard */}
        <div className="col-span-12 lg:col-span-4 flex flex-col space-y-3 min-h-0">
           
            <SystemMetricsRightPanel 
               data={data} 
               activeRecipe={activeRecipe} 
               activeMsgTab={activeMsgTab} 
               setActiveMsgTab={setActiveMsgTab} 
            />
         </div>
      </div>
   </div>
);
}
