"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { LoaderProvider, Loader, NavigationLoader } from "@/components/ui/Loader";
import { RegistrationCacheProvider } from "@/hooks/useRegistrationCache";
import { api, logout, isAuthenticated } from "@/lib/api-client";

// Lazy load notification prompt - not critical for initial render
const NotificationPrompt = dynamic(
  () => import("@/components/notifications/NotificationPrompt"),
  { ssr: false, loading: () => null }
);

interface User {
  id: number;
  username: string;
  email: string;
  is_host: boolean;
  is_admin?: boolean;
  avatar_url?: string;
}

// Module-level cache for user data - persists across navigations
let cachedUser: User | null = null;
let cachedTeamsCount: number = 0;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const menuItems = [
  { icon: "🏠", label: "Dashboard", href: "/dashboard" },
  { icon: "👤", label: "Profile", href: "/profile" },
  { icon: "👥", label: "My Teams", href: "/my-teams" },
  { icon: "💰", label: "Wallet", href: "/wallet", disabled: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamsCount, setTeamsCount] = useState(cachedTeamsCount);
  const [initialLoading, setInitialLoading] = useState(!cachedUser);
  const pathname = usePathname();
  const router = useRouter();
  const fetchedRef = useRef(false);

  const fetchUserData = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated via cookie
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    // Use cache if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
      setUser(cachedUser);
      setTeamsCount(cachedTeamsCount);
      setInitialLoading(false);
      return;
    }

    try {
      // Fetch user and teams in parallel using secure API client
      const [userData, teamsData] = await Promise.all([
        api<User>("/api/auth/me"),
        api<{ teams: unknown[] }>("/api/teams/my-teams"),
      ]);

      if (userData.success && userData.data) {
        cachedUser = userData.data;
        cacheTimestamp = Date.now();
        setUser(userData.data);
      } else {
        cachedUser = null;
        router.push("/login");
        return;
      }

      if (teamsData.success && teamsData.data) {
        const count = teamsData.data.teams?.length || 0;
        cachedTeamsCount = count;
        setTeamsCount(count);
      }
    } catch {
      cachedUser = null;
      router.push("/login");
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Prevent duplicate fetches in development strict mode
    if (fetchedRef.current) {
      // Already fetched, just make sure loading is false
      if (cachedUser) {
        setInitialLoading(false);
        setUser(cachedUser);
        setTeamsCount(cachedTeamsCount);
      }
      return;
    }
    fetchedRef.current = true;
    
    fetchUserData();
  }, [fetchUserData]);

  const handleLogout = async () => {
    // Clear cache
    cachedUser = null;
    cachedTeamsCount = 0;
    cacheTimestamp = 0;
    // Use secure logout (clears httpOnly cookies server-side and redirects)
    await logout();
  };

  const isAdminOrHost = user?.is_admin === true || user?.is_host === true;

  // Show blob loader while loading - only on first load
  // Use initialLoading as the primary condition, user check is secondary
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader message="Loading your dashboard..." />
      </div>
    );
  }

  // If not loading but no user, redirect is already in progress
  if (!user) {
    return null;
  }

  return (
    <LoaderProvider>
      <RegistrationCacheProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-4 z-50 transform transition-transform lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-bold text-gray-900">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-xl hover:bg-gray-100 p-1 rounded"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-1">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.disabled ? "#" : item.href}
              onClick={() => !item.disabled && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : item.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-500"
                    : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.label === "My Teams" && teamsCount > 0 && (
                <span className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">
                  {teamsCount}
                </span>
              )}
              {item.disabled && (
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </Link>
          ))}
          {isAdminOrHost && (
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-900 border border-gray-200 mt-4"
            >
              ⚙️ Admin Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full mt-4"
          >
            🚪 Logout
          </button>
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-4 hidden lg:flex flex-col">
        <div className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          Esports Platform
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-6 flex items-center gap-3">
          <Image
            src={`https://ui-avatars.com/api/?name=${user.username}&background=111827&color=fff`}
            alt={user.username}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-500">
              {isAdminOrHost ? "Host" : "Player"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.disabled ? "#" : item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : item.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-500"
                    : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.label === "My Teams" && teamsCount > 0 && (
                <span className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">
                  {teamsCount}
                </span>
              )}
              {item.disabled && (
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </Link>
          ))}
        </nav>

        {isAdminOrHost && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-900 border border-gray-200 mb-2"
          >
            ⚙️ Admin Panel
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full"
        >
          🚪 Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-bold text-gray-900 flex items-center gap-2">
            Esports Platform
          </span>
          <div className="w-10"></div>
        </header>

        <div className="p-6">{children}</div>
      </main>

      {/* Notification Permission Prompt */}
      <NotificationPrompt showOnDenied />
      
      {/* Navigation Loader - shows during page transitions */}
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      </div>
      </RegistrationCacheProvider>
    </LoaderProvider>
  );
}