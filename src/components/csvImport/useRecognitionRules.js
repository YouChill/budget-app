import { useEffect, useState } from 'react';

export const RULES_STORAGE_KEY = 'csv_recognition_rules';

// Reguły rozpoznawania użytkownika („opis zawiera X → kategoria"),
// trzymane w localStorage między importami.
export function useRecognitionRules() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RULES_STORAGE_KEY);
      if (saved) setRules(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const save = (next) => {
    setRules(next);
    try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addRule = (rule) => save([...rules, rule]);
  const deleteRule = (index) => save(rules.filter((_, i) => i !== index));

  return { rules, addRule, deleteRule };
}
