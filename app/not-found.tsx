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
      <div className="fixed -z-10 inset-0">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
          <div className="absolute inset-0 dark:block hidden" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
      </div>
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t.title}</h2>
      <p className="text-gray-500 mb-6">{t.description}</p>
      <Link href="/" passHref>
        <Button variant="outline">{t.button}</Button>
      </Link>
    </div>
  );
}
