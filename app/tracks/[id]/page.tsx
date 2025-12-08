'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../../_components/TopNav';
import Link from 'next/link';

type Track = {
  id: string;
  name: string;
  country: string | null;
  length_km: number | null;
  num_corners: number | null;
  description: string | null;
  layout_image_url?: string | null;
};

type Car = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  nickname: string | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  is_public_profile: boolean | null;
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

export default function TrackDetailPage() {
  const params = useParams();
  const trackId = params.id as string;

  const [track, setTrack] = useState<Track | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [publicLaps, setPublicLaps] = useState<Lap[]>([]);
  const [allCars, setAllCars] = useState<Car[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);

      // Get user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setErrorMsg('You must be logged in to view track details.');
        setLoading(false);
        return;
      }

      const user = userData.user;
      setUserId(user.id);

      // Load track, user's laps, user's cars, public laps, all cars, and profiles
      const [trackRes, lapsRes, carsRes, publicLapsRes, allCarsRes, profilesRes] = await Promise.all([
        supabase.from('tracks').select('*').eq('id', trackId).maybeSingle(),
        supabase.from('laps').select('*').eq('user_id', user.id).eq('track_id', trackId).order('lap_time_ms', { ascending: true }),
        supabase.from('cars').select('*').eq('user_id', user.id),
        supabase.from('laps').select('*').eq('track_id', trackId).eq('is_public', true).order('lap_time_ms', { ascending: true }),
        supabase.from('cars').select('*'),
        supabase.from('profiles').select('id, display_name, is_public_profile'),
      ]);

      if (trackRes.error) {
        setErrorMsg(trackRes.error.message);
        setLoading(false);
        return;
      }

      if (!trackRes.data) {
        setErrorMsg('Track not found.');
        setLoading(false);
        return;
      }

      if (lapsRes.error) {
        setErrorMsg(lapsRes.error.message);
        setLoading(false);
        return;
      }

      if (carsRes.error) {
        setErrorMsg(carsRes.error.message);
        setLoading(false);
        return;
      }

      if (publicLapsRes.error) {
        setErrorMsg(publicLapsRes.error.message);
        setLoading(false);
        return;
      }

      if (allCarsRes.error) {
        setErrorMsg(allCarsRes.error.message);
        setLoading(false);
        return;
      }

      if (profilesRes.error) {
        setErrorMsg(profilesRes.error.message);
        setLoading(false);
        return;
      }

      setTrack(trackRes.data as Track);
      setLaps((lapsRes.data ?? []) as Lap[]);
      setCars((carsRes.data ?? []) as Car[]);
      setPublicLaps((publicLapsRes.data ?? []) as Lap[]);
      setAllCars((allCarsRes.data ?? []) as Car[]);
      setProfiles((profilesRes.data ?? []) as Profile[]);
      setLoading(false);
    }

    if (trackId) {
      loadData();
    }
  }, [trackId]);

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading track...</p>
        </main>
      </>
    );
  }

  if (errorMsg || !track) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p className="text-red-400">{errorMsg || 'Track not found.'}</p>
        </main>
      </>
    );
  }

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const allCarMap = new Map(allCars.map((c) => [c.id, c]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // My personal best (first lap since sorted by time)
  const myBestLap = laps.length > 0 ? laps[0] : null;

  // Find my public best and rank in the global leaderboard
  const myPublicBestIndex = publicLaps.findIndex((lap) => lap.user_id === userId);
  const myPublicBestRank = myPublicBestIndex >= 0 ? myPublicBestIndex + 1 : null;
  const myBestIsPublic = myBestLap?.is_public === true;

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Track Info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h1 className="text-2xl font-bold">{track.name}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {track.country || 'Unknown country'}
              {track.length_km ? ` • ${track.length_km} km` : ''}
              {track.num_corners ? ` • ${track.num_corners} corners` : ''}
            </p>
            {track.description && (
              <p className="mt-4 text-slate-300">{track.description}</p>
            )}
            {track.layout_image_url && (
              <img
                src={track.layout_image_url}
                alt={`${track.name} layout`}
                className="mt-4 rounded-md max-w-full"
              />
            )}
          </div>

          {/* My Personal Best */}
          {myBestLap && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-400 font-semibold mb-1">My Personal Best</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {carMap.get(myBestLap.car_id)?.make} {carMap.get(myBestLap.car_id)?.model}
                  </p>
                  <p className="text-sm text-slate-400">{myBestLap.date || 'No date'}</p>
                  {myBestIsPublic && myPublicBestRank && (
                    <p className="text-xs text-sky-400 mt-1">
                      Your public best on this track ranks #{myPublicBestRank} globally.
                    </p>
                  )}
                  {!myBestIsPublic && (
                    <p className="text-xs text-slate-500 mt-1">
                      This lap is private and does not count towards the global leaderboard.
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">
                  {formatLapTime(myBestLap.lap_time_ms)}
                </p>
              </div>
            </div>
          )}

          {/* Track Leaderboard */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Global top laps on this track</h2>
            {publicLaps.length === 0 ? (
              <p className="text-sm text-slate-400">No public laps on this track yet. Be the first to set a time.</p>
            ) : (
              <div className="space-y-2">
                {publicLaps.slice(0, 10).map((lap, index) => {
                  const car = allCarMap.get(lap.car_id);
                  const profile = profileMap.get(lap.user_id);
                  const position = index + 1;

                  const isPublicProfile = profile?.is_public_profile ?? true;
                  const isMe = lap.user_id === userId;
                  let driverName = 'Anonymous driver';
                  if (profile && isPublicProfile) {
                    driverName = profile.display_name || 'Unnamed driver';
                  }
                  if (isMe) {
                    driverName = 'You';
                  }

                  return (
                    <div
                      key={lap.id}
                      className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                        isMe ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900'
                      }`}
                    >
                      <div className="w-8 text-center font-bold text-sky-400">
                        {position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile && isPublicProfile && !isMe ? (
                            <Link href={`/driver/${profile.id}`} className="hover:text-sky-400 transition">
                              {driverName}
                            </Link>
                          ) : (
                            <span>{driverName}</span>
                          )}
                        </p>
                        <p className="text-sm text-slate-400">
                          {car ? `${car.make} ${car.model}` : 'Unknown car'}
                          {lap.date ? ` • ${lap.date}` : ''}
                        </p>
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatLapTime(lap.lap_time_ms)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Laps at this Track */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My laps at {track.name}</h2>
            {laps.length === 0 ? (
              <p className="text-sm text-slate-400">No laps recorded at this track yet.</p>
            ) : (
              <div className="space-y-2">
                {laps.map((lap, index) => {
                  const car = carMap.get(lap.car_id);
                  const position = index + 1;

                  return (
                    <div
                      key={lap.id}
                      className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                    >
                      <div className="w-8 text-center font-bold text-sky-400">
                        {position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {car ? `${car.make} ${car.model}` : 'Unknown car'}
                          {car?.nickname ? ` "${car.nickname}"` : ''}
                        </p>
                        <p className="text-sm text-slate-400">
                          {lap.date || 'No date'}
                        </p>
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatLapTime(lap.lap_time_ms)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
