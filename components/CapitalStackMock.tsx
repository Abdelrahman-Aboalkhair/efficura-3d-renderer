"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Display-only port of Labrador's capital-stack tower (see approvals-app,
 * `credit/[dealId]/components/capital-stack/`): an orthographic three.js
 * tower of tranche slabs with curved leader lines fanning out to staggered
 * percent + funder labels on the right. Interactivity (hover spread, pick-out,
 * spin) is stripped for the marketing mock; instead the slabs settle together
 * from a gentle spread on mount so the widget arrives alive. Geometry, camera
 * and light constants match the app so the render reads identically.
 *
 * Source: efficuraweb/components/CapitalStackMock.tsx
 */

/** One tranche of the stack, ordered top → bottom (equity → senior). */
export interface StackTranche {
  /** Share of the tower height (0–1); the fractions sum to 1. */
  fraction: number;
  /** Headline percentage label, e.g. "35.5%". */
  percent: string;
  /** Funder name shown under the percentage. */
  name: string;
  /** Slab + leader-dot colour. */
  color: string;
}

// ── Tower geometry (world units) - mirrors the app's squat overview tower ────
const SIDE = 1.7; // width === depth
const TOTAL_H = 2.1;
const TOWER_X = -0.5; // nudge left of centre so the labels have room
const ROT = 0.32; // group turn → dominant front face + thin right face
const ZOOM = 90;
const CAM_POS: [number, number, number] = [0, 2.7, 7];
const LOOK_Y = 0.18;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const INTRO_SPREAD = 0.3; // slabs start this far apart and settle together

// ── Overlay layout (px, tuned for a ~360px widget then scaled down) ──────────
const LEFT_PAD = 10;
const LABEL_AREA = 178;
const PAD_V = 40;
const STAGGER = 20;

interface SlabLayout {
  color: string;
  height: number;
  centerY: number;
  /** Continuous −1…+1 position so the middle slab barely moves on spread. */
  dir: number;
}

/** Anchor (px, relative to the canvas) where a leader line meets a slab. */
interface SlabAnchor {
  x: number;
  y: number;
}

function layoutSlabs(
  slabs: ReadonlyArray<{ color: string; fraction: number }>
): SlabLayout[] {
  const half = TOTAL_H / 2;
  let cursor = -half;
  return slabs.map((slab) => {
    const height = Math.max(slab.fraction, 0.001) * TOTAL_H;
    const centerY = cursor + height / 2;
    cursor += height;
    return { color: slab.color, height, centerY, dir: centerY / half };
  });
}

// One slab: starts vertically spread and damps into the resting stack,
// invalidating the demand-driven loop until it settles.
function Slab({ layout }: { layout: SlabLayout }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const spread = useRef(1);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    spread.current = THREE.MathUtils.damp(spread.current, 0, 3.5, dt);
    mesh.position.y =
      layout.centerY + layout.dir * INTRO_SPREAD * spread.current;
    if (spread.current > 0.001) invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, layout.centerY + layout.dir * INTRO_SPREAD, 0]}
    >
      <boxGeometry args={[SIDE, layout.height, SIDE]} />
      <meshStandardMaterial
        color={layout.color}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

function Scene({
  layouts,
  onAnchors,
}: {
  layouts: SlabLayout[];
  onAnchors: (anchors: SlabAnchor[]) => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  // The orthographic zoom is fixed in world units, so the tower would render
  // at a constant pixel size and overflow a narrow grid cell. Scale the zoom
  // to fit the canvas - never larger than the design zoom.
  useEffect(() => {
    if (!size.width || !size.height) return;
    const fit = Math.max(0.3, Math.min(1, size.width / 360, size.height / 320));
    const orthoCam = camera as THREE.OrthographicCamera;
    // eslint-disable-next-line react-hooks/immutability
    orthoCam.zoom = ZOOM * fit;
    orthoCam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  // Project each slab's resting right-edge anchor to pixel space for the
  // leader lines (the intro spread is transient, so anchors use the rest pose).
  useEffect(() => {
    if (!size.width || !size.height) return;
    camera.updateMatrixWorld();
    const anchors = layouts.map((l) => {
      const v = new THREE.Vector3(SIDE / 2, l.centerY, SIDE / 2);
      v.applyAxisAngle(Y_AXIS, ROT);
      v.x += TOWER_X; // mirror the group's left offset
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (1 - (v.y * 0.5 + 0.5)) * size.height,
      };
    });
    onAnchors(anchors);
  }, [layouts, camera, size.width, size.height, onAnchors]);

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[-5, 7, 4]} intensity={1.25} />
      <group rotation={[0, ROT, 0]} position={[TOWER_X, 0, 0]}>
        {layouts.map((layout, i) => (
          <Slab key={i} layout={layout} />
        ))}
      </group>
    </>
  );
}

