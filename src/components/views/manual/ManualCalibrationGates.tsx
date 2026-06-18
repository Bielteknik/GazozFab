import React from 'react';
import { ArrowUp, ArrowDown, RefreshCw, Save } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GateState } from '../../../types/system';

interface ManualCalibrationGatesProps {
  gateCal: { target: 'inputGate' | 'outputGate'; steps: number; speed: number };
  setGateCal: React.Dispatch<React.SetStateAction<{ target: 'inputGate' | 'outputGate'; steps: number; speed: number }>>;
  setLastLoadedTarget: (target: string | null) => void;
  sendNanoCommand: (nanoId: string, cmd: string) => void;
  operateGate: (target: 'inputGate' | 'outputGate', position: number, steps?: number, speed?: number) => void;
  onUpdateSystemGate: (target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => void;
}

export const ManualCalibrationGates: React.FC<ManualCalibrationGatesProps> = ({
  gateCal,
  setGateCal,
  setLastLoadedTarget,
  sendNanoCommand,
  operateGate,
  onUpdateSystemGate
}) => {
  return (
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
  );
};
