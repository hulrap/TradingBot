'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Page() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This check will run on the client side after hydration.
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900">
      <p className="text-white">Loading...</p>
    </div>
  );
} 