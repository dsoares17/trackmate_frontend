'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../../_components/TopNav';
import Link from 'next/link';

type Profile = {
  id: string;
  display_name: string | null;
  is_public_profile: boolean | null;
  avatar_url: string | null;
};

type Car = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  nickname: string | null;
};

type Lap = {
  id: string;
  user_id: string;
  car_id: string;
  track_id: string;
  lap_time_ms: number;
  date: string | null;
  is_public: boolean | null;
};

type Track = {
  id: string;
  name: string;
  country: string | null;
  length_km: number | null;
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

export default function DriverProfilePage() {
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);

      // Get viewer (may or may not be logged in)
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id ?? null;
      setViewerId(currentUserId);

      // Load data in parallel
      const [profileRes, carsRes, lapsRes, tracksRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, is_public_profile, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('cars').select('*').eq('user_id', userId),
        supabase.from('laps').select('*').eq('user_id', userId).eq('is_public', true).order('lap_time_ms', { ascending: true }),
        supabase.from('tracks').select('id, name, country, length_km'),
      ]);

      if (profileRes.error) {
        setErrorMsg(profileRes.error.message);
        setLoading(false);
        return;
      }

      if (!profileRes.data) {
        setErrorMsg('Driver not found.');
        setLoading(false);
        return;
      }

      if (carsRes.error) {
        setErrorMsg(carsRes.error.message);
        setLoading(false);
        return;
      }

      if (lapsRes.error) {
        setErrorMsg(lapsRes.error.message);
        setLoading(false);
        return;
      }

      if (tracksRes.error) {
        setErrorMsg(tracksRes.error.message);
        setLoading(false);
        return;
      }

      setProfile(profileRes.data as Profile);
      setCars((carsRes.data ?? []) as Car[]);
      setLaps((lapsRes.data ?? []) as Lap[]);
      setTracks((tracksRes.data ?? []) as Track[]);
      setLoading(false);
    }

    if (userId) {
      loadData();
    }
  }, [userId]);

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading driver profile...</p>
        </main>
      </>
    );
  }

  if (errorMsg || !profile) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p className="text-red-400">{errorMsg || 'Driver not found.'}</p>
        </main>
      </>
    );
  }

  const isOwnProfile = viewerId === profile.id;
  const isPublicProfile = profile.is_public_profile ?? true;

  // If profile is private and viewer is not the owner, show private message
  if (!isPublicProfile && !isOwnProfile) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p className="text-slate-400">This driver&apos;s profile is private.</p>
        </main>
      </>
    );
  }

  // Build maps
  const carMap = new Map(cars.map((c) => [c.id, c]));
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  // Compute PB per track (laps are already sorted by lap_time_ms ascending)
  const pbByTrack = new Map<string, Lap>();
  for (const lap of laps) {
    if (!pbByTrack.has(lap.track_id)) {
      pbByTrack.set(lap.track_id, lap);
    }
  }

  // Get recent laps (sorted by date descending, take last 10)
  const recentLaps = [...laps]
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    })
    .slice(0, 10);

  // Compute driver stats from existing data
  const totalPublicLaps = laps.length;
  const trackIds = new Set(laps.map((lap) => lap.track_id));
  const tracksDrivenCount = trackIds.size;
  const bestOverallLap = laps.length > 0 ? laps[0] : null; // laps already sorted by time
  const bestOverallTrackName = bestOverallLap ? trackMap.get(bestOverallLap.track_id)?.name : null;

  const displayName = profile.display_name || 'Unknown driver';
  const avatarInitial = displayName.charAt(0).toUpperCase() || '?';

  function handleShare() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-5xl space-y-6">

          {/* ===== 1) HERO BANNER ===== */}
          <section className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left side */}
            <div className="flex items-center gap-4">
              {/* Avatar */}
              {profile.avatar_url ? (
                <button
                  onClick={() => setIsAvatarOpen(true)}
                  className="h-16 w-16 shrink-0 rounded-full border-2 border-sky-500/50 bg-slate-900 overflow-hidden flex items-center justify-center text-2xl font-bold text-sky-400 hover:border-sky-400 transition cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-full border-2 border-sky-500/50 bg-slate-900 overflow-hidden flex items-center justify-center text-2xl font-bold text-sky-400">
                  <span>{avatarInitial}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {displayName}
                  {isOwnProfile && (
                    <span className="ml-2 text-sm font-normal text-slate-400">(You)</span>
                  )}
                </h1>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {isOwnProfile && (
                <Link
                  href="/profile"
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:border-sky-500 hover:text-sky-300 transition"
                >
                  Edit profile
                </Link>
              )}
              <button
                onClick={handleShare}
                className="rounded-md border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20 transition"
              >
                {copied ? 'Copied!' : 'Share profile'}
              </button>
            </div>
          </section>

          {/* ===== 2) STATS BAR ===== */}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
              <p className="text-3xl font-bold text-sky-400">{tracksDrivenCount}</p>
              <p className="text-sm text-slate-400">Tracks driven</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
              <p className="text-3xl font-bold text-sky-400">{totalPublicLaps}</p>
              <p className="text-sm text-slate-400">Public laps</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
              {bestOverallLap ? (
                <>
                  <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                    {formatLapTime(bestOverallLap.lap_time_ms)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Best lap{bestOverallTrackName ? ` at ${bestOverallTrackName}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-medium text-slate-500">—</p>
                  <p className="text-sm text-slate-400">No public laps yet</p>
                </>
              )}
            </div>
          </section>

          {/* ===== 3) GARAGE SECTION ===== */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-sky-400">🚗</span> Garage
              <span className="ml-auto text-sm font-normal text-slate-500">{cars.length} car{cars.length !== 1 ? 's' : ''}</span>
            </h2>
            {cars.length === 0 ? (
              <p className="text-sm text-slate-400">No cars in the garage yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {cars.map((car) => (
                  <div
                    key={car.id}
                    className="rounded-md border border-slate-700 bg-slate-800/50 px-4 py-3"
                  >
                    <p className="font-medium">
                      {car.make} {car.model}
                      {car.year ? <span className="text-slate-400 ml-1">({car.year})</span> : ''}
                    </p>
                    {car.nickname && (
                      <p className="text-sm text-slate-500 italic">&quot;{car.nickname}&quot;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ===== 4) TRACK PBs SECTION ===== */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-emerald-400">🏁</span> Personal Bests
              <span className="ml-auto text-sm font-normal text-slate-500">{pbByTrack.size} track{pbByTrack.size !== 1 ? 's' : ''}</span>
            </h2>
            {pbByTrack.size === 0 ? (
              <p className="text-sm text-slate-400">No public laps recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(pbByTrack.entries()).map(([trackId, lap]) => {
                  const track = trackMap.get(trackId);
                  const car = carMap.get(lap.car_id);

                  return (
                    <div
                      key={trackId}
                      className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{track?.name ?? 'Unknown track'}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {car ? `${car.make} ${car.model}` : 'Unknown car'}
                          {lap.date ? ` • ${lap.date}` : ''}
                        </p>
                      </div>
                      <div className="text-xl font-bold tabular-nums text-emerald-400 ml-4">
                        {formatLapTime(lap.lap_time_ms)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ===== 5) RECENT LAPS SECTION ===== */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-amber-400">⏱️</span> Recent Laps
            </h2>
            {recentLaps.length === 0 ? (
              <p className="text-sm text-slate-400">No public laps recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {recentLaps.map((lap) => {
                  const track = trackMap.get(lap.track_id);
                  const car = carMap.get(lap.car_id);

                  return (
                    <div
                      key={lap.id}
                      className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{track?.name ?? 'Unknown track'}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {car ? `${car.make} ${car.model}` : 'Unknown car'}
                          {lap.date ? ` • ${lap.date}` : ''}
                        </p>
                      </div>
                      <div className="text-lg font-bold tabular-nums ml-4">
                        {formatLapTime(lap.lap_time_ms)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Avatar Lightbox Modal */}
      {isAvatarOpen && profile.avatar_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsAvatarOpen(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
            />
            <button
              onClick={() => setIsAvatarOpen(false)}
              className="absolute -top-3 -right-3 rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-sm hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

