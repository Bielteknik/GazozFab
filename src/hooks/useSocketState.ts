/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SystemData, SystemMode, AutoState, ValveState, GateState, NanoState, SensorState, SystemConfig, Recipe } from '../types/system';

// Clean initial system state (factory defaults / no mock data)
export const INITIAL_STATE: SystemData = {
  mode: 'BASLATMA',
  autoState: 'BEKLEMEDE',
  inputCount: 0,
  outputCount: 0,
  tankLevelCm: 85,
  valves: [],
  nanos: [],
  sensors: [],
  terminalLogs: ['Sistem Başlatıldı. Bağlantı bekleniyor...'],
  serialPorts: [],
  inputGate: { id: 'GATE-IN', name: 'Giriş Kapısı', isOpen: false, position: 0, enabled: true, pin: 'G1', device: 'NANO' },
  outputGate: { id: 'GATE-OUT', name: 'Çıkış Kapısı', isOpen: false, position: 0, enabled: true, pin: 'G2', device: 'NANO' },
  extraGates: [],
  cycleHistory: [],
  activeAlerts: [],
  config: {
    recipeId: '',
    volumeMl: 0,
    targetCount: 0, 
    fillTimeMs: 0, 
    settlingTimeMs: 0, 
    dripWaitTimeMs: 0, 
    inputDebounceMs: 50, 
    outputDebounceMs: 50,
    gateSpeedPercent: 100,
    watchdogTimeoutMs: 15000,
    maxRetries: 3,
    relayInversion: false,
    autoRecovery: true,
    manualValveMaxOpenTimeMs: 5000,
    logLevel: 'INFO',
    heartbeatIntervalMs: 5000,
    enableMqtt: false,
    mqttBrokerUrl: '',
    autoCleanEnabled: false,
    autoCleanIntervalCount: 0,
    maxTemperatureThreshold: 60,
    voltageWarningLimit: 12.0,
    emergencyStopBehavior: 'SAFE_HOME',
    washDurationMs: 30000,
    washValveIntervalMs: 2000,
    ultrasonicDevice: 'RASPI',
    ultrasonicTrigPin: '23',
    ultrasonicEchoPin: '24',
    ultrasonicMaxHeightCm: 100,
    ultrasonicCriticalLowPercent: 15,
    ultrasonicDebounceMs: 100,
    ultrasonicMeasurementType: 'CONTINUOUS',
    ultrasonicMeasurementIntervalMl: 2000
  },
  recipes: [],
  isWashingDone: false,
  isWashingRequired: false,
  stopAfterCycleRequested: false,
  activePrompt: null
};

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;

