import * as React from 'react'
import Calendar from "@/components/Calendar"
import { useIsMobile } from "@/hooks/use-mobile"

export default function Home() {
  const isMobile = useIsMobile();
  const userLanguage = navigator.language || navigator.userLanguage;

  const isChinese = userLanguage.startsWith('zh');
  const isEnglish = userLanguage.startsWith('en');

  return (
    <div>
      {isMobile ? (
        <div>
          {isChinese ? (
            <p>请使用电脑打开此页面</p>
          ) : isEnglish ? (
            <p>Please open this page on a computer</p>
          ) : (
            <p>请使用电脑打开此页面。/ Please open this page on a computer.</p>
          )}
        </div>
      ) : (
        <Calendar />
      )}
    </div>
  );
}
