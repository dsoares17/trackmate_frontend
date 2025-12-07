'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../_components/TopNav';
import Link from 'next/link';

type Track = {
  id: string;
  name: string;
  country: string | null;
  length_km: number | null;
};

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [lengthKm, setLengthKm] = useState<number | ''>('');

  async function loadTracks() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setTracks((data ?? []) as Track[]);
    setLoading(false);
  }

  useEffect(() => {
    loadTracks();
  }, []);

  async function handleAddTrack(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to add a track.');
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('tracks')
      .insert({
        name,
        country: country || null,
        length_km: lengthKm === '' ? null : Number(lengthKm),
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (data) {
      setTracks((prev) => [...prev, data as Track]);
      setName('');
      setCountry('');
      setLengthKm('');
    }
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading tracks...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold">Tracks</h1>

          {errorMsg && (
            <p className="text-sm text-red-400">
              {errorMsg}
            </p>
          )}

          <form onSubmit={handleAddTrack} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Add a track</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Country</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Length (km)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={lengthKm}
                  onChange={(e) =>
                    setLengthKm(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Adding...' : 'Add track'}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">All tracks</h2>
            {tracks.length === 0 && (
              <p className="text-sm text-slate-400">No tracks yet.</p>
            )}

            <div className="space-y-2">
              {tracks.map((track) => (
                <Link
                  href={`/tracks/${track.id}`}
                  key={track.id}
                  className="block rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:bg-slate-800 transition"
                >
                  <div>
                    <p className="font-medium">{track.name}</p>
                    <p className="text-sm text-slate-400">
                      {track.country || 'Unknown country'}
                      {track.length_km ? ` • ${track.length_km} km` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
