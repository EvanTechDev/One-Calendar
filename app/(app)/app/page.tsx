"use client"

import { useEffect, useState } from "react";
import Calendar from "@/components/Calendar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Home() {
  const isMobile = useIsMobile();
  const [isChinese, setIsChinese] = useState(false);

  useEffect(() => {
    const lang = navigator.language;
    setIsChinese(lang.startsWith("zh"));
  }, []);

  return (
    <div>
      {isMobile ? (
        <div>
          <p>{isChinese ? "请使用电脑打开此页面" : "Please open this page on a computer"}</p>
        </div>
      ) : (
        <Calendar />
      )}
    </div>
  );
}
