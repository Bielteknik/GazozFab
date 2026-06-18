import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData } from '../../../types/system';

interface TerminalTabsPanelProps {
  data: SystemData;
  activeMsgTab: 'LOGS' | 'ALERTS';
  setActiveMsgTab: (tab: 'LOGS' | 'ALERTS') => void;
}

export const TerminalTabsPanel: React.FC<TerminalTabsPanelProps> = ({ 
  data, 
  activeMsgTab, 
  setActiveMsgTab 
}) => {
  return (
    <div className="w-full bg-[#0A0D14] border-t border-[#2D333F] h-40 flex flex-col mt-auto flex-shrink-0 overflow-hidden">
      {/* Tab Buttons */}
      <div className="flex border-b border-[#1F2937] bg-[#0C0F16] shrink-0">
        <button 
          onClick={() => setActiveMsgTab('LOGS')}
          className={cn(
            "px-4 py-1.5 text-[9px] font-bold transition-all border-b-2 flex items-center gap-1.5",
            activeMsgTab === 'LOGS' 
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 font-black" 
              : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          HABERLEŞME MESAJLARI
        </button>
        <button 
          onClick={() => setActiveMsgTab('ALERTS')}
          className={cn(
            "px-4 py-1.5 text-[9px] font-bold transition-all border-b-2 flex items-center gap-1.5",
            activeMsgTab === 'ALERTS' 
              ? "border-orange-500 text-orange-400 bg-orange-500/5 font-black" 
              : "border-transparent text-gray-500 hover:text-gray-300"
          )}
        >
          AKTİF UYARILAR
          {data?.activeAlerts?.filter(a => !a.resolved).length > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded-full text-[8px] font-bold animate-pulse leading-none">
              {data.activeAlerts.filter(a => !a.resolved).length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {activeMsgTab === 'LOGS' ? (
            <div className="space-y-1 font-mono text-[9px]">
              {data.terminalLogs.slice(0, 30).map((log, i) => (
                <div key={i} className={log.includes('ERR') ? 'text-red-400' : 'text-emerald-400/80'}>{log}</div>
              ))}
            </div>
        ) : (
            <div className="space-y-1.5 font-mono text-[9px]">
              {data?.activeAlerts?.filter(a => !a.resolved).length === 0 ? (
                  <div className="h-full py-4 flex items-center justify-center text-gray-500 text-[10px] font-mono">
                    AKTIF_ALARM_YOK
                  </div>
              ) : (
                  data?.activeAlerts?.filter(a => !a.resolved).map((alert, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={alert.id || i} 
                      className={cn(
                        "border p-2 rounded text-[10px] font-mono flex items-start",
                        alert.severity === 'CRITICAL' ? "bg-red-900/30 border-red-800 text-red-400" : "bg-amber-900/30 border-amber-800 text-amber-400"
                      )}
                    >
                      <AlertTriangle size={12} className="mr-2 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{alert.code}</span>
                        <div className="mt-0.5 opacity-80">{alert.message}</div>
                      </div>
                    </motion.div>
                  ))
              )}
            </div>
        )}
      </div>
    </div>
  );
};
