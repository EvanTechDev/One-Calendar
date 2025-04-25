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

  if (isMobile) {
    return (
      <div>
        <div
          style={{
            background: "#fff",
            borderRadius: "24px",
            boxShadow: "0 8px 32px rgba(60,70,130,0.12), 0 1.5px 4px rgba(80,90,210,0.09)",
            padding: "36px 24px",
            maxWidth: "350px",
            width: "90vw",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px"
          }}
        >
          <p style={{
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "#444d63",
            textAlign: "center",
            margin: 0,
            lineHeight: 1.5
          }}>
            {isChinese
              ? "请使用电脑访问此页面，以获得最佳体验"
              : "Please open this page on a computer for best experience"}
          </p>
        </div>
      </div>
    )
  }

  return <Calendar />;
}
