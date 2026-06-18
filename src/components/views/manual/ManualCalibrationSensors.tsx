import React from 'react';
import { Save } from 'lucide-react';
import { SystemData, SensorState } from '../../../types/system';

interface ManualCalibrationSensorsProps {
  data: SystemData;
  sensorCal: { id: string; debounceMs: number };
  setSensorCal: React.Dispatch<React.SetStateAction<{ id: string; debounceMs: number }>>;
  onUpdateSensor: (id: string, updates: Partial<SensorState>) => void;
}

export const ManualCalibrationSensors: React.FC<ManualCalibrationSensorsProps> = ({
  data,
  sensorCal,
  setSensorCal,
  onUpdateSensor
}) => {
  return (
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
  );
};
