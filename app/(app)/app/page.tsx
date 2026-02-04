"use client"
import { useEffect, useState } from "react";
import Calendar from "@/components/Calendar";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);
  {/*if (isMobile) {
    return (
      
    )
  }*/}

  return <Calendar />;
}
