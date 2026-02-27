"use client";

import type { CSSProperties } from "react";

const PARTICLE_COUNT = 52;

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
  const col = index % 13;
  const row = Math.floor(index / 13);
  return {
    left: 5 + col * 7 + (row % 2) * 2,
    top: 8 + row * 18 + (col % 3),
    dx: -32 + (index % 8) * 9,
    dy: -120 - (index % 6) * 18,
    delay: (index % 10) * 22,
    duration: 1150 + (index % 9) * 80,
    size: 1 + (index % 3),
  };
});

export default function DeleteParticleLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="calendar-delete-particle"
          style={
            {
              left: `${particle.left}%`,
              top: `${Math.min(92, particle.top)}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
              "--particle-delay": `${particle.delay}ms`,
              "--particle-duration": `${particle.duration}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
