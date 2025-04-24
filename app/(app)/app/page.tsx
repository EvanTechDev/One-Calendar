"use client"

import { useEffect, useState } from "react";
import Calendar from "@/components/Calendar";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [isChinese, setIsChinese] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIfMobile();

    window.addEventListener("resize", checkIfMobile);

    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

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
