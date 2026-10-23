'use client';
import { useEffect } from 'react';
export default function ConfirmationBridge() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has('access_token') || hash.has('error_description')) {
      window.location.replace((process.env.NEXT_PUBLIC_APP_BASE_PATH || '') + '/app/' + window.location.hash);
    }
  }, []);
  return null;
}
