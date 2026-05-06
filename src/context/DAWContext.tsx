import React, { createContext, useContext } from 'react';
import { useDAW } from '../hooks/useDAW';

type DAWContextType = ReturnType<typeof useDAW>;

const DAWContext = createContext<DAWContextType | null>(null);

export const DAWProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const daw = useDAW();
  return <DAWContext.Provider value={daw}>{children}</DAWContext.Provider>;
};

export const useDAWContext = () => {
  const ctx = useContext(DAWContext);
  if (!ctx) throw new Error('useDAWContext must be used within DAWProvider');
  return ctx;
};
