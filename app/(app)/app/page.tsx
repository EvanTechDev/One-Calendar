"use client"

import { useEffect, useState } from "react";
import Calendar from "@/components/Calendar";
import { useTheme } from "next-themes";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [isChinese, setIsChinese] = useState(false);
  const { theme } = useTheme();

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

  useEffect(() => {
    const body = document.body;
    const colorThemes = ['blue', 'green', 'purple', 'orange'];
    
    body.classList.add('app');
    
    if (theme && colorThemes.includes(theme)) {
      body.classList.add(theme);
    }

    return () => {
      body.classList.remove('app');
      colorThemes.forEach(colorTheme => {
        body.classList.remove(colorTheme);
      });
    };
  }, [theme]);

  return <Calendar />;
}
