'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

const getLocale = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  }
  return 'en';
};

const todayToastText = {
  en: {
    title: 'Welcome back!',
    description: 'Ready to organize your day?',
    action: 'Got it',
  },
  zh: {
    title: '欢迎回来！',
    description: '准备好规划你的一天了吗？',
    action: '好的',
  },
};

const TodayToast = () => {
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem('today-toast');
    const data = raw ? JSON.parse(raw) : null;

    if (!data || data.date !== today) {
      localStorage.setItem(
        'today-toast',
        JSON.stringify({ date: today, shown: false })
      );
    }

    const updated = JSON.parse(localStorage.getItem('today-toast') || '{}');
    if (!updated.shown) {
      const lang = getLocale();
      const text = todayToastText[lang];

      toast(
        ({ dismiss }) => (
          <div className="flex flex-col space-y-1">
            <div className="text-sm font-medium">{text.title}</div>
            <div className="text-sm text-muted-foreground">{text.description}</div>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => {
                  localStorage.setItem(
                    'today-toast',
                    JSON.stringify({ date: today, shown: true })
                  );
                  dismiss();
                }}
              >
                {text.action}
              </Button>
            </div>
          </div>
        ),
        {
          duration: Infinity,
        }
      );
    }
  }, []);

  return null;
};

export default TodayToast;