/** Track the rendered size so the SVG overlay uses crisp pixel coordinates. */
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

export default function CapitalStackMock({
  tranches,
}: {
  /** Tranches ordered top → bottom (equity → senior). */
  tranches: StackTranche[];
}) {
  const [containerRef, size] = useSize();
  const [anchors, setAnchors] = useState<SlabAnchor[]>([]);

  // Slabs for the canvas, ordered bottom → top (senior → equity).
  const layouts = useMemo(
    () =>
      layoutSlabs(
        [...tranches]
          .reverse()
          .map((t) => ({ color: t.color, fraction: t.fraction }))
      ),
    [tranches]
  );

  const { w, h } = size;
  const n = tranches.length;

  // Scale the label band, stagger and fonts down with the container width so
  // the widget survives a narrow grid cell.
  const scale = w > 0 ? Math.max(0.55, Math.min(1, w / 360)) : 1;
  const labelArea = LABEL_AREA * scale;
  const stagger = STAGGER * scale;
  const padV = PAD_V * scale;
  const percentFontSize = `${(1.5 * scale).toFixed(3)}rem`;
  const nameFontSize = `${(0.8125 * scale).toFixed(3)}rem`;

  // Evenly spaced, staggered label stations (top → bottom), kept a clear
  // gutter to the right of the tower's rightmost anchor.
  const gutter = 20 * scale;
  const rightmostAnchorX = anchors.length
    ? Math.max(...anchors.map((a) => LEFT_PAD + a.x))
    : 0;
  const baseX = Math.max(w - labelArea + 8, rightmostAnchorX + gutter);
  const usableH = Math.max(h - padV * 2, 1);
  const stationY = tranches.map((_, i) => padV + ((i + 0.5) * usableH) / n);
  const stationX = tranches.map((_, i) => baseX + i * stagger);

  return (
    <div ref={containerRef} style={{ position: "relative", height: "100%", width: "100%" }}>
      {/* Soft background disc behind the (left-anchored) tower. */}
      <div
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          bottom: 0,
          left: LEFT_PAD,
          right: "52%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            aspectRatio: "1",
            height: "90%",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(212,212,216,0.55), rgba(212,212,216,0) 70%)",
          }}
        />
      </div>

      {/* 3D tower */}
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
          onCreated={({ camera }) => {
            camera.lookAt(0, LOOK_Y, 0);
            camera.updateProjectionMatrix();
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene layouts={layouts} onAnchors={setAnchors} />
        </Canvas>
      </div>

      {/* Curved leader lines fanning from each slab to its label. */}
      {w > 0 ? (
        <svg
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            color: "#71717a",
          }}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
        >
          {tranches.map((tranche, i) => {
            const anchor = anchors[n - 1 - i];
            if (!anchor) return null;
            const ax = LEFT_PAD + anchor.x;
            const ay = anchor.y;
            const sx = stationX[i]!;
            const sy = stationY[i]!;
            const dx = Math.max((sx - ax) * 0.45, 14);
            return (
              <g key={`${tranche.name}-line`}>
                <path
                  d={`M ${ax} ${ay} C ${ax + dx} ${ay}, ${sx - dx} ${sy}, ${sx} ${sy}`}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.5}
                  strokeWidth={1.4}
                />
                <circle
                  cx={ax}
                  cy={ay}
                  r={4 * scale}
                  fill="#fff"
                  stroke={tranche.color}
                  strokeWidth={2.5 * scale}
                />
                <circle cx={sx} cy={sy} r={2.5 * scale} fill={tranche.color} />
              </g>
            );
          })}
        </svg>
      ) : null}

      {/* Right-side tranche labels - percent + funder name. */}
      {h > 0
        ? tranches.map((tranche, i) => {
            const sx = stationX[i]!;
            const sy = stationY[i]!;
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
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                    color: "#27272a",
                    fontSize: percentFontSize,
                  }}
                >
                  {tranche.percent}
                </span>
                <span
                  style={{
                    marginTop: 2,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: "#71717a",
                    fontSize: nameFontSize,
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
