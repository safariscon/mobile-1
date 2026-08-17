import { createContext, useContext, useMemo, useState } from 'react';

const PolicyContext = createContext({
  policyKey: null,
  openPolicy: () => {},
  closePolicy: () => {},
});

export function PolicyProvider({ children }) {
  const [policyKey, setPolicyKey] = useState(null);
  const value = useMemo(() => ({
    policyKey,
    openPolicy: (key = 'how-it-works') => setPolicyKey(key),
    closePolicy: () => setPolicyKey(null),
  }), [policyKey]);

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

export function usePolicy() {
  return useContext(PolicyContext);
}
