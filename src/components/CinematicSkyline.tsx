// src/components/CinematicSkyline.tsx
import { useEffect, useRef } from "react";

export default function CinematicSkyline() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let ticking = false;
    const handleMove = (clientX: number, clientY: number) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const x = (clientX / window.innerWidth - 0.5) * 2;
        const y = (clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty("--px", `${x * 5}px`);
        el.style.setProperty("--py", `${y * 2}px`);
        ticking = false;
      });
    };
    const onMouse = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    window.addEventListener("mousemove", onMouse);
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "linear-gradient(180deg, #0a0806 0%, #171009 55%, #24180f 100%)",
      }}
    >
      {/* Far background — generic distant Doha skyline filler */}
      <svg viewBox="0 0 1600 500" preserveAspectRatio="none"
        style={{ position: "absolute", bottom: 0, width: "110%", left: "-5%",
          opacity: 0.2, transform: "translateX(calc(var(--px, 0px) * 0.3))",
          transition: "transform 0.4s ease-out" }}>
        <rect x="60" y="220" width="35" height="280" fill="#d4af64" />
        <rect x="130" y="180" width="28" height="320" fill="#d4af64" />
        <rect x="900" y="200" width="40" height="300" fill="#d4af64" />
        <rect x="1350" y="230" width="32" height="270" fill="#d4af64" />
        <rect x="1450" y="190" width="30" height="310" fill="#d4af64" />
      </svg>

      {/* Mid layer — LUSAIL: Katara Towers (twin curved "swords" meeting at top) */}
      <svg viewBox="0 0 1600 500" preserveAspectRatio="none"
        style={{ position: "absolute", bottom: 0, width: "115%", left: "-7%",
          opacity: 0.4, transform: "translateX(calc(var(--px, 0px) * 0.6))",
          transition: "transform 0.4s ease-out" }}>
        {/* Katara Tower left (leaning right, curved) */}
        <path d="M 250,500 L 258,220 Q 262,130 300,90 L 308,95 Q 285,140 282,225 L 292,500 Z" fill="#d4af64" />
        {/* Katara Tower right (leaning left, curved, meeting near top) */}
        <path d="M 340,500 L 332,220 Q 328,130 300,90 L 292,95 Q 315,140 318,225 L 308,500 Z" fill="#d4af64" />
        {/* Lusail generic mid-rise cluster */}
        <rect x="420" y="260" width="45" height="240" fill="#d4af64" />
        <rect x="480" y="200" width="38" height="300" fill="#d4af64" />
        <rect x="540" y="240" width="42" height="260" fill="#d4af64" />
      </svg>

      {/* Near layer — DOHA: Burj Qatar (cylindrical tapered tower) + Aspire Tower (torch) + skyline */}
      <svg viewBox="0 0 1600 500" preserveAspectRatio="none"
        style={{ position: "absolute", bottom: 0, width: "120%", left: "-10%",
          transform: "translateX(calc(var(--px, 0px) * 1))",
          transition: "transform 0.4s ease-out" }}>
        {/* Base skyline silhouette */}
        <path d="M0,500 L0,380 L60,380 L60,300 L120,300 L120,400 L190,400 L190,340 L260,340 L260,420 L340,420 L340,360 L400,360 L400,430 L470,430 L470,300 L1130,300 L1130,430 L1200,430 L1200,360 L1260,360 L1260,420 L1340,420 L1340,340 L1400,340 L1400,400 L1470,400 L1470,300 L1540,300 L1540,380 L1600,380 L1600,500 Z" fill="#050403" />

        {/* Burj Qatar — tapered cylindrical tower (Doha Tower landmark) */}
        <path d="M 720,430 L 730,180 Q 733,120 750,95 Q 767,120 770,180 L 780,430 Z" fill="#050403" />
        <ellipse cx="750" cy="95" rx="6" ry="4" fill="#050403" />

        {/* Aspire Tower — torch shape with flame-like top */}
        <path d="M 850,430 L 856,240 Q 856,200 850,175 Q 844,150 850,120 Q 856,140 862,175 Q 862,200 862,240 L 868,430 Z" fill="#050403" />
        <path d="M 848,120 Q 850,100 856,90 Q 862,100 862,122 Z" fill="#050403" />

        {/* window lights across the base silhouette */}
        {Array.from({ length: 15 }).map((_, i) => (
          <rect key={i} x={40 + (i * 95) % 1550} y={350 + ((i * 41) % 70)}
            width="4" height="6" fill="rgba(212,175,100,0.6)"
            style={{ animation: `twinkle ${6 + (i % 5) * 1.6}s ease-in-out ${(i % 7) * 0.4}s infinite` }} />
        ))}
      </svg>

      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.9; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </div>
  );
}
