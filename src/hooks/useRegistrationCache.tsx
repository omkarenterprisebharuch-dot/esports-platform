"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { secureFetch, isAuthenticated } from "@/lib/api-client";

interface RegistrationCacheContextType {
  /** Set of tournament IDs the user is registered for */
  registeredIds: Set<number>;
  /** Whether the cache is currently loading */
  loading: boolean;
  /** Whether the cache has been fetched at least once */
  fetched: boolean;
  /** Check if user is registered for a specific tournament */
  isRegistered: (tournamentId: number) => boolean;
  /** Force refresh the registration cache */
  refresh: () => Promise<void>;
  /** Add a tournament ID to the cache (after successful registration) */
  addRegistration: (tournamentId: number) => void;
  /** Remove a tournament ID from the cache (after cancellation) */
  removeRegistration: (tournamentId: number) => void;
}

// Module-level cache to persist across navigations
let cachedRegisteredIds: Set<number> = new Set();
let cacheTimestamp: number = 0;
let cacheFetched: boolean = false;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const RegistrationCacheContext = createContext<RegistrationCacheContextType | undefined>(undefined);

/**
 * Provider that caches user's registered tournament IDs
 * This is a lightweight cache - only stores IDs, not full registration data
 * Use this to show "Already Registered" badges without fetching full registration data
 */
export function RegistrationCacheProvider({ children }: { children: ReactNode }) {
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(cachedRegisteredIds);
  const [loading, setLoading] = useState(!cacheFetched);
  const [fetched, setFetched] = useState(cacheFetched);

  const fetchRegistrationIds = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated via cookie
    if (!isAuthenticated()) {
      setRegisteredIds(new Set());
      setLoading(false);
      setFetched(true);
      return;
    }

    // Use cache if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cacheFetched && (now - cacheTimestamp) < CACHE_DURATION) {
      setRegisteredIds(cachedRegisteredIds);
      setLoading(false);
      setFetched(true);
      return;
    }

    setLoading(true);

    try {
      // Use secureFetch which handles cookies automatically
      const response = await secureFetch("/api/registrations/my-registrations?fields=tournament_id");
      const data = await response.json();

      if (data.success) {
        const registrations = data.data?.registrations || [];
        const ids = new Set<number>(
          registrations.map((reg: { tournament_id: number }) => reg.tournament_id)
        );
        cachedRegisteredIds = ids;
        cacheTimestamp = Date.now();
        cacheFetched = true;
        setRegisteredIds(ids);
      }
    } catch (error) {
      console.error("Failed to fetch registration IDs:", error);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  const isRegistered = useCallback((tournamentId: number) => {
    return registeredIds.has(tournamentId);
  }, [registeredIds]);

  const addRegistration = useCallback((tournamentId: number) => {
    const newIds = new Set(registeredIds);
    newIds.add(tournamentId);
    cachedRegisteredIds = newIds;
    setRegisteredIds(newIds);
  }, [registeredIds]);

  const removeRegistration = useCallback((tournamentId: number) => {
    const newIds = new Set(registeredIds);
    newIds.delete(tournamentId);
    cachedRegisteredIds = newIds;
    setRegisteredIds(newIds);
  }, [registeredIds]);

  // Fetch on mount
  useEffect(() => {
    fetchRegistrationIds();
  }, [fetchRegistrationIds]);

  return (
    <RegistrationCacheContext.Provider
      value={{
        registeredIds,
        loading,
        fetched,
        isRegistered,
        refresh: () => fetchRegistrationIds(true),
        addRegistration,
        removeRegistration,
      }}
    >
      {children}
    </RegistrationCacheContext.Provider>
  );
}

/**
 * Hook to access the registration cache
 * Must be used within a RegistrationCacheProvider
 */
export function useRegistrationCache() {
  const context = useContext(RegistrationCacheContext);
  if (!context) {
    throw new Error("useRegistrationCache must be used within a RegistrationCacheProvider");
  }
  return context;
}

/**
 * Clear the registration cache (call on logout)
 */
export function clearRegistrationCache() {
  cachedRegisteredIds = new Set();
  cacheTimestamp = 0;
  cacheFetched = false;
}
