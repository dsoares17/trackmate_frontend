'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../_components/TopNav';

type Track = {
  id: string;
  name: string;
  country: string | null;
};

type Car = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Profile = {
  id: string;
  display_name: string | null;
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

function formatLapTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  const secStr = seconds.toString().padStart(2, '0');
  const msStr = millis.toString().padStart(3, '0');

  return `${minutes}:${secStr}.${msStr}`;
}

export default function LeaderboardsPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);

  // Filters
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [driverSearch, setDriverSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const [tracksRes, carsRes, profilesRes, lapsRes] = await Promise.all([
        supabase.from('tracks').select('*').order('name', { ascending: true }),
        supabase.from('cars').select('*'),
        supabase.from('profiles').select('id, display_name'),
        supabase.from('laps').select('*').eq('is_public', true).order('lap_time_ms', { ascending: true }),
      ]);

      if (tracksRes.error) {
        setErrorMsg(tracksRes.error.message);
        setLoading(false);
        return;
      }
      if (carsRes.error) {
        setErrorMsg(carsRes.error.message);
        setLoading(false);
        return;
      }
      if (profilesRes.error) {
        setErrorMsg(profilesRes.error.message);
        setLoading(false);
        return;
      }
      if (lapsRes.error) {
        setErrorMsg(lapsRes.error.message);
        setLoading(false);
        return;
      }

      setTracks((tracksRes.data ?? []) as Track[]);
      setCars((carsRes.data ?? []) as Car[]);
      setProfiles((profilesRes.data ?? []) as Profile[]);
      setLaps((lapsRes.data ?? []) as Lap[]);

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading leaderboards...</p>
        </main>
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p className="text-slate-400">You must be logged in to view leaderboards.</p>
        </main>
      </>
    );
  }

  // Build maps
  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  const carMap = new Map(cars.map((c) => [c.id, c]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Filter laps
  let filteredLaps = laps;

  if (selectedTrackId) {
    filteredLaps = filteredLaps.filter((l) => l.track_id === selectedTrackId);
  }

  if (selectedCarId) {
    filteredLaps = filteredLaps.filter((l) => l.car_id === selectedCarId);
  }

  if (driverSearch.trim()) {
    const searchLower = driverSearch.trim().toLowerCase();
    filteredLaps = filteredLaps.filter((l) => {
      const profile = profileMap.get(l.user_id);
      const displayName = profile?.display_name ?? '';
      return displayName.toLowerCase().includes(searchLower);
    });
  }

  // Sort by lap_time_ms ascending (fastest first)
  filteredLaps = [...filteredLaps].sort((a, b) => a.lap_time_ms - b.lap_time_ms);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="text-2xl font-bold">Leaderboards</h1>

          {errorMsg && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}

          {/* Filter bar */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div>
              <label className="block text-sm mb-1">Track</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
              >
                <option value="">Select track</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Car</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
              >
                <option value="">All cars</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.make} {car.model}
                    {car.year ? ` (${car.year})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Driver</label>
              <input
                type="text"
                placeholder="Search by display name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="space-y-2">
            {!selectedTrackId ? (
              <p className="text-sm text-slate-400">Select a track to see the leaderboard.</p>
            ) : filteredLaps.length === 0 ? (
              <p className="text-sm text-slate-400">No public laps match these filters yet.</p>
            ) : (
              filteredLaps.map((lap, index) => {
                const track = trackMap.get(lap.track_id);
                const car = carMap.get(lap.car_id);
                const profile = profileMap.get(lap.user_id);

                const position = index + 1;
                const trackName = track?.name ?? 'Unknown track';
                const driverName = profile?.display_name ?? 'Unknown driver';
                const carName = car ? `${car.make ?? ''} ${car.model ?? ''}`.trim() || 'Unknown car' : 'Unknown car';

                return (
                  <div
                    key={lap.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <div className="w-8 text-center font-bold text-sky-400">
                      {position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{trackName}</p>
                      <p className="text-sm text-slate-400 truncate">
                        {driverName} • {carName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatLapTime(lap.lap_time_ms)}
                      </p>
                      {lap.date && (
                        <p className="text-xs text-slate-500">{lap.date}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </>
  );
}
