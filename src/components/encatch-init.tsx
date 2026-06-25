'use client';

import { initEncatch, syncEncatchTheme } from '@/lib/encatch';
import { useTheme } from 'fumadocs-ui/provider/base';
import { useEffect } from 'react';

export function EncatchInit() {
  const { theme } = useTheme();

  useEffect(() => {
    initEncatch();
  }, []);

  useEffect(() => {
    syncEncatchTheme(theme);
  }, [theme]);

  return null;
}
