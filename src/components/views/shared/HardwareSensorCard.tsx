import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SensorState, SystemData } from '../../../types/system';

interface HardwareSensorCardProps {
  sensor: SensorState;
  data: SystemData;
  onUpdateSensor?: (id: number, updates: Partial<SensorState>) => void;
  onToggleSensorEnabled: (id: number) => void;
  onRemoveSensor?: (id: number) => void;
}

export const HardwareSensorCard: React.FC<HardwareSensorCardProps> = ({
  sensor,
  data,
  onUpdateSensor,
  onToggleSensorEnabled,
  onRemoveSensor
}) => {
  return (
    <div className={cn(
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
               className="bg-[#1C2029] border-[#374151] border text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
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
                 className="w-full min-w-0 bg-[#1C2029] border-[#374151] border text-[10px] text-gray-300 rounded pl-2 pr-6 py-1 truncate outline-none disabled:opacity-50"
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
  );
};
