"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Capital-stack tower for iframe embedding.
 *
 * - Orthographic 3D slabs (R3F / three.js)
 * - Intro settle from a gentle spread
 * - Hover any slab → stack divides; the hovered tranche stays primary,
 *   others mute (lower opacity / gray labels & leader lines)
 * - Fully transparent background (Framer provides the fill)
 */

export interface StackTranche {
  fraction: number;
  percent: string;
  name: string;
  color: string;
}

// ── Tower geometry ───────────────────────────────────────────────────────────
const SIDE = 1.7;
const TOTAL_H = 2.1;
const TOWER_X = -0.5;
const ROT = 0.32;
const ZOOM = 90;
const CAM_POS: [number, number, number] = [0, 2.7, 7];
const LOOK_Y = 0.18;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const INTRO_SPREAD = 0.3;
const HOVER_SPREAD = 0.42;

// ── Overlay layout (px) ──────────────────────────────────────────────────────
const LEFT_PAD = 10;
const LABEL_AREA = 178;
const PAD_V = 40;
const STAGGER = 20;

const MUTED_LINE = "rgba(140, 140, 150, 0.35)";
const MUTED_LABEL = "rgba(180, 180, 190, 0.45)";
const MUTED_NAME = "rgba(160, 160, 170, 0.4)";

interface SlabLayout {
  color: string;
  height: number;
  centerY: number;
  dir: number;
  /** Index in the original tranches array (top → bottom). */
  trancheIndex: number;
}

function layoutSlabs(
  tranches: ReadonlyArray<StackTranche>
): SlabLayout[] {
  // Build bottom → top for stacking, but keep original tranche index.
  const half = TOTAL_H / 2;
  let cursor = -half;
  const reversed = [...tranches].reverse();
  return reversed.map((slab, revIdx) => {
    const height = Math.max(slab.fraction, 0.001) * TOTAL_H;
    const centerY = cursor + height / 2;
    cursor += height;
    const trancheIndex = tranches.length - 1 - revIdx;
    return {
      color: slab.color,
      height,
      centerY,
      dir: centerY / half,
      trancheIndex,
    };
  });
}

