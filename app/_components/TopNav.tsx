'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    }
    loadUser();
  }, []);

  const isAuthenticated = !!userId;
  const isTimingPage = pathname === '/timing';

  // Build nav items with dynamic Profile link
  const navItems = [
    { href: '/', label: 'Home' },
    { href: userId ? `/driver/${userId}` : '/profile', label: 'Profile' },
    { href: '/cars', label: 'Garage' },
    { href: '/tracks', label: 'Tracks' },
    { href: '/laps', label: 'Laps' },
    { href: '/leaderboards', label: 'Leaderboards' },
    { href: '/drivers', label: 'Drivers' },
  ];

  function handleStartTiming() {
    router.push('/timing');
  }

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-lg font-bold text-slate-100 hover:text-sky-400 transition"
          >
            Trackmate
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition"
              >
                {item.label}
              </Link>
            ))}
            {/* Start timing button - visible only when authenticated */}
            {isAuthenticated && !isTimingPage && (
              <button
                onClick={handleStartTiming}
                className="ml-2 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 transition"
              >
                Start timing
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile FAB - visible only on mobile, when authenticated, and not on /timing */}
      {isAuthenticated && !isTimingPage && (
        <button
          onClick={handleStartTiming}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition md:hidden"
          aria-label="Start timing"
        >
          ⏱️
        </button>
      )}
    </>
  );
}
