'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../_components/TopNav';
import Link from 'next/link';

type Profile = {
  id: string;
  display_name: string | null;
  is_public_profile: boolean | null;
  experience_level?: string | null;
};

type Car = {
  id: string;
  user_id: string;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Lap = {
  user_id: string;
  track_id: string;
  is_public: boolean | null;
};

export default function DriversPage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);

  const [search, setSearch] = useState('');

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

      const [profilesRes, carsRes, lapsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, is_public_profile, experience_level')
          .eq('is_public_profile', true),
        supabase.from('cars').select('id, user_id, make, model, year'),
        supabase
          .from('laps')
          .select('user_id, track_id, is_public')
          .eq('is_public', true),
      ]);

      if (profilesRes.error) {
        setErrorMsg(profilesRes.error.message);
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

      setProfiles((profilesRes.data ?? []) as Profile[]);
      setCars((carsRes.data ?? []) as Car[]);
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
          <p>Loading drivers...</p>
        </main>
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p className="text-slate-400">You must be logged in to browse drivers.</p>
        </main>
      </>
    );
  }

  // Build helper maps
  const carsByUser = new Map<string, Car[]>();
  for (const car of cars) {
    if (!carsByUser.has(car.user_id)) {
      carsByUser.set(car.user_id, []);
    }
    carsByUser.get(car.user_id)!.push(car);
  }

  const mainCarByUser = new Map<string, Car | undefined>();
  for (const [odriverId, userCars] of carsByUser.entries()) {
    mainCarByUser.set(odriverId, userCars[0]);
  }

  const lapCountByUser = new Map<string, number>();
  const trackSetByUser = new Map<string, Set<string>>();

  for (const lap of laps) {
    lapCountByUser.set(lap.user_id, (lapCountByUser.get(lap.user_id) ?? 0) + 1);

    if (!trackSetByUser.has(lap.user_id)) {
      trackSetByUser.set(lap.user_id, new Set());
    }
    trackSetByUser.get(lap.user_id)!.add(lap.track_id);
  }

  // Filter profiles by search
  let filteredProfiles = profiles;
  if (search.trim()) {
    const searchLower = search.trim().toLowerCase();
    filteredProfiles = profiles.filter((p) =>
      (p.display_name ?? '').toLowerCase().includes(searchLower)
    );
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
          <h1 className="text-2xl font-bold">Drivers</h1>
          <p className="text-sm text-slate-400">
            Browse public driver profiles and see who is lapping where.
          </p>

          {errorMsg && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}

          {/* Search input */}
          <div>
            <input
              type="text"
              placeholder="Search by driver name"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Driver cards list */}
          <div className="space-y-3">
            {profiles.length === 0 ? (
              <p className="text-sm text-slate-400">No public drivers yet.</p>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-sm text-slate-400">No drivers match your search.</p>
            ) : (
              filteredProfiles.map((profile) => {
                const mainCar = mainCarByUser.get(profile.id);
                const publicLaps = lapCountByUser.get(profile.id) ?? 0;
                const tracksDriven = trackSetByUser.get(profile.id)?.size ?? 0;

                return (
                  <div
                    key={profile.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/driver/${profile.id}`}
                        className="font-semibold hover:underline hover:text-sky-400 transition"
                      >
                        {profile.display_name || 'Unnamed driver'}
                      </Link>
                      {profile.experience_level && (
                        <p className="text-xs text-slate-400">
                          {profile.experience_level}
                        </p>
                      )}
                      {mainCar && (
                        <p className="text-xs text-slate-400">
                          Main car: {mainCar.make} {mainCar.model}
                          {mainCar.year ? ` (${mainCar.year})` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-slate-300 sm:text-right">
                      <p>Tracks: {tracksDriven}</p>
                      <p>Public laps: {publicLaps}</p>
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

