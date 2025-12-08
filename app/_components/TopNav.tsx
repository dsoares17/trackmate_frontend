'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function TopNav() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    }
    loadUser();
  }, []);

  // Build nav items with dynamic Profile link
  const navItems = [
    { href: '/', label: 'Home' },
    { href: userId ? `/driver/${userId}` : '/profile', label: 'Profile' },
    { href: '/cars', label: 'Garage' },
    { href: '/tracks', label: 'Tracks' },
    { href: '/laps', label: 'Laps' },
    { href: '/leaderboards', label: 'Leaderboards' },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-slate-100 hover:text-sky-400 transition"
        >
          Trackmate
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
