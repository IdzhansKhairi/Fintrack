"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationLoadingContextType {
  isNavigating: boolean;
  startNavigation: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType>({
  isNavigating: false,
  startNavigation: () => {},
});

export const useNavigationLoading = () => useContext(NavigationLoadingContext);

export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // When pathname changes, navigation is complete — hide overlay
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  return (
    <NavigationLoadingContext.Provider value={{ isNavigating, startNavigation }}>
      {children}
    </NavigationLoadingContext.Provider>
  );
}
