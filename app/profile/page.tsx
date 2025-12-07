'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

type Profile = {
  display_name: string | null;
  full_name: string | null;
  car: string | null;
  experience_level: string | null;
  preferred_tracks: string | null;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [car, setCar] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [preferredTracks, setPreferredTracks] = useState('');

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setErrorMsg('You must be logged in to view your profile.');
        setLoading(false);
        return;
      }

      const user = userData.user;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        const profile = data as Profile;
        setDisplayName(profile.display_name ?? '');
        setFullName(profile.full_name ?? '');
        setCar(profile.car ?? '');
        setExperienceLevel(profile.experience_level ?? '');
        setPreferredTracks(profile.preferred_tracks ?? '');
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to save your profile.');
      setSaving(false);
      return;
    }

    const user = userData.user;

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName || null,
      full_name: fullName || null,
      car: car || null,
      experience_level: experienceLevel || null,
      preferred_tracks: preferredTracks || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg('Profile saved.');
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading profile...</p>
        </main>
      </>
    );
  }

  if (errorMsg && !fullName && !car && !experienceLevel && !preferredTracks) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <div className="space-y-4 text-center">
            <p className="text-red-400">{errorMsg}</p>
            <button
              onClick={() => router.push('/login')}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 transition"
            >
              Go to login
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-full max-w-md space-y-6 p-6 rounded-lg border border-slate-800 bg-slate-900">
          <h1 className="text-2xl font-bold text-center">Your Profile</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Display name</label>
              <input
                type="text"
                placeholder="Name to show on leaderboards"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Full name</label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Car</label>
              <input
                type="text"
                placeholder="BMW E46 M3, GTI, MX-5..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={car}
                onChange={(e) => setCar(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Experience level</label>
              <input
                type="text"
                placeholder="Beginner, Intermediate, Advanced..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Preferred tracks</label>
              <textarea
                placeholder="Estoril, Portimão, Nürburgring..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={3}
                value={preferredTracks}
                onChange={(e) => setPreferredTracks(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-400">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-sm text-emerald-400">
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-sky-500 py-2 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
