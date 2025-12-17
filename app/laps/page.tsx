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
  session_label: string | null;
  conditions: string | null;
  temperature_band: string | null;
  source: string | null;
};

type SessionLap = {
  id: number;
  timeText: string;
  lapTimeMs: number;
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

function humanReadableConditions(value: string | null | undefined): string {
  switch (value) {
    case 'dry_warm': return 'Dry – sunny / warm';
    case 'dry_cool': return 'Dry – cool / overcast';
    case 'damp': return 'Damp';
    case 'wet': return 'Wet';
    default: return 'Unknown';
  }
}

function humanReadableTemperature(value: string | null | undefined): string {
  switch (value) {
    case 'cool': return 'Cool';
    case 'normal': return 'Normal';
    case 'hot': return 'Hot';
    default: return 'Unknown';
  }
}

function getSourceBadge(source: string | null | undefined): { label: string; className: string } {
  if (source === 'phone_gps') {
    return {
      label: '📱 Phone timing',
      className: 'bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full',
    };
  }
  // Default: manual or unknown
  return {
    label: 'Manual',
    className: 'bg-slate-700/50 text-slate-400 text-xs px-2 py-0.5 rounded-full',
  };
}

// Parse lap time string like "1:54.320" or "1:54:320" or "114.320" to milliseconds
function parseLapTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try format "M:SS.mmm" or "M:SS:mmm"
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})[.:](\d{1,3})$/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10);
    const secs = parseInt(colonMatch[2], 10);
    let millis = colonMatch[3];
    // Pad milliseconds to 3 digits
    while (millis.length < 3) millis += '0';
    const ms = parseInt(millis, 10);
    return mins * 60000 + secs * 1000 + ms;
  }

  // Try format "SS.mmm" (no minutes, just seconds.millis)
  const secMatch = trimmed.match(/^(\d{1,3})[.:](\d{1,3})$/);
  if (secMatch) {
    const secs = parseInt(secMatch[1], 10);
    let millis = secMatch[2];
    while (millis.length < 3) millis += '0';
    const ms = parseInt(millis, 10);
    return secs * 1000 + ms;
  }

  return null;
}

