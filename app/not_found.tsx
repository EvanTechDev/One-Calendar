'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const [lang, setLang] = useState<'zh' | 'en'>('en');

  useEffect(() => {
    const userLang = navigator.language || navigator.languages[0];
    if (userLang.startsWith('zh')) {
      setLang('zh');
    } else {
      setLang('en');
    }
  }, []);

  const messages = {
    zh: {
      title: '页面未找到',
      description: '抱歉，您访问的页面不存在或已被移动。',
      button: '返回首页',
    },
    en: {
      title: 'Page Not Found',
      description: 'Sorry, the page you’re looking for doesn’t exist or has been moved.',
      button: 'Go Back Home',
    },
  };

  const t = messages[lang];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t.title}</h2>
      <p className="text-gray-500 mb-6">{t.description}</p>
      <Link href="/" passHref>
        <Button variant="outline">{t.button}</Button>
      </Link>
    </div>
  );
}
