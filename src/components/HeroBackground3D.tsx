// src/components/HeroBackground3D.tsx
import { useEffect, useRef } from "react";

const SHAPES = [
  { size: 90, top: "15%", left: "10%", delay: 0, duration: 22 },
  { size: 60, top: "55%", left: "80%", delay: 3, duration: 18 },
  { size: 120, top: "70%", left: "20%", delay: 6, duration: 26 },
  { size: 70, top: "20%", left: "75%", delay: 2, duration: 20 },
  { size: 45, top: "40%", left: "50%", delay: 4, duration: 24 },
];

export default function HeroBackground3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion || !containerRef.current) return;

    const el = containerRef.current;
    const handleMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      el.style.setProperty("--parallax-x", `${x}deg`);
      el.style.setProperty("--parallax-y", `${y}deg`);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        perspective: "1000px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform:
            "rotateX(var(--parallax-y, 0deg)) rotateY(var(--parallax-x, 0deg))",
          transition: "transform 0.6s ease-out",
          transformStyle: "preserve-3d",
        }}
      >
        {SHAPES.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              transformStyle: "preserve-3d",
              animation: `float3d ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid rgba(212, 175, 100, 0.35)",
                background: "rgba(212, 175, 100, 0.03)",
                transform: "rotateX(45deg) rotateY(45deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid rgba(212, 175, 100, 0.2)",
                background: "rgba(212, 175, 100, 0.02)",
                transform: "rotateX(45deg) rotateY(45deg) translateZ(20px)",
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes float3d {
          0%, 100% {
            transform: translateY(0px) translateZ(0px) rotateZ(0deg);
          }
          50% {
            transform: translateY(-25px) translateZ(40px) rotateZ(15deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
