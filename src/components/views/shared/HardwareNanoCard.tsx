import React from 'react';
import { Activity, RefreshCw, Trash2 } from 'lucide-react';
import { NanoState, SystemData } from '../../../types/system';

interface HardwareNanoCardProps {
  nano: NanoState;
  data: SystemData;
  availablePorts: string[];
  isScanning: boolean;
  onUpdateNanoConfig: (id: string, updates: Partial<NanoState>) => void;
  onSendNanoCommand: (id: string, command: string) => void;
  onRemoveNano: (id: string) => void;
  handleScan: () => void;
}

export const HardwareNanoCard: React.FC<HardwareNanoCardProps> = ({
  nano,
  data,
  availablePorts,
  isScanning,
  onUpdateNanoConfig,
  onSendNanoCommand,
  onRemoveNano,
  handleScan
}) => {
  return (
    <div className="bg-[#0D1016] border border-[#1F2937] p-3 rounded flex flex-col space-y-3">
      <div className="flex justify-between items-center bg-[#1C2029] px-2 py-1 rounded border border-[#374151]">
         <input
            type="text"
            value={nano.name}
            onChange={(e) => onUpdateNanoConfig(nano.id, { name: e.target.value })}
            disabled={data.mode === 'OTOMATİK'}
            className="bg-transparent text-[11px] font-bold text-gray-300 outline-none w-32 border-b border-transparent focus:border-indigo-500 disabled:opacity-80"
         />
         <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-[9px] font-bold">
               <Activity size={10} className={nano.status === 'ONLINE' ? 'text-green-500' : 'text-red-500'} />
               <span className={nano.status === 'ONLINE' ? 'text-green-400' : 'text-red-400'}>{nano.status}</span>
            </div>
            <button
               onClick={() => onSendNanoCommand(nano.id, 'RESET')}
               className="bg-yellow-900/60 border border-yellow-700/50 hover:bg-yellow-800 hover:text-white text-yellow-500 text-[9px] px-2 py-0.5 rounded transition-colors"
               title="Nano'yu yeniden başlat (Reset)"
            >
               RESET
            </button>
            <button 
              onClick={() => onRemoveNano(nano.id)} 
              disabled={data.mode === 'OTOMATİK'} 
              className="text-gray-500 hover:text-red-400 disabled:opacity-50 p-1"
            >
               <Trash2 size={12} />
            </button>
         </div>
      </div>
      <div className="flex space-x-3">
         <div className="flex-1">
            <label className="block text-[10px] text-gray-500 mb-1">Seri Port (COM)</label>
            <div className="flex space-x-1">
               <input
                  type="text"
                  list={`ports-list-${nano.id}`}
                  value={nano.port || ''}
                  onChange={(e) => onUpdateNanoConfig(nano.id, { port: e.target.value })}
                  disabled={data.mode === 'OTOMATİK'}
                  className="w-full bg-[#151921] border border-[#374151] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50"
                  placeholder="Örn: /dev/ttyUSB0 veya serial 0"
               />
               <datalist id={`ports-list-${nano.id}`}>
                  {Array.from(new Set([...(data.serialPorts || []), ...availablePorts, "serial 0", "serial 1", "/dev/ttyAMA0", "/dev/ttyAMA1"])).map(p => {
                     const inUseBy = data.nanos.find(n => n.id !== nano.id && n.port === p);
                     return (
                       <option key={p} value={p}>
                         {inUseBy ? `(Kullanımda: ${inUseBy.name})` : ''}
                       </option>
                     );
                  })}
               </datalist>
              <button 
                 onClick={handleScan} 
                 disabled={isScanning || data.mode === 'OTOMATİK'} 
                 className="bg-[#1C2029] border border-[#374151] rounded px-2 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-50"
                 title="Portları Yenile"
              >
                 <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              </button>
            </div>
         </div>
         <div className="flex-1">
            <label className="block text-[10px] text-gray-500 mb-1">Baud Rate</label>
            <select 
               value={nano.baudRate || 9600}
               onChange={(e) => onUpdateNanoConfig(nano.id, { baudRate: Number(e.target.value) })}
               disabled={data.mode === 'OTOMATİK'}
               className="w-full bg-[#151921] border border-[#374151] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50"
            >
               <option value={9600}>9600</option>
               <option value={19200}>19200</option>
               <option value={38400}>38400</option>
               <option value={57600}>57600</option>
               <option value={115200}>115200</option>
            </select>
         </div>
      </div>
    </div>
  );
};
