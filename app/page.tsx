'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TopNav from './_components/TopNav';

type User = {
  id: string;
  email?: string;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      setUser(data.user as User | null);
      setLoading(false);
    }
    loadUser();
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

  // Logged in: simple dashboard
  return (
    <>
      <TopNav />
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-full max-w-md space-y-6 p-6 rounded-lg border border-slate-800 bg-slate-900">
          <h1 className="text-2xl font-bold text-center">Trackmate</h1>
          <p className="text-sm text-slate-300 text-center">
            Logged in as {user.email ?? 'driver'}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/profile')}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 transition"
            >
              Profile
            </button>

            <button
              onClick={() => router.push('/cars')}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 transition"
            >
              Garage (cars)
            </button>

            <button
              onClick={() => router.push('/tracks')}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 transition"
            >
              Tracks
            </button>

            <button
              onClick={() => router.push('/laps')}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 transition"
            >
              Lap times
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-red-500 px-4 py-2 text-sm font-semibold hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </main>
    </>
  );
}
