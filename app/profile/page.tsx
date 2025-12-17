'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';
import Cropper, { Area } from 'react-easy-crop';

type Profile = {
  display_name: string | null;
  full_name: string | null;
  car: string | null;
  experience_level: string | null;
  preferred_tracks: string | null;
  is_public_profile: boolean | null;
  avatar_url: string | null;
};

// Helper function to create cropped image
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set canvas size to the cropped area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.9);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
}

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
  const [isPublicProfile, setIsPublicProfile] = useState(true);
  
  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Crop modal states
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('avatar.jpg');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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
        setIsPublicProfile(profile.is_public_profile ?? true);
        setAvatarUrl(profile.avatar_url ?? null);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedImageUrl) {
        URL.revokeObjectURL(selectedImageUrl);
      }
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [selectedImageUrl, avatarPreview]);

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Cleanup previous URL if exists
      if (selectedImageUrl) {
        URL.revokeObjectURL(selectedImageUrl);
      }
      
      const imageUrl = URL.createObjectURL(file);
      setSelectedImageUrl(imageUrl);
      setSelectedFileName(file.name);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsCropModalOpen(true);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  async function handleUseCrop() {
    if (!selectedImageUrl || !croppedAreaPixels) return;

    try {
      const croppedFile = await getCroppedImg(
        selectedImageUrl,
        croppedAreaPixels,
        selectedFileName
      );

      // Cleanup old preview URL
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }

      // Create preview of cropped image
      const previewUrl = URL.createObjectURL(croppedFile);
      setAvatarPreview(previewUrl);
      setAvatarFile(croppedFile);

      // Cleanup selected image URL
      URL.revokeObjectURL(selectedImageUrl);
      setSelectedImageUrl(null);
      setIsCropModalOpen(false);
    } catch (err) {
      console.error('Error cropping image:', err);
      setErrorMsg('Failed to crop image. Please try again.');
    }
  }

  function handleCancelCrop() {
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    setSelectedImageUrl(null);
    setIsCropModalOpen(false);
  }

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

    // Handle avatar upload if a new file was selected
    let newAvatarUrl = avatarUrl;

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          upsert: true,
        });

      if (uploadError) {
        setErrorMsg(`Avatar upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      newAvatarUrl = publicUrlData?.publicUrl ?? null;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName || null,
      full_name: fullName || null,
      car: car || null,
      experience_level: experienceLevel || null,
      preferred_tracks: preferredTracks || null,
      is_public_profile: isPublicProfile,
      avatar_url: newAvatarUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Update local state with new avatar URL
    if (newAvatarUrl !== avatarUrl) {
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
    }

    setSuccessMsg('Profile saved.');
  }

  const avatarInitial = (displayName || fullName || '?').charAt(0).toUpperCase();
  const displayedAvatar = avatarPreview || avatarUrl;

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
            {/* Avatar Upload Section */}
            <section className="mb-4 flex items-center gap-4 pb-4 border-b border-slate-800">
              <div className="h-16 w-16 shrink-0 rounded-full border-2 border-sky-500/50 bg-slate-950 overflow-hidden flex items-center justify-center text-2xl font-bold text-sky-400">
                {displayedAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayedAvatar}
                    alt="Profile avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              <div className="flex-1">
                <label className="text-sm text-slate-300">Profile picture</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:text-slate-200 hover:file:bg-slate-600"
                  onChange={handleAvatarFileChange}
                />
                <p className="text-xs text-slate-500 mt-1">
                  JPG or PNG, up to ~2MB.
                </p>
              </div>
            </section>

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

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isPublicProfile}
                onChange={(e) => setIsPublicProfile(e.target.checked)}
              />
              <span>Make my profile public (show my name on leaderboards and allow a public profile page)</span>
            </label>

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

      {/* Crop Modal */}
      {isCropModalOpen && selectedImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold mb-4">Crop your avatar</h2>
            
            {/* Cropper container */}
            <div className="relative h-64 w-full bg-slate-950 rounded-md overflow-hidden">
              <Cropper
                image={selectedImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            {/* Zoom slider */}
            <div className="mt-4">
              <label className="text-sm text-slate-400">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full mt-1 accent-sky-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUseCrop}
                className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold hover:bg-sky-600 transition"
              >
                Use this crop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