function SpreadDriver({
  isSpread,
  activeIndex,
  spreadRef,
}: {
  isSpread: boolean;
  activeIndex: number | null;
  spreadRef: React.MutableRefObject<{ intro: number; hover: number }>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  // Kick demand loop on spread toggle and when the active slab changes.
  useEffect(() => {
    invalidate();
  }, [isSpread, activeIndex, invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const nextIntro = THREE.MathUtils.damp(spreadRef.current.intro, 0, 3.5, dt);
    const nextHover = THREE.MathUtils.damp(
      spreadRef.current.hover,
      isSpread ? 1 : 0,
      6,
      dt
    );
    spreadRef.current.intro = nextIntro;
    spreadRef.current.hover = nextHover;

    if (
      nextIntro > 0.001 ||
      Math.abs(nextHover - (isSpread ? 1 : 0)) > 0.001
    ) {
      invalidate();
    }
  });

  return null;
}

function Slab({
  layout,
  spreadRef,
  isActive,
  hasActive,
  onHover,
}: {
  layout: SlabLayout;
  spreadRef: React.MutableRefObject<{ intro: number; hover: number }>;
  isActive: boolean;
  hasActive: boolean;
  onHover: (trancheIndex: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const opacity = hasActive && !isActive ? 0.42 : 1;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { intro, hover } = spreadRef.current;
    const offset =
      layout.dir * (INTRO_SPREAD * intro + HOVER_SPREAD * hover);
    mesh.position.y = layout.centerY + offset;
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, layout.centerY + layout.dir * INTRO_SPREAD, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(layout.trancheIndex);
      }}
    >
      <boxGeometry args={[SIDE, layout.height, SIDE]} />
      <meshStandardMaterial
        color={layout.color}
        roughness={0.92}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function AnchorProjector({
  layouts,
  spreadRef,
  anchorsRef,
  onReady,
}: {
  layouts: SlabLayout[];
  spreadRef: React.MutableRefObject<{ intro: number; hover: number }>;
  anchorsRef: React.MutableRefObject<Array<{ x: number; y: number }>>;
  onReady: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const readyOnce = useRef(false);

  useEffect(() => {
    if (!size.width || !size.height) return;
    const fit = Math.max(0.3, Math.min(1, size.width / 360, size.height / 320));
    const orthoCam = camera as THREE.OrthographicCamera;
    orthoCam.zoom = ZOOM * fit;
    orthoCam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  useFrame(() => {
    if (!size.width || !size.height) return;
    const { intro, hover } = spreadRef.current;
    camera.updateMatrixWorld();

    anchorsRef.current = layouts.map((l) => {
      const offset = l.dir * (INTRO_SPREAD * intro + HOVER_SPREAD * hover);
      const v = new THREE.Vector3(SIDE / 2, l.centerY + offset, SIDE / 2);
      v.applyAxisAngle(Y_AXIS, ROT);
      v.x += TOWER_X;
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (1 - (v.y * 0.5 + 0.5)) * size.height,
      };
    });

    if (!readyOnce.current) {
      readyOnce.current = true;
      onReady();
    }
  });

  return null;
}

function Scene({
  layouts,
  isSpread,
  activeIndex,
  spreadRef,
  anchorsRef,
  onAnchorsReady,
  onHover,
}: {
  layouts: SlabLayout[];
  isSpread: boolean;
  activeIndex: number | null;
  spreadRef: React.MutableRefObject<{ intro: number; hover: number }>;
  anchorsRef: React.MutableRefObject<Array<{ x: number; y: number }>>;
  onAnchorsReady: () => void;
  onHover: (trancheIndex: number) => void;
}) {
  const hasActive = activeIndex !== null;

  return (
    <>
      <SpreadDriver
        isSpread={isSpread}
        activeIndex={activeIndex}
        spreadRef={spreadRef}
      />
      <AnchorProjector
        layouts={layouts}
        spreadRef={spreadRef}
        anchorsRef={anchorsRef}
        onReady={onAnchorsReady}
      />
      <ambientLight intensity={1.7} />
      <directionalLight position={[-5, 7, 4]} intensity={1.25} />
      <group rotation={[0, ROT, 0]} position={[TOWER_X, 0, 0]}>
        {layouts.map((layout) => (
          <Slab
            key={layout.trancheIndex}
            layout={layout}
            spreadRef={spreadRef}
            isActive={activeIndex === layout.trancheIndex}
            hasActive={hasActive}
            onHover={onHover}
          />
        ))}
      </group>
    </>
  );
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function LeaderLines({
  tranches,
  scale,
  stationX,
  stationY,
  anchorsRef,
  activeIndex,
  tick,
}: {
  tranches: StackTranche[];
  scale: number;
  stationX: number[];
  stationY: number[];
  anchorsRef: React.MutableRefObject<Array<{ x: number; y: number }>>;
  activeIndex: number | null;
  tick: number;
}) {
  const groupRef = useRef<SVGGElement>(null);
  const n = tranches.length;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const g = groupRef.current;
      if (g) {
        const anchors = anchorsRef.current;
        for (let i = 0; i < n; i++) {
          // anchors are stored bottom→top; tranche i is top→bottom
          const anchor = anchors[n - 1 - i];
          if (!anchor) continue;
          const path = g.querySelector(
            `[data-line="${i}"]`
          ) as SVGPathElement | null;
          const dotA = g.querySelector(
            `[data-dot-a="${i}"]`
          ) as SVGCircleElement | null;
          const dotB = g.querySelector(
            `[data-dot-b="${i}"]`
          ) as SVGCircleElement | null;

          const ax = LEFT_PAD + anchor.x;
          const ay = anchor.y;
          const sx = stationX[i]!;
          const sy = stationY[i]!;
          const dx = Math.max((sx - ax) * 0.45, 14);

          if (path) {
            path.setAttribute(
              "d",
              `M ${ax} ${ay} C ${ax + dx} ${ay}, ${sx - dx} ${sy}, ${sx} ${sy}`
            );
          }
          if (dotA) {
            dotA.setAttribute("cx", String(ax));
            dotA.setAttribute("cy", String(ay));
          }
          if (dotB) {
            dotB.setAttribute("cx", String(sx));
            dotB.setAttribute("cy", String(sy));
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anchorsRef, n, stationX, stationY, tick]);

  return (
    <g ref={groupRef}>
      {tranches.map((tranche, i) => {
        const isActive = activeIndex === i;
        const isMuted = activeIndex !== null && !isActive;
        const stroke = isMuted
          ? MUTED_LINE
          : isActive
            ? tranche.color
            : "rgba(120, 120, 130, 0.65)";
        const strokeW = isActive ? 2 : 1.4;
        const endColor = isMuted ? "rgba(160,160,170,0.5)" : tranche.color;

        return (
          <g key={`${tranche.name}-line`}>
            <path
              data-line={i}
              d={`M 0 0`}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeW}
              style={{
                transition: "stroke 0.2s ease, stroke-width 0.2s ease",
              }}
            />
            <circle
              data-dot-a={i}
              cx={0}
              cy={0}
              r={4 * scale}
              fill="rgba(255,255,255,0.9)"
              stroke={endColor}
              strokeWidth={2.5 * scale}
              style={{ transition: "stroke 0.2s ease" }}
            />
            <circle
              data-dot-b={i}
              cx={0}
              cy={0}
              r={2.5 * scale}
              fill={endColor}
              style={{ transition: "fill 0.2s ease" }}
            />
          </g>
        );
      })}
    </g>
  );
}

export default function CapitalStackMock({
  tranches,
}: {
  tranches: StackTranche[];
}) {
  const [containerRef, size] = useSize();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [anchorsReady, setAnchorsReady] = useState(false);
  const spreadRef = useRef({ intro: 1, hover: 0 });
  const anchorsRef = useRef<Array<{ x: number; y: number }>>([]);

  const layouts = useMemo(() => layoutSlabs(tranches), [tranches]);

  const isSpread = activeIndex !== null;

  const handleHover = (trancheIndex: number) => {
    setActiveIndex(trancheIndex);
  };

  const handleCanvasLeave = () => {
    setActiveIndex(null);
  };

  const { w, h } = size;
  const n = tranches.length;

  const scale = w > 0 ? Math.max(0.55, Math.min(1, w / 360)) : 1;
  const labelArea = LABEL_AREA * scale;
  const stagger = STAGGER * scale;
  const padV = PAD_V * scale;
  const percentFontSize = `${(1.5 * scale).toFixed(3)}rem`;
  const nameFontSize = `${(0.8125 * scale).toFixed(3)}rem`;

  const baseX = Math.max(w - labelArea + 8, w * 0.45);
  const usableH = Math.max(h - padV * 2, 1);
  const stationY = useMemo(
    () => tranches.map((_, i) => padV + ((i + 0.5) * usableH) / n),
    [tranches, padV, usableH, n]
  );
  const stationX = useMemo(
    () => tranches.map((_, i) => baseX + i * stagger),
    [tranches, baseX, stagger]
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        background: "transparent",
      }}
      onPointerLeave={handleCanvasLeave}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: LEFT_PAD,
          right: LEFT_PAD,
        }}
      >
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: CAM_POS, zoom: ZOOM, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, LOOK_Y, 0);
            camera.updateProjectionMatrix();
            gl.setClearColor(0x000000, 0);
          }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
          onPointerMissed={handleCanvasLeave}
        >
          <Scene
            layouts={layouts}
            isSpread={isSpread}
            activeIndex={activeIndex}
            spreadRef={spreadRef}
            anchorsRef={anchorsRef}
            onAnchorsReady={() => setAnchorsReady(true)}
            onHover={handleHover}
          />
        </Canvas>
      </div>

      {w > 0 ? (
        <svg
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
          }}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
        >
          <LeaderLines
            tranches={tranches}
            scale={scale}
            stationX={stationX}
            stationY={stationY}
            anchorsRef={anchorsRef}
            activeIndex={activeIndex}
            tick={anchorsReady ? 1 : 0}
          />
        </svg>
      ) : null}

      {h > 0
        ? tranches.map((tranche, i) => {
            const sx = stationX[i]!;
            const sy = stationY[i]!;
            const isActive = activeIndex === i;
            const isMuted = activeIndex !== null && !isActive;

            const percentColor = isMuted
              ? MUTED_LABEL
              : isActive
                ? tranche.color
                : "rgba(245, 245, 245, 0.92)";
            const nameColor = isMuted
              ? MUTED_NAME
              : isActive
                ? tranche.color
                : "rgba(200, 200, 205, 0.85)";

            return (
              <div
                key={`${tranche.name}-label`}
                style={{
                  position: "absolute",
                  top: sy,
                  left: sx + 10,
                  width: Math.max(w - (sx + 10) - 8, 60),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  textAlign: "left",
                  lineHeight: 1.15,
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  transition: "opacity 0.2s ease",
                  opacity: isMuted ? 0.7 : 1,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                    color: percentColor,
                    fontSize: percentFontSize,
                    textShadow: isMuted
                      ? "none"
                      : "0 1px 2px rgba(0,0,0,0.35)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {tranche.percent}
                </span>
                <span
                  style={{
                    marginTop: 2,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: nameColor,
                    fontSize: nameFontSize,
                    textShadow: isMuted
                      ? "none"
                      : "0 1px 2px rgba(0,0,0,0.3)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {tranche.name}
                </span>
              </div>
            );
          })
        : null}
    </div>
  );
}
