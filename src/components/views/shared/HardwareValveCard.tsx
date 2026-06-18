import React from 'react';
import { Check, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData, ValveState } from '../../../types/system';

interface HardwareValveCardProps {
  valve: ValveState;
  data: SystemData;
  editingValveId: number | null;
  tempValveName: string;
  setEditingValveId: (id: number | null) => void;
  setTempValveName: (name: string) => void;
  onUpdateValve?: (id: number, updates: Partial<ValveState>) => void;
  onToggleHardwareStatus: (id: number) => void;
  onRemoveHardware: (id: number) => void;
}

export const HardwareValveCard: React.FC<HardwareValveCardProps> = ({
  valve,
  data,
  editingValveId,
  tempValveName,
  setEditingValveId,
  setTempValveName,
  onUpdateValve,
  onToggleHardwareStatus,
  onRemoveHardware
}) => {
  return (
    <div className={cn(
      "p-3 rounded border flex flex-col justify-between space-y-3",
      valve.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={cn("w-2 h-2 rounded-full shrink-0", valve.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
          <div>
            {editingValveId === valve.id ? (
              <input 
                type="text"
                value={tempValveName}
                onChange={(e) => setTempValveName(e.target.value)}
                className="bg-[#0D1016] border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-white font-bold outline-none w-32"
                autoFocus
              />
            ) : (
              <div className={cn("text-xs font-bold", valve.enabled ? "text-gray-200" : "text-gray-500")}>
                {valve.name || `Valf Modülü #${valve.id}`}
              </div>
            )}
            <div className="text-[9px] font-mono text-gray-500">{valve.enabled ? 'AKTİF (İZLENİYOR)' : 'PASİF (DEVRE DIŞI)'}</div>
          </div>
        </div>
        
        <div className="flex gap-1">
          {editingValveId === valve.id ? (
            <button 
              onClick={() => {
                onUpdateValve?.(valve.id, { name: tempValveName });
                setEditingValveId(null);
              }}
              className="p-1 hover:bg-emerald-500/10 text-emerald-500 rounded transition-colors"
            >
              <Check size={14} />
            </button>
          ) : (
            <button 
              onClick={() => {
                setEditingValveId(valve.id);
                setTempValveName(valve.name || `Valf Modülü #${valve.id}`);
              }}
              className="p-1 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 rounded transition-colors"
            >
              <Edit2 size={12} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
            <select 
               value={valve.device || 'NANO'} 
               onChange={(e) => {
                 const newDevice = e.target.value as 'RASPI' | 'NANO';
                 onUpdateValve?.(valve.id, { 
                   device: newDevice,
                   nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                 });
               }}
               disabled={!valve.enabled || data.mode === 'OTOMATİK'}
               className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="RASPI">Raspberry Pi 5</option>
               <option value="NANO">Arduino Nano</option>
            </select>
          </div>
          
          {(!valve.device || valve.device === 'NANO') ? (
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
              <select 
                 value={valve.nanoId && valve.nanoId !== 'RASPI' ? valve.nanoId : ''} 
                 onChange={(e) => onUpdateValve?.(valve.id, { nanoId: e.target.value })}
                 disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                 className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded pl-2 pr-6 py-1 truncate outline-none disabled:opacity-50"
              >
                 <option value="">Seçiniz...</option>
                 {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
              <div className="text-[10px] text-blue-400 font-semibold px-2 py-1 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                Pi 5 Dahili GPIO
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Pin Bağlantısı</label>
            <input 
              type="text" 
              value={valve.pin || ''} 
              placeholder={valve.device === 'RASPI' ? 'Örn: GPIO23' : 'Örn: D3, A0'}
              onChange={(e) => onUpdateValve?.(valve.id, { pin: e.target.value })}
              disabled={!valve.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Çalışma Modu</label>
            <select 
               value={valve.mode || 'PULSE'} 
               onChange={(e) => onUpdateValve?.(valve.id, { mode: e.target.value as 'PULSE' | 'CONTINUOUS' })}
               disabled={!valve.enabled || data.mode === 'OTOMATİK'}
               className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="PULSE">PULSE (Zamanlı)</option>
               <option value="CONTINUOUS">CONTINUOUS (Sürekli)</option>
            </select>
          </div>
          <div className="flex flex-col w-16 group relative shrink-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Süre veya Hız ayarı">{valve.mode === 'CONTINUOUS' ? 'Hız (%)' : 'Açık (ms)'}</label>
            {valve.mode === 'CONTINUOUS' ? (
               <input 
                  type="number" 
                  value={valve.speed ?? 100} 
                  step="10"
                  min="0"
                  max="100"
                  onChange={(e) => onUpdateValve?.(valve.id, { speed: Number(e.target.value) })}
                  disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
               />
            ) : (
               <input 
                  type="number" 
                  value={valve.pulseDuration || 1000} 
                  step="100"
                  min="100"
                  onChange={(e) => onUpdateValve?.(valve.id, { pulseDuration: Number(e.target.value) })}
                  disabled={!valve.enabled || data.mode === 'OTOMATİK'}
                  className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
               />
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Röle Tipi</label>
            <select 
               value={valve.relayType || 'NO'} 
               onChange={(e) => onUpdateValve?.(valve.id, { relayType: e.target.value as any })}
               disabled={!valve.enabled || data.mode === 'OTOMATİK'}
               className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="NO">NO (Açık)</option>
               <option value="NC">NC (Kapalı)</option>
            </select>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Tetikleme</label>
            <select 
               value={valve.relayInversion ? 'LOW' : 'HIGH'} 
               onChange={(e) => onUpdateValve?.(valve.id, { relayInversion: e.target.value === 'LOW' })}
               disabled={!valve.enabled || data.mode === 'OTOMATİK'}
               className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="HIGH">Aktif Yük. (5V)</option>
               <option value="LOW">Aktif Düş. (0V)</option>
            </select>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Sinyal Türü</label>
            <select 
               value={valve.signalType || 'DIGITAL'} 
               onChange={(e) => onUpdateValve?.(valve.id, { signalType: e.target.value as any })}
               disabled={!valve.enabled || data.mode === 'OTOMATİK'}
               className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="DIGITAL">Dijital</option>
               <option value="PWM">PWM</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
        <button 
          onClick={() => onToggleHardwareStatus(valve.id)}
          disabled={data.mode === 'OTOMATİK'}
          className={cn(
            "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
            valve.enabled 
               ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
               : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
          )}
        >
          {valve.enabled ? 'DEVRE DIŞI BIRAK' : 'AKTİFLEŞTİR'}
        </button>
        <button 
          onClick={() => onRemoveHardware(valve.id)}
          disabled={data.mode === 'OTOMATİK' || data.valves.length <= 1}
          className="p-1.5 text-gray-500 bg-[#0D1016] border border-[#1F2937] hover:text-red-400 hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
          title="Modülü Çıkar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
