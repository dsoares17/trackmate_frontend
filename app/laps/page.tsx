'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../_components/TopNav';

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

type Lap = {
  id: string;
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

export default function LapsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [date, setDate] = useState('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [seconds, setSeconds] = useState<number | ''>('');
  const [millis, setMillis] = useState<number | ''>('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setErrorMsg('You must be logged in to view and add laps.');
        setLoading(false);
        return;
      }

      const user = userData.user;

      const [carsRes, tracksRes, lapsRes] = await Promise.all([
        supabase.from('cars').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('tracks').select('*').order('name', { ascending: true }),
        supabase.from('laps').select('*').eq('user_id', user.id).order('lap_time_ms', { ascending: true }),
      ]);

      if (carsRes.error) {
        setErrorMsg(carsRes.error.message);
        setLoading(false);
        return;
      }
      if (tracksRes.error) {
        setErrorMsg(tracksRes.error.message);
        setLoading(false);
        return;
      }
      if (lapsRes.error) {
        setErrorMsg(lapsRes.error.message);
        setLoading(false);
        return;
      }

      setCars((carsRes.data ?? []) as Car[]);
      setTracks((tracksRes.data ?? []) as Track[]);
      setLaps((lapsRes.data ?? []) as Lap[]);

      setLoading(false);
    }

    loadData();
  }, []);

  async function handleAddLap(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to add a lap.');
      setSaving(false);
      return;
    }

    const user = userData.user;

    if (!selectedCarId || !selectedTrackId) {
      setErrorMsg('Select a car and a track.');
      setSaving(false);
      return;
    }

    if (minutes === '' || seconds === '' || millis === '') {
      setErrorMsg('Fill minutes, seconds and milliseconds.');
      setSaving(false);
      return;
    }

    const totalMs =
      Number(minutes) * 60_000 +
      Number(seconds) * 1_000 +
      Number(millis);

    // Sanity checks for lap time
    if (totalMs < 20000) {
      setErrorMsg('Lap time is unrealistically low (less than 20 seconds). Please double-check.');
      setSaving(false);
      return;
    }

    if (totalMs > 900000) {
      setErrorMsg('Lap time is unrealistically high (more than 15 minutes). Please double-check.');
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('laps')
      .insert({
        user_id: user.id,
        car_id: selectedCarId,
        track_id: selectedTrackId,
        lap_time_ms: totalMs,
        date: date || null,
        is_public: isPublic,
        source: 'manual',
        is_verified: false,
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (data) {
      setLaps((prev) => [...prev, data as Lap].sort((a, b) => a.lap_time_ms - b.lap_time_ms));
      setMinutes('');
      setSeconds('');
      setMillis('');
      setIsPublic(false);
    }
  }

  async function handleTogglePublic(lapId: string, nextValue: boolean) {
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to update a lap.');
      return;
    }

    const { error } = await supabase
      .from('laps')
      .update({ is_public: nextValue })
      .eq('id', lapId);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Update local state
    setLaps((prev) =>
      prev.map((lap) =>
        lap.id === lapId ? { ...lap, is_public: nextValue } : lap
      )
    );
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading laps...</p>
        </main>
      </>
    );
  }

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-2xl font-bold">Lap times</h1>

          {errorMsg && (
            <p className="text-sm text-red-400">
              {errorMsg}
            </p>
          )}

          <form onSubmit={handleAddLap} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Add a lap</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm mb-1">Car</label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={selectedCarId}
                  onChange={(e) => setSelectedCarId(e.target.value)}
                  required
                >
                  <option value="">Select car</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.make} {car.model}
                      {car.nickname ? ` (${car.nickname})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Track</label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={selectedTrackId}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  required
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
                <label className="block text-sm mb-1">Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Lap time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="min"
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                  />
                  <span className="text-sm">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="sec"
                    value={seconds}
                    onChange={(e) =>
                      setSeconds(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                  />
                  <span className="text-sm">.</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="ms"
                    value={millis}
                    onChange={(e) =>
                      setMillis(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm mt-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Make this lap public (show on leaderboards)</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Adding...' : 'Add lap'}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your laps (best first)</h2>
            {laps.length === 0 && (
              <p className="text-sm text-slate-400">No laps yet. Add your first PB above.</p>
            )}

            <div className="space-y-2">
              {laps.map((lap) => {
                const car = carMap.get(lap.car_id);
                const track = trackMap.get(lap.track_id);

                return (
                  <div
                    key={lap.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          {lap.date || 'No date'}
                        </p>
                        <p className="font-medium">
                          {track ? track.name : 'Unknown track'} •{' '}
                          {car ? `${car.make} ${car.model}` : 'Unknown car'}
                        </p>
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatLapTime(lap.lap_time_ms)}
                        {lap.is_public && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">Public</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end">
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!lap.is_public}
                          onChange={(e) => handleTogglePublic(lap.id, e.target.checked)}
                        />
                        <span>Public</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
