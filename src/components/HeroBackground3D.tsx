// src/components/HeroBackground3D.tsx
import { useEffect, useRef } from "react";

const ORBS = [
  { size: 260, top: "-10%", left: "8%", delay: 0, duration: 26 },
  { size: 180, top: "45%", left: "82%", delay: 3, duration: 22 },
  { size: 320, top: "55%", left: "28%", delay: 6, duration: 30 },
  { size: 150, top: "5%", left: "68%", delay: 2, duration: 20 },
  { size: 120, top: "70%", left: "58%", delay: 4, duration: 24 },
];

const GEMS = [
  { size: 46, top: "18%", left: "14%", delay: 0.5, duration: 20 },
  { size: 34, top: "62%", left: "85%", delay: 2.5, duration: 18 },
  { size: 40, top: "72%", left: "12%", delay: 4.5, duration: 22 },
  { size: 30, top: "12%", left: "78%", delay: 1.5, duration: 19 },
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
      const x = (e.clientX / window.innerWidth - 0.5) * 6;
      const y = (e.clientY / window.innerHeight - 0.5) * 6;
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
        perspective: "1200px",
        pointerEvents: "none",
      }}
    >
      {/* Soft editorial spotlight glow */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          right: "-15%",
          width: "70%",
          height: "160%",
          background:
            "radial-gradient(closest-side, rgba(191,155,48,0.18), rgba(191,155,48,0.05) 55%, transparent 75%)",
          filter: "blur(10px)",
        }}
      />

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
        {/* Large soft glowing orbs */}
        {ORBS.map((s, i) => (
          <div
            key={`orb-${i}`}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, rgba(212,175,100,0.22), rgba(191,155,48,0.06) 60%, transparent 75%)",
              filter: "blur(2px)",
              animation: `orbFloat ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* Small faceted gem accents */}
        {GEMS.map((s, i) => (
          <div
            key={`gem-${i}`}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              transformStyle: "preserve-3d",
              animation: `gemFloat ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(135deg, rgba(212,175,100,0.55), rgba(191,155,48,0.15))",
                border: "1px solid rgba(230,197,120,0.6)",
                boxShadow: "0 0 18px 2px rgba(191,155,48,0.25)",
                transform: "rotate(45deg)",
                borderRadius: "3px",
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes orbFloat {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          50% {
            transform: translateY(-30px) translateX(12px) scale(1.06);
          }
        }
        @keyframes gemFloat {
          0%, 100% {
            transform: translateY(0px) translateZ(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-18px) translateZ(30px) rotate(12deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
