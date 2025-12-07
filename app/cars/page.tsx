'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopNav from '../_components/TopNav';

type Car = {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
};

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | ''>('');

  async function loadCars() {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to view your cars.');
      setLoading(false);
      return;
    }

    const user = userData.user;

    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setCars((data ?? []) as Car[]);
    setLoading(false);
  }

  useEffect(() => {
    loadCars();
  }, []);

  async function handleAddCar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMsg('You must be logged in to add a car.');
      setSaving(false);
      return;
    }

    const user = userData.user;

    const { data, error } = await supabase
      .from('cars')
      .insert({
        user_id: user.id,
        nickname: nickname || null,
        make: make || null,
        model: model || null,
        year: year === '' ? null : Number(year),
      })
      .select()
      .maybeSingle();

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (data) {
      setCars((prev) => [...prev, data as Car]);
      setNickname('');
      setMake('');
      setModel('');
      setYear('');
    }
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <p>Loading cars...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold">Your Garage</h1>

          {errorMsg && (
            <p className="text-sm text-red-400">
              {errorMsg}
            </p>
          )}

          <form onSubmit={handleAddCar} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Add a car</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm mb-1">Nickname (optional)</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Make</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Model</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Year</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={year}
                  onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Adding...' : 'Add car'}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your cars</h2>
            {cars.length === 0 && (
              <p className="text-sm text-slate-400">No cars yet. Add your first track car above.</p>
            )}

            <div className="space-y-2">
              {cars.map((car) => (
                <div
                  key={car.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {car.make} {car.model} {car.year ? `(${car.year})` : ''}
                    </p>
                    {car.nickname && (
                      <p className="text-sm text-slate-400">"{car.nickname}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
