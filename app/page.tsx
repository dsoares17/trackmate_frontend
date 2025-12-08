'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TopNav from './_components/TopNav';

type User = {
  id: string;
  email?: string;
};

type Lap = {
  id: string;
  track_id: string;
  lap_time_ms: number;
};

type Track = {
  id: string;
  name: string;
};

function formatLapTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  const secStr = seconds.toString().padStart(2, '0');
  const msStr = millis.toString().padStart(3, '0');

  return `${minutes}:${secStr}.${msStr}`;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPublicLaps, setUserPublicLaps] = useState<Lap[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user as User | null;
      setUser(currentUser);

      if (currentUser) {
        // Load user's public laps and all tracks
        const [lapsRes, tracksRes] = await Promise.all([
          supabase
            .from('laps')
            .select('id, track_id, lap_time_ms')
            .eq('user_id', currentUser.id)
            .eq('is_public', true)
            .order('lap_time_ms', { ascending: true }),
          supabase.from('tracks').select('id, name'),
        ]);

        if (!lapsRes.error) {
          setUserPublicLaps((lapsRes.data ?? []) as Lap[]);
        }
        if (!tracksRes.error) {
          setTracks((tracksRes.data ?? []) as Track[]);
        }
      }

      setLoading(false);
    }
    loadData();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading...</p>
        </main>
      </>
    );
  }

  // Not logged in: marketing-ish landing
  if (!user) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold tracking-tight">
              Trackmate
            </h1>
            <p className="text-lg text-slate-300 max-w-md mx-auto">
              Own your lap times. Share your progress. Keep all your cars, tracks, and sessions in one place.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/signup')}
                className="rounded-md bg-sky-500 px-6 py-2 text-sm font-semibold hover:bg-sky-600 transition"
              >
                Sign up
              </button>
              <button
                onClick={() => router.push('/login')}
                className="rounded-md border border-slate-600 px-6 py-2 text-sm font-semibold hover:bg-slate-800 transition"
              >
                Log in
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Logged in: dashboard with stats
  const totalPublicLaps = userPublicLaps.length;
  const trackIds = new Set(userPublicLaps.map((lap) => lap.track_id));
  const tracksDrivenCount = trackIds.size;
  const bestOverallLap = userPublicLaps.length > 0 ? userPublicLaps[0] : null;
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Welcome Header */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h1 className="text-2xl font-bold">Welcome back!</h1>
            <p className="text-sm text-slate-400 mt-1">
              Logged in as {user.email ?? 'driver'}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
              <div className="text-center">
                <p className="text-2xl font-bold text-sky-400">{totalPublicLaps}</p>
                <p className="text-xs text-slate-400">Public Laps</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-sky-400">{tracksDrivenCount}</p>
                <p className="text-xs text-slate-400">Tracks Driven</p>
              </div>
              {bestOverallLap && (
                <>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{formatLapTime(bestOverallLap.lap_time_ms)}</p>
                    <p className="text-xs text-slate-400">Best Lap</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-300 truncate">{trackMap.get(bestOverallLap.track_id)?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">Best Track</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/laps')}
                className="rounded-md bg-sky-500 px-4 py-3 text-sm font-semibold hover:bg-sky-600 transition"
              >
                + Add Lap
              </button>
              <button
                onClick={() => router.push('/leaderboards')}
                className="rounded-md bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700 transition"
              >
                Leaderboards
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="rounded-md bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700 transition"
              >
                Profile
              </button>
              <button
                onClick={() => router.push('/cars')}
                className="rounded-md bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700 transition"
              >
                Garage
              </button>
              <button
                onClick={() => router.push('/tracks')}
                className="rounded-md bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700 transition"
              >
                Tracks
              </button>
              <button
                onClick={() => router.push(`/driver/${user.id}`)}
                className="rounded-md bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700 transition"
              >
                My Public Profile
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition"
          >
            Logout
          </button>
        </div>
      </main>
    </>
  );
}
