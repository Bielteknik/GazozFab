import React from 'react';
import { cn } from '../../../lib/utils';
import { GateState, SystemData } from '../../../types/system';

interface HardwareGateCardProps {
  gate: GateState;
  gateKey: 'inputGate' | 'outputGate';
  title: string;
  data: SystemData;
  onUpdateSystemGate?: (gate: 'inputGate' | 'outputGate', updates: Partial<GateState>) => void;
  onToggleGateEnabled: (gate: 'inputGate' | 'outputGate') => void;
}

export const HardwareGateCard: React.FC<HardwareGateCardProps> = ({
  gate,
  gateKey,
  title,
  data,
  onUpdateSystemGate,
  onToggleGateEnabled
}) => {
  return (
    <div className={cn(
      "p-3 rounded border flex flex-col justify-between space-y-3",
      gate.enabled ? "bg-[#1C2029] border-[#374151]" : "bg-[#0D1016] border-[#1F2937]"
    )}>
      <div className="flex items-center space-x-3 mb-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0", gate.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600")} />
        <div>
          <div className={cn("text-xs font-bold", gate.enabled ? "text-gray-200" : "text-gray-500")}>{title}</div>
          <div className="text-[9px] font-mono text-gray-500">{gate.enabled ? 'AKTİF' : 'DEVRE DIŞI'}</div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Cihaz Türü</label>
            <select 
               value={gate.device || 'NANO'} 
               onChange={(e) => {
                 const newDevice = e.target.value as 'RASPI' | 'NANO';
                 onUpdateSystemGate?.(gateKey, { 
                   device: newDevice,
                   nanoId: newDevice === 'RASPI' ? 'RASPI' : '' 
                 });
               }}
               disabled={!gate.enabled || data.mode === 'OTOMATİK'}
               className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            >
               <option value="RASPI">Raspberry Pi 5</option>
               <option value="NANO">Arduino Nano</option>
            </select>
          </div>
          
          {(!gate.device || gate.device === 'NANO') ? (
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-500 font-bold mb-1">Nano Seçimi</label>
              <select 
                 value={gate.nanoId && gate.nanoId !== 'RASPI' ? gate.nanoId : ''} 
                 onChange={(e) => onUpdateSystemGate?.(gateKey, { nanoId: e.target.value })}
                 disabled={!gate.enabled || data.mode === 'OTOMATİK'}
                 className="bg-[#1C2029] border border-[#374151] text-[10px] text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
              >
                 <option value="">Seçiniz...</option>
                 {data.nanos.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-500 font-bold mb-1">Bağlantı</label>
              <div className="text-[10px] text-blue-400 font-semibold px-2 py-1.5 bg-[#1C2029] border border-[#374151] rounded select-none truncate">
                Pi 5 Dahili GPIO
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Step Pin</label>
            <input 
              type="text" 
              value={gate.pin || ''} 
              placeholder="Örn: 4"
              onChange={(e) => onUpdateSystemGate?.(gateKey, { pin: e.target.value })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Dir Pin</label>
            <input 
              type="text" 
              value={gate.dirPin || ''} 
              placeholder="Örn: 5"
              onChange={(e) => onUpdateSystemGate?.(gateKey, { dirPin: e.target.value })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">EN Pin</label>
            <input 
              type="text" 
              value={gate.enablePin || ''} 
              placeholder="Ops."
              onChange={(e) => onUpdateSystemGate?.(gateKey, { enablePin: e.target.value })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Açılırken atılacak adım">Açılma (Adım)</label>
            <input 
              type="number" 
              value={gate.stepsToOpen || 200} 
              onChange={(e) => onUpdateSystemGate?.(gateKey, { stepsToOpen: Number(e.target.value) })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1" title="Kapanırken atılacak adım">Kapanma (Adım)</label>
            <input 
              type="number" 
              value={gate.stepsToClose || 200} 
              onChange={(e) => onUpdateSystemGate?.(gateKey, { stepsToClose: Number(e.target.value) })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">Hız (Adım/sn)</label>
            <input 
              type="number" 
              value={gate.speed || 1000} 
              onChange={(e) => onUpdateSystemGate?.(gateKey, { speed: Number(e.target.value) })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-bold mb-1">İvme (Adım/sn²)</label>
            <input 
              type="number" 
              value={gate.acceleration || 500} 
              onChange={(e) => onUpdateSystemGate?.(gateKey, { acceleration: Number(e.target.value) })}
              disabled={!gate.enabled || data.mode === 'OTOMATİK'}
              className="w-full min-w-0 bg-[#1C2029] border border-[#374151] text-[10px] font-mono text-gray-300 rounded px-2 py-1 outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between space-x-2 border-t border-[#2D333F] pt-3 mt-3">
        <button 
          onClick={() => onToggleGateEnabled(gateKey)}
          disabled={data.mode === 'OTOMATİK'}
          className={cn(
            "flex-1 px-2 py-1.5 text-[9px] font-bold rounded border transition-colors disabled:opacity-50",
            gate.enabled 
               ? "bg-[#381a03] text-[#fdba74] border-[#7c2d12] hover:bg-[#7c2d12]" 
               : "bg-[#052e16] text-[#4ade80] border-[#14532d] hover:bg-[#14532d]"
          )}
        >
          {gate.enabled ? 'PASİFE AL' : 'AKTİFLEŞTİR'}
        </button>
      </div>
    </div>
  );
};
