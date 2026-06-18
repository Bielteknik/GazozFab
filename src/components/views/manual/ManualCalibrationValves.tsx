import React from 'react';
import { Play, RefreshCw, Droplet, Save } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData, Recipe } from '../../../types/system';

interface ManualCalibrationValvesProps {
  data: SystemData;
  selectedRecipeId: string | null;
  setSelectedRecipeId: (id: string) => void;
  selectedValveId: number | null;
  setSelectedValveId: (id: number) => void;
  testDuration: number;
  setTestDuration: (ms: number) => void;
  testValvePulse: (id: number, duration: number) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  measuredMl: number | '';
  setMeasuredMl: (ml: number | '') => void;
  selectedRecipe?: Recipe;
}

export const ManualCalibrationValves: React.FC<ManualCalibrationValvesProps> = ({
  data,
  selectedRecipeId,
  setSelectedRecipeId,
  selectedValveId,
  setSelectedValveId,
  testDuration,
  setTestDuration,
  testValvePulse,
  onUpdateRecipe,
  measuredMl,
  setMeasuredMl,
  selectedRecipe
}) => {
  return (
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
  );
};