export default function LapsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Single lap form state
  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [date, setDate] = useState('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [seconds, setSeconds] = useState<number | ''>('');
  const [millis, setMillis] = useState<number | ''>('');
  const [isPublic, setIsPublic] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  const [conditions, setConditions] = useState('');
  const [temperatureBand, setTemperatureBand] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Quick session state
  const [showQuickSession, setShowQuickSession] = useState(false);
  const [qsTrackId, setQsTrackId] = useState('');
  const [qsCarId, setQsCarId] = useState('');
  const [qsDate, setQsDate] = useState('');
  const [qsLabel, setQsLabel] = useState('');
  const [qsConditions, setQsConditions] = useState('');
  const [qsTemperatureBand, setQsTemperatureBand] = useState('');
  const [qsIsPublic, setQsIsPublic] = useState(true);
  const [qsMinutes, setQsMinutes] = useState<number | ''>('');
  const [qsSeconds, setQsSeconds] = useState<number | ''>('');
  const [qsMillis, setQsMillis] = useState<number | ''>('');
  const [qsLaps, setQsLaps] = useState<SessionLap[]>([]);
  const [qsNextId, setQsNextId] = useState(1);
  const [qsSaving, setQsSaving] = useState(false);
  const [qsError, setQsError] = useState<string | null>(null);
  const [qsSuccess, setQsSuccess] = useState<string | null>(null);

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
        session_label: sessionLabel || null,
        conditions: conditions || null,
        temperature_band: temperatureBand || null,
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
      setSessionLabel('');
      setConditions('');
      setTemperatureBand('');
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

  // Quick session handlers
  function handleAddQsLap() {
    setQsError(null);

    if (qsMinutes === '' || qsSeconds === '' || qsMillis === '') {
      setQsError('Fill in minutes, seconds, and milliseconds.');
      return;
    }

    const totalMs =
      Number(qsMinutes) * 60_000 +
      Number(qsSeconds) * 1_000 +
      Number(qsMillis);

    if (totalMs < 20000) {
      setQsError('Lap time is unrealistically low (less than 20 seconds).');
      return;
    }

    if (totalMs > 900000) {
      setQsError('Lap time is unrealistically high (more than 15 minutes).');
      return;
    }

    const timeText = formatLapTime(totalMs);

    setQsLaps((prev) => [
      ...prev,
      { id: qsNextId, timeText, lapTimeMs: totalMs },
    ]);
    setQsNextId((prev) => prev + 1);
    // Clear inputs for next lap
    setQsMinutes('');
    setQsSeconds('');
    setQsMillis('');
  }

  function handleRemoveQsLap(id: number) {
    setQsLaps((prev) => prev.filter((lap) => lap.id !== id));
  }

  async function handleSaveQuickSession() {
    setQsError(null);
    setQsSuccess(null);

    if (!qsTrackId || !qsCarId) {
      setQsError('Select a track and car for this session.');
      return;
    }

    if (qsLaps.length === 0) {
      setQsError('Add at least one lap time.');
      return;
    }

    setQsSaving(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setQsError('You must be logged in to save laps.');
      setQsSaving(false);
      return;
    }

    const user = userData.user;

    const lapsToInsert = qsLaps.map((lap) => ({
      user_id: user.id,
      car_id: qsCarId,
      track_id: qsTrackId,
      lap_time_ms: lap.lapTimeMs,
      date: qsDate || null,
      is_public: qsIsPublic,
      source: 'manual',
      is_verified: false,
      session_label: qsLabel || null,
      conditions: qsConditions || null,
      temperature_band: qsTemperatureBand || null,
    }));

    const { data, error } = await supabase
      .from('laps')
      .insert(lapsToInsert)
      .select();

    setQsSaving(false);

    if (error) {
      setQsError(error.message);
      return;
    }

    if (data) {
      setLaps((prev) => [...prev, ...(data as Lap[])].sort((a, b) => a.lap_time_ms - b.lap_time_ms));
      setQsSuccess(`Saved ${data.length} laps successfully!`);
      // Reset quick session
      setQsLaps([]);
      setQsNextId(1);
      setQsMinutes('');
      setQsSeconds('');
      setQsMillis('');
    }
  }

  function handleClearQuickSession() {
    setQsLaps([]);
    setQsNextId(1);
    setQsMinutes('');
    setQsSeconds('');
    setQsMillis('');
    setQsError(null);
    setQsSuccess(null);
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

  // Compute quick session stats
  const qsBestLap = qsLaps.length > 0 ? Math.min(...qsLaps.map((l) => l.lapTimeMs)) : null;

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

          {/* Single Lap Form */}
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

              {/* Collapsible optional fields */}
              <div className="border-t border-slate-800 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((prev) => !prev)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition"
                >
                  <span className="text-xs">{showOptionalDetails ? '▼' : '▶'}</span>
                  Optional session details
                </button>
                
                {showOptionalDetails && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-sm mb-1">Session (optional)</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="e.g. Morning session, Afternoon 1"
                        value={sessionLabel}
                        onChange={(e) => setSessionLabel(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Conditions</label>
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        value={conditions}
                        onChange={(e) => setConditions(e.target.value)}
                      >
                        <option value="">Select conditions (optional)</option>
                        <option value="dry_warm">Dry – sunny / warm</option>
                        <option value="dry_cool">Dry – cool / overcast</option>
                        <option value="damp">Damp</option>
                        <option value="wet">Wet</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Temperature</label>
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        value={temperatureBand}
                        onChange={(e) => setTemperatureBand(e.target.value)}
                      >
                        <option value="">Select temperature (optional)</option>
                        <option value="cool">Cool</option>
                        <option value="normal">Normal</option>
                        <option value="hot">Hot</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {saving ? 'Adding...' : 'Add lap'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickSession((prev) => !prev)}
                  className="rounded-md border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-sky-300 hover:border-sky-400 hover:text-sky-200 transition"
                >
                  {showQuickSession
                    ? 'Hide quick session'
                    : 'Log multiple laps'}
                </button>
              </div>
            </form>

          {/* Quick Session Form */}
          {showQuickSession && (
            <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-emerald-400">⚡ Quick Session Logging</h2>
                <p className="text-xs text-slate-400">Log multiple laps at once</p>
              </div>

              {/* Session Header */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm mb-1">Track</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={qsTrackId}
                    onChange={(e) => setQsTrackId(e.target.value)}
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
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={qsCarId}
                    onChange={(e) => setQsCarId(e.target.value)}
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
                  <label className="block text-sm mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={qsDate}
                    onChange={(e) => setQsDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Session name (optional)</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Morning session"
                    value={qsLabel}
                    onChange={(e) => setQsLabel(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Conditions</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={qsConditions}
                    onChange={(e) => setQsConditions(e.target.value)}
                  >
                    <option value="">Select (optional)</option>
                    <option value="dry_warm">Dry – sunny / warm</option>
                    <option value="dry_cool">Dry – cool / overcast</option>
                    <option value="damp">Damp</option>
                    <option value="wet">Wet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Temperature</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={qsTemperatureBand}
                    onChange={(e) => setQsTemperatureBand(e.target.value)}
                  >
                    <option value="">Select (optional)</option>
                    <option value="cool">Cool</option>
                    <option value="normal">Normal</option>
                    <option value="hot">Hot</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={qsIsPublic}
                  onChange={(e) => setQsIsPublic(e.target.checked)}
                />
                <span>Make all laps public (show on leaderboards)</span>
              </label>

              {/* Lap Input */}
              <div className="border-t border-slate-800 pt-4">
                <label className="block text-sm mb-2">Add lap time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="min"
                    value={qsMinutes}
                    onChange={(e) =>
                      setQsMinutes(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                  <span className="text-sm">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="sec"
                    value={qsSeconds}
                    onChange={(e) =>
                      setQsSeconds(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                  <span className="text-sm">.</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="ms"
                    value={qsMillis}
                    onChange={(e) =>
                      setQsMillis(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                  <button
                    type="button"
                    onClick={handleAddQsLap}
                    className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              {qsError && (
                <p className="text-sm text-red-400">{qsError}</p>
              )}

              {qsSuccess && (
                <p className="text-sm text-emerald-400">{qsSuccess}</p>
              )}

              {/* Staged Laps List */}
              {qsLaps.length > 0 && (
                <div className="border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Staged laps ({qsLaps.length})</h3>
                    {qsBestLap && (
                      <span className="text-xs text-emerald-400">
                        Best: {formatLapTime(qsBestLap)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {qsLaps.map((lap, index) => (
                      <div
                        key={lap.id}
                        className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                          lap.lapTimeMs === qsBestLap
                            ? 'bg-emerald-500/20 border border-emerald-500/30'
                            : 'bg-slate-800'
                        }`}
                      >
                        <span className="text-slate-400 w-6">#{index + 1}</span>
                        <span className="font-mono font-medium flex-1">
                          {formatLapTime(lap.lapTimeMs)}
                        </span>
                        <span className="text-xs text-slate-500 mr-3">{lap.timeText}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveQsLap(lap.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveQuickSession}
                  disabled={qsSaving || qsLaps.length === 0}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {qsSaving ? 'Saving...' : `Save ${qsLaps.length} lap${qsLaps.length !== 1 ? 's' : ''}`}
                </button>
                {qsLaps.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQuickSession}
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 transition"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your laps (best first)</h2>
            {laps.length === 0 && (
              <p className="text-sm text-slate-400">No laps yet. Add your first PB above.</p>
            )}

            <div className="space-y-2">
              {laps.map((lap) => {
                const car = carMap.get(lap.car_id);
                const track = trackMap.get(lap.track_id);
                const hasMetadata = lap.session_label || lap.conditions || lap.temperature_band;

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
                        {hasMetadata && (
                          <p className="text-xs text-slate-500 mt-1">
                            {lap.session_label && <>Session: {lap.session_label}</>}
                            {lap.session_label && (lap.conditions || lap.temperature_band) && <> · </>}
                            {lap.conditions && (
                              <>
                                {humanReadableConditions(lap.conditions)}
                              </>
                            )}
                            {lap.conditions && lap.temperature_band && <> · </>}
                            {lap.temperature_band && <>Temp: {humanReadableTemperature(lap.temperature_band)}</>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatLapTime(lap.lap_time_ms)}
                        </span>
                        <span className={getSourceBadge(lap.source).className}>
                          {getSourceBadge(lap.source).label}
                        </span>
                        {lap.is_public && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">Public</span>
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
