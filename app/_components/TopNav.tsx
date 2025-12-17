'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// CTA states for AUTHENTICATED users only
// 'loading' = checking readiness after auth confirmed
// 'ready' = can start timing
// 'error' = something went wrong, show reason
type TimingCtaState = 'loading' | 'ready' | 'error';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Auth state: null = unknown/loading, false = signed out, true = signed in
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // CTA state (only relevant when authenticated)
  const [ctaState, setCtaState] = useState<TimingCtaState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check auth and update state
  const checkAuth = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('TopNav auth error:', error.message);
        setIsAuthenticated(false);
        setUserId(null);
        return;
      }
      if (data.user) {
        setIsAuthenticated(true);
        setUserId(data.user.id);
        setCtaState('ready');
        setErrorMessage(null);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    } catch (err) {
      console.error('TopNav unexpected error:', err);
      setIsAuthenticated(false);
      setUserId(null);
    }
  }, []);

  // Retry function for error state
  const handleRetry = useCallback(() => {
    setCtaState('loading');
    setErrorMessage(null);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Initial auth check
    checkAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthenticated(true);
          setUserId(session.user.id);
          setCtaState('ready');
          setErrorMessage(null);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserId(null);
          setCtaState('loading'); // Reset for next login
          setErrorMessage(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Keep authenticated state
          setIsAuthenticated(true);
          setUserId(session.user.id);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth]);

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
    if (ctaState === 'ready') {
      router.push('/timing');
    }
    // loading/error states are disabled, no action
  }

  // CTA is only rendered for authenticated users
  // Determine button appearance and behavior
  const isCtaDisabled = ctaState === 'loading' || ctaState === 'error';
  const ctaLabel =
    ctaState === 'loading'
      ? 'Checking…'
      : ctaState === 'error'
      ? 'Start timing'
      : 'Start timing';

  const helperText =
    ctaState === 'loading'
      ? 'Checking…'
      : ctaState === 'error'
      ? errorMessage ?? 'Error'
      : null;

  const buttonClasses =
    isCtaDisabled
      ? 'rounded-md bg-slate-600 px-3 py-1.5 text-sm font-medium text-slate-400 cursor-not-allowed'
      : 'rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 transition';

  // Mobile FAB classes
  const fabClasses =
    isCtaDisabled
      ? 'fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-600 text-2xl text-slate-400 shadow-lg cursor-not-allowed md:hidden'
      : 'fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition md:hidden';

  // Should we show the timing CTA?
  // Only show when: authenticated === true AND not on /timing page
  const showTimingCta = isAuthenticated === true && !isTimingPage;

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
            {/* Start timing CTA - ONLY visible when authenticated */}
            {showTimingCta && (
              <div className="ml-2 flex flex-col items-center">
                <button
                  onClick={handleStartTiming}
                  disabled={isCtaDisabled}
                  className={buttonClasses}
                >
                  {ctaLabel}
                </button>
                {helperText && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">
                      {helperText}
                    </span>
                    {ctaState === 'error' && (
                      <button
                        onClick={handleRetry}
                        className="text-[10px] text-sky-400 hover:text-sky-300 underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile FAB - ONLY visible when authenticated and not on /timing */}
      {showTimingCta && (
        <button
          onClick={handleStartTiming}
          disabled={isCtaDisabled}
          className={fabClasses}
          aria-label={ctaLabel}
        >
          ⏱️
        </button>
      )}
    </>
  );
}