export function useSocketState() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<SystemData>(INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      console.log('[Socket] Connected to Backend');
      setIsConnected(true);
      newSocket.emit('GET_STATE');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from Backend');
      setIsConnected(false);
    });

    newSocket.on('STATE_UPDATE', (newState: SystemData) => {
      setData(newState);
    });

    newSocket.on('AVAILABLE_PORTS', (ports: string[]) => {
      setData(prev => ({ ...prev, serialPorts: ports }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emitAction = useCallback((actionType: string, payload?: any) => {
    if (socket && isConnected) {
      console.log(`[Socket] Action: ${actionType}`, payload);
      socket.emit('ACTION', { type: actionType, payload });
    }
  }, [socket, isConnected]);

  return {
    socket,
    data,
    isConnected,
    manualToken: "AUTHORIZED", // Mock token for compatibility
    manualExpires: null,
    manualLogin: () => {}, // No longer needed
    manualLogout: () => {
      emitAction('SOFT_REBOOT');
    },
    setMode: (mode: SystemMode) => {
      emitAction('SET_MODE', { mode });
      if (!isConnected) setData(prev => ({ ...prev, mode }));
    },
    startAutoCycle: () => emitAction('START_AUTO_CYCLE'),
    acknowledgeStartup: () => emitAction('ACKNOWLEDGE_STARTUP'),
    acknowledgeFault: () => emitAction('ACKNOWLEDGE_FAULT'),
    toggleValve: (id: number) => {
      emitAction('TOGGLE_VALVE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.map(v => v.id === id ? { ...v, isOpen: !v.isOpen } : v)
      }));
    },
    setValveMode: (id: number, mode: 'MANUAL' | 'AUTO' | 'PULSE' | 'CONTINUOUS') => {
      emitAction('SET_VALVE_MODE', { id, mode });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.map(v => v.id === id ? { ...v, mode: mode === 'MANUAL' || mode === 'AUTO' ? 'CONTINUOUS' : mode } : v)
      }));
    },
    setValvePulseDuration: (id: number, duration: number) => {
      emitAction('SET_VALVE_PULSE', { id, duration });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.map(v => v.id === id ? { ...v, pulseDuration: duration } : v)
      }));
    },
    operateGate: (target: 'inputGate' | 'outputGate', position: number) => {
      emitAction('OPERATE_GATE', { target, position });
      if (!isConnected) setData(prev => ({
        ...prev,
        [target]: { ...prev[target], position, isOpen: position > 0 }
      }));
    },
    toggleGateEnabled: (target: 'inputGate' | 'outputGate') => {
      emitAction('TOGGLE_GATE_ENABLED', { target });
      if (!isConnected) setData(prev => ({
        ...prev,
        [target]: { ...prev[target], enabled: !prev[target].enabled }
      }));
    },
    triggerFault: (type?: string) => emitAction('TRIGGER_FAULT', { type }),
    updateConfig: (config: Partial<SystemConfig>) => {
      emitAction('UPDATE_CONFIG', { config });
      if (!isConnected) setData(prev => ({
        ...prev,
        config: { ...prev.config, ...config }
      }));
    },
    addHardware: () => {
      const usedIds = new Set(data.valves.map(v => v.id));
      let nextId = 10;
      for (let id = 10; id <= 18; id++) { if (!usedIds.has(id)) { nextId = id; break; } }
      if (nextId > 18) return;
      const pinMap: Record<number, string> = { 10: '2', 11: '3', 12: '4', 13: '5', 14: '6', 15: '7', 16: '8', 17: '11', 18: '12' };
      const valve = { id: nextId, name: `Vana ${nextId - 9}`, isOpen: false, mode: 'CONTINUOUS' as const, enabled: true, pin: pinMap[nextId], device: 'NANO' as const, relayInversion: false };
      emitAction('ADD_VALVE', { valve });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: [...prev.valves, valve]
      }));
    },
    removeHardware: (id: number) => {
      emitAction('REMOVE_VALVE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.filter(v => v.id !== id)
      }));
    },
    toggleHardwareStatus: (id: number) => {
      emitAction('TOGGLE_HARDWARE_STATUS', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v)
      }));
    },
    sendNanoCommand: (nanoId: string, cmd: string) => emitAction('SEND_NANO_COMMAND', { nanoId, cmd }),
    updateNanoConfig: (id: string, config: Partial<NanoState>) => {
      emitAction('UPDATE_NANO_CONFIG', { id, config });
      if (!isConnected) setData(prev => ({
        ...prev,
        nanos: prev.nanos.map(n => n.id === id ? { ...n, ...config } : n)
      }));
    },
    updateValve: (id: number, updates: Partial<ValveState>) => {
      emitAction('UPDATE_VALVE', { id, updates });
      if (!isConnected) setData(prev => ({
        ...prev,
        valves: prev.valves.map(v => v.id === id ? { ...v, ...updates } : v)
      }));
    },
    updateSensor: (id: string, updates: Partial<SensorState>) => {
      emitAction('UPDATE_SENSOR', { id, updates });
      if (!isConnected) setData(prev => ({
        ...prev,
        sensors: prev.sensors.map(s => s.id === id ? { ...s, ...updates } : s)
      }));
    },
    updateGate: (id: string, updates: Partial<GateState>) => {
      emitAction('UPDATE_GATE', { id, updates });
      if (!isConnected) setData(prev => ({
        ...prev,
        extraGates: prev.extraGates.map(g => g.id === id ? { ...g, ...updates } : g)
      }));
    },
    updateSystemGate: (target: 'inputGate' | 'outputGate', updates: Partial<GateState>) => {
      emitAction('UPDATE_SYSTEM_GATE', { target, updates });
      if (!isConnected) setData(prev => ({
        ...prev,
        [target]: { ...prev[target], ...updates }
      }));
    },
    toggleSensorEnabled: (id: string) => {
      emitAction('TOGGLE_SENSOR_ENABLED', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        sensors: prev.sensors.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
      }));
    },
    addSensor: () => {
      const hasIn = data.sensors.some(s => s.id === 'SENS-IN');
      const hasOut = data.sensors.some(s => s.id === 'SENS-OUT');
      let sensor;
      if (!hasIn) {
        sensor = { id: 'SENS-IN', name: 'Giriş Lazeri', type: 'INPUT' as const, pin: '17', enabled: true, device: 'RASPI' as const };
      } else if (!hasOut) {
        sensor = { id: 'SENS-OUT', name: 'Çıkış Lazeri', type: 'OUTPUT' as const, pin: '27', enabled: true, device: 'RASPI' as const };
      } else {
        sensor = { id: `SENS-${Date.now()}`, name: 'Ek Sayaç Sensörü', type: 'INPUT' as const, pin: '0', enabled: true, device: 'RASPI' as const };
      }
      emitAction('ADD_SENSOR', { sensor });
      if (!isConnected) setData(prev => ({
        ...prev,
        sensors: [...prev.sensors, sensor]
      }));
    },
    removeSensor: (id: string) => {
      emitAction('REMOVE_SENSOR', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        sensors: prev.sensors.filter(s => s.id !== id)
      }));
    },
    addGate: () => {
      const gate = { id: `GATE-${Date.now()}`, name: 'Yeni Kilit', pin: '0', isOpen: false, enabled: true, position: 0, device: 'NANO' as const };
      emitAction('ADD_GATE', { gate });
      if (!isConnected) setData(prev => ({
        ...prev,
        extraGates: [...prev.extraGates, gate]
      }));
    },
    removeGate: (id: string) => {
      emitAction('REMOVE_GATE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        extraGates: prev.extraGates.filter(g => g.id !== id)
      }));
    },
    toggleExtraGateEnabled: (id: string) => {
      emitAction('TOGGLE_GATE_ENABLED', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        extraGates: prev.extraGates.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g)
      }));
    },
    operateExtraGate: (id: string) => {
      emitAction('OPERATE_EXTRA_GATE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        extraGates: prev.extraGates.map(g => g.id === id ? { ...g, isOpen: !g.isOpen } : g)
      }));
    },
    addNano: () => {
      const nano = { id: `NANO-${Date.now()}`, name: 'Yeni Nano', port: '/dev/ttyUSB0', status: 'OFFLINE' as const, pingMs: 0, baudRate: 115200 };
      emitAction('ADD_HARDWARE', { nano });
      if (!isConnected) setData(prev => ({
        ...prev,
        nanos: [...prev.nanos, nano]
      }));
    },
    removeNano: (id: string) => {
      emitAction('REMOVE_HARDWARE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        nanos: prev.nanos.filter(n => n.id !== id)
      }));
    },
    resetCounter: (target: 'input' | 'output', op: 'inc' | 'dec' | 'reset' = 'reset') => {
      emitAction('MANAGE_COUNTER', { target, op });
      if (!isConnected) setData(prev => {
        const key = target === 'input' ? 'inputCount' : 'outputCount';
        let val = prev[key];
        if (op === 'inc') val++;
        else if (op === 'dec') val = Math.max(0, val - 1);
        else val = 0;
        return { ...prev, [key]: val };
      });
    },
    testValvePulse: (id: number, duration: number) => emitAction('TEST_VALVE_PULSE', { id, duration }),
    selectRecipe: (id: string) => {
      emitAction('SELECT_RECIPE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        config: { ...prev.config, recipeId: id }
      }));
    },
    updateRecipe: (id: string, updates: Partial<Recipe>) => {
      emitAction('UPDATE_RECIPE', { id, updates });
      if (!isConnected) setData(prev => ({
        ...prev,
        recipes: prev.recipes.map(r => r.id === id ? { ...r, ...updates } : r)
      }));
    },
    addRecipe: (recipe: Recipe) => {
      emitAction('ADD_RECIPE', { recipe });
      if (!isConnected) setData(prev => ({
        ...prev,
        recipes: [...prev.recipes, recipe]
      }));
    },
    removeRecipe: (id: string) => {
      emitAction('REMOVE_RECIPE', { id });
      if (!isConnected) setData(prev => ({
        ...prev,
        recipes: prev.recipes.filter(r => r.id !== id)
      }));
    },
    answerPrompt: (answer: boolean) => {
      emitAction('ANSWER_PROMPT', { answer });
      if (!isConnected) setData(prev => ({ ...prev, activePrompt: null }));
    },
    requestStopAfterCycle: () => {
      emitAction('REQUEST_STOP_AFTER_CYCLE');
      if (!isConnected) setData(prev => ({ ...prev, stopAfterCycleRequested: !prev.stopAfterCycleRequested }));
    },
    stopWashing: () => {
      emitAction('SET_MODE', { mode: 'BEKLEMEDE' });
      if (!isConnected) setData(prev => ({ ...prev, mode: 'BEKLEMEDE' }));
    },
    startFlush: () => {
      emitAction('SET_MODE', { mode: 'TAHLIYE' });
      if (!isConnected) setData(prev => ({ ...prev, mode: 'TAHLIYE' }));
    },
    stopFlush: () => {
      emitAction('SET_MODE', { mode: 'BEKLEMEDE' });
      if (!isConnected) setData(prev => ({ ...prev, mode: 'BEKLEMEDE' }));
    },
    startOperatorFill: (method?: 'SEQUENTIAL' | 'CONCURRENT') => emitAction('START_OPERATOR_FILL', { method }),
    resetGates: () => emitAction('RESET_GATES'),
    systemReset: () => {
      emitAction('SYSTEM_RESET');
      if (!isConnected) setData(INITIAL_STATE);
    },
    softReboot: () => {
      emitAction('SOFT_REBOOT');
    }
  };
}
