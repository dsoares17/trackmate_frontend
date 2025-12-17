'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { buildTimingDeepLink, normalizeConditions } from '@/lib/deeplinks';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'hasConfirmedTimingDeepLink';
const DEEP_LINK_TIMEOUT_MS = 1200;

// ============================================================
// Types
// ============================================================

type Car = {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
};

type Track = {
  id: string;
  name: string;
  country: string | null;
  length_km: number | null;
};

// UI conditions (more specific, for display)
type UIConditions = '' | 'dry_warm' | 'dry_cool' | 'damp' | 'wet';

// ============================================================
// Component
// ============================================================

export default function TimingPage() {
  const router = useRouter();

  // Data loading state
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cars, setCars] = useState<Car[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Setup selections
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [conditions, setConditions] = useState<UIConditions>('');

  // Confirmation state (localStorage-backed)
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);

  // Deep link state
  const [lastDeepLink, setLastDeepLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Refs for controlling behavior
  const hasAutoOpenedRef = useRef(false);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------
  // Deep Link Builder (using shared helper with normalization)
  // --------------------------------------------------------

  const getDeepLink = useCallback((): string | null => {
    if (!selectedTrackId) return null;

    // Normalize UI conditions to deep link conditions (dry_warm/dry_cool -> dry)
    const normalizedConditions = conditions ? normalizeConditions(conditions) : undefined;

    return buildTimingDeepLink({
      trackId: selectedTrackId,
      carId: selectedCarId || undefined,
      conditions: normalizedConditions,
    });
  }, [selectedTrackId, selectedCarId, conditions]);

  // --------------------------------------------------------
  // Load localStorage flag (client-side only)
  // --------------------------------------------------------

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setHasConfirmed(stored === 'true');
    } catch {
      // localStorage not available
    }
    setHasLoadedStorage(true);
  }, []);

  // --------------------------------------------------------
  // Load tracks and cars
  // --------------------------------------------------------

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const [carsRes, tracksRes] = await Promise.all([
        supabase
          .from('cars')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: true }),
        supabase.from('tracks').select('*').order('name', { ascending: true }),
      ]);

      setCars((carsRes.data ?? []) as Car[]);
      setTracks((tracksRes.data ?? []) as Track[]);
      setLoading(false);
    }

    loadData();
  }, []);

  // --------------------------------------------------------
  // Attempt to open timing app
  // --------------------------------------------------------

  const attemptOpenTimingApp = useCallback(() => {
    const url = getDeepLink();
    if (!url) return;

    setLastDeepLink(url);
    setShowFallbackModal(false);

    // Clear any existing timeout
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }

    // Fire the deep link
    window.location.href = url;

    // Start fallback timeout
    fallbackTimeoutRef.current = setTimeout(() => {
      // If document is still visible, deep link likely failed
      if (!document.hidden) {
        setShowFallbackModal(true);
      }
    }, DEEP_LINK_TIMEOUT_MS);
  }, [getDeepLink]);

  // --------------------------------------------------------
  // Auto-open for returning users
  // --------------------------------------------------------

  useEffect(() => {
    // Only auto-open if:
    // 1. Storage has been loaded
    // 2. User has previously confirmed
    // 3. Track is selected
    // 4. Haven't auto-opened yet this session
    // 5. Not currently loading
    if (
      hasLoadedStorage &&
      hasConfirmed &&
      selectedTrackId &&
      !hasAutoOpenedRef.current &&
      !loading
    ) {
      hasAutoOpenedRef.current = true;
      // Small delay to ensure UI has rendered
      setTimeout(() => {
        attemptOpenTimingApp();
      }, 100);
    }
  }, [hasLoadedStorage, hasConfirmed, selectedTrackId, loading, attemptOpenTimingApp]);

  // --------------------------------------------------------
  // Cleanup timeout on unmount
  // --------------------------------------------------------

  useEffect(() => {
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  // --------------------------------------------------------
  // Derived data
  // --------------------------------------------------------

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const selectedCar = cars.find((c) => c.id === selectedCarId);
  const deepLink = getDeepLink();

  // Human-readable conditions for display
  const conditionsDisplay: Record<UIConditions, string> = {
    '': 'Not set',
    dry_warm: 'Dry',
    dry_cool: 'Dry',
    damp: 'Damp',
    wet: 'Wet',
  };

  // --------------------------------------------------------
  // Handlers
  // --------------------------------------------------------

  function handleExit() {
    router.push('/laps');
  }

  function handleOpenTimingAppClick() {
    if (!selectedTrackId) return;

    if (!hasConfirmed) {
      // First-time user: show confirmation modal
      setShowConfirmModal(true);
    } else {
      // Returning user: open immediately
      attemptOpenTimingApp();
    }
  }

  function handleConfirmModalConfirm() {
    // Save preference if checkbox checked
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
        setHasConfirmed(true);
      } catch {
        // localStorage not available
      }
    }

    setShowConfirmModal(false);
    attemptOpenTimingApp();
  }

  function handleConfirmModalCancel() {
    setShowConfirmModal(false);
    setDontShowAgain(false);
  }

  function handleFallbackTryAgain() {
    setShowFallbackModal(false);
    attemptOpenTimingApp();
  }

  function handleFallbackCancel() {
    setShowFallbackModal(false);
  }

  async function handleCopyLink() {
    const linkToCopy = lastDeepLink || deepLink;
    if (!linkToCopy) return;

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  // --------------------------------------------------------
  // Render: Loading
  // --------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // --------------------------------------------------------
  // Render: Not authenticated
  // --------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱️</span>
              <h1 className="text-lg font-bold">Start Timing</h1>
            </div>
            <button
              onClick={handleExit}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Exit
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg text-slate-400">
              Please sign in to use timing features.
            </p>
            <button
              onClick={() => router.push('/')}
              className="rounded-md bg-emerald-500 px-6 py-2 text-white font-medium hover:bg-emerald-600 transition"
            >
              Go to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --------------------------------------------------------
  // Render: Main
  // --------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏱️</span>
            <h1 className="text-lg font-bold">Start Timing</h1>
          </div>
          <button
            onClick={handleExit}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Configure Session</h2>
            <p className="text-slate-400">
              Set up your timing session, then launch the app
            </p>
          </div>

          {/* Setup Form */}
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            {/* Track selector (required) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Track <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
              >
                <option value="">Select a track</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                    {track.country ? ` (${track.country})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Car selector (optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Car <span className="text-slate-500">(optional)</span>
              </label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
              >
                <option value="">No car selected</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.make} {car.model}
                    {car.nickname ? ` (${car.nickname})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Conditions selector (optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Conditions <span className="text-slate-500">(optional)</span>
              </label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={conditions}
                onChange={(e) => setConditions(e.target.value as UIConditions)}
              >
                <option value="">Not set</option>
                <option value="dry_warm">Dry – sunny / warm</option>
                <option value="dry_cool">Dry – cool / overcast</option>
                <option value="damp">Damp</option>
                <option value="wet">Wet</option>
              </select>
            </div>
          </div>

          {/* Selection Summary */}
          {selectedTrackId && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                Session will start with:
              </p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-400">Track:</span>{' '}
                  <span className="font-medium">{selectedTrack?.name}</span>
                </p>
                <p>
                  <span className="text-slate-400">Car:</span>{' '}
                  <span className="font-medium">
                    {selectedCar
                      ? `${selectedCar.make} ${selectedCar.model}`
                      : 'None'}
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">Conditions:</span>{' '}
                  <span className="font-medium">
                    {conditionsDisplay[conditions]}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Launch Button */}
          <button
            onClick={handleOpenTimingAppClick}
            disabled={!selectedTrackId}
            className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-bold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">📱</span>
            Open Timing App
          </button>

          {!selectedTrackId && (
            <p className="text-center text-sm text-slate-500">
              Select a track to continue
            </p>
          )}
        </div>
      </main>

      {/* ============================================ */}
      {/* CONFIRMATION MODAL (first-time users) */}
      {/* ============================================ */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="text-center mb-4">
              <span className="text-4xl">📱</span>
            </div>
            <h3 className="text-xl font-bold text-center mb-2">
              Open Trackmate Timing
            </h3>
            <p className="text-slate-400 text-center text-sm mb-6">
              This will open the Trackmate Timing app with your track and car
              preselected. Make sure you have the app installed on your phone.
            </p>

            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-400">
                Don&apos;t show this again
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmModalCancel}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModalConfirm}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition"
              >
                Open Timing App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* FALLBACK MODAL (deep link failed) */}
      {/* ============================================ */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-center mb-2">
              Timing app didn&apos;t open
            </h3>
            <p className="text-slate-400 text-center text-sm mb-4">
              It looks like the Trackmate Timing app isn&apos;t installed or
              couldn&apos;t be opened. Install the app on your phone to use
              timing features.
            </p>

            {/* Show deep link for copying */}
            {lastDeepLink && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Deep link:</p>
                <div className="rounded-lg bg-slate-950 border border-slate-700 p-3">
                  <code className="text-xs text-emerald-400 break-all select-all">
                    {lastDeepLink}
                  </code>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="mt-2 w-full rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
                >
                  {copied ? '✓ Copied to clipboard!' : 'Copy link'}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleFallbackCancel}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFallbackTryAgain}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
