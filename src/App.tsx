// ============================================================
// Orivay — App.tsx
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from './config/supabaseClient';
import AuthScreen from './screens/AuthScreen';
import MainLayout from './screens/MainLayout';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получаем текущую сессию
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">Orivay</div>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <MainLayout session={session} />;
};

export default App;
