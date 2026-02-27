"use client";

const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 700;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function createParticles(width: number, height: number) {
  const area = width * height;
  const particleCount = Math.min(42, Math.max(18, Math.round(area / 280)));
  const centerX = width / 2;
  const centerY = height / 2;

  return Array.from({ length: particleCount }, () => {
    const originX = Math.random() * width;
    const originY = Math.random() * height;
    const distanceFromCenter = Math.hypot(originX - centerX, originY - centerY);
    const normalizedDistance = Math.min(
      1,
      distanceFromCenter / Math.hypot(centerX, centerY),
    );

    const size = (2 + Math.random() * 4) * (1 - normalizedDistance * 0.35);
    const travelY = -(60 + Math.random() * 40);
    const travelX = (Math.random() - 0.5) * 26;

    return {
      originX,
      originY,
      size: Math.max(1.2, size),
      travelX,
      travelY,
      driftX: (Math.random() - 0.5) * 6,
    };
  });
}

async function shatterElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.position = "fixed";
  canvas.style.left = `${rect.left}px`;
  canvas.style.top = `${rect.top}px`;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const style = window.getComputedStyle(element);
  const particleColor = style.backgroundColor || "#3b82f6";
  const particles = createParticles(rect.width, rect.height);
  const duration = MIN_DURATION_MS + Math.random() * (MAX_DURATION_MS - MIN_DURATION_MS);

  document.body.appendChild(canvas);

  const previousVisibility = element.style.visibility;
  element.style.visibility = "hidden";

  await new Promise<void>((resolve) => {
    const start = performance.now();

    const render = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      const fade = 1 - eased;

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalAlpha = fade;
      ctx.fillStyle = particleColor;

      for (const particle of particles) {
        const x = particle.originX + particle.travelX * eased + particle.driftX * progress;
        const y = particle.originY + particle.travelY * eased;
        ctx.fillRect(x, y, particle.size, particle.size);
      }

      if (progress < 1) {
        requestAnimationFrame(render);
      } else {
        canvas.remove();
        element.style.visibility = previousVisibility;
        resolve();
      }
    };

    requestAnimationFrame(render);
  });
}

export async function playEventShatterAnimation(eventId: string) {
  if (typeof window === "undefined") return;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("[data-event-shatter-id]"),
  ).filter((element) => element.dataset.eventShatterId === eventId);

  if (elements.length === 0) return;

  await Promise.all(elements.map((element) => shatterElement(element)));
}
