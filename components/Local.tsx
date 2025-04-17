"use client"

import { useState } from "react"

export default function LocationButton() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("浏览器不支持地理位置功能");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLon(position.coords.longitude);
      },
      (err) => {
        setError(`获取位置失败: ${err.message}`);
      }
    );
  };

  return (
    <div>
      <button onClick={handleGetLocation}>获取我的位置</button>
      {lat && lon && (
        <p>
          纬度: {lat}, 经度: {lon}
        </p>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
