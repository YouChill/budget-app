import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'yearlyViewHintSeen';
const PULSE_TIMEOUT_MS = 5000;

// First-time visual hint for the yearly-view toggle: persists a flag in
// localStorage so the hint and pulse animation only appear once per device.
export function useYearlyViewHint() {
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [pulseActive, setPulseActive] = useState(() => !localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!pulseActive) return;
    const timer = setTimeout(() => setPulseActive(false), PULSE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pulseActive]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    setPulseActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  return { showHint, pulseActive, dismissHint };
}
