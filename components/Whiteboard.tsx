"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  onChildAdded,
  onValue,
  push,
  ref,
  remove,
  set,
} from "firebase/database";
import { db } from "@/lib/firebase";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  color: string;
  size: number;
  tool: "pen" | "eraser";
  points: Point[];
};

interface WhiteboardProps {
  roomId: string;
}

function generateStrokeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Whiteboard({ roomId }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [color, setColor] = useState<string>("#22c55e");
  const [size, setSize] = useState<number>(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const roomStrokesRef = useMemo(() => ref(db, `rooms/${roomId}/strokes`), [roomId]);
  const roomMetaRef = useMemo(() => ref(db, `rooms/${roomId}/meta`), [roomId]);

  const resizeCanvas = useCallback((): void => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = 520 * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "520px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    redrawAll(strokes);
  }, [strokes]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke): void => {
    if (stroke.points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.size;

    const first = stroke.points[0];
    ctx.moveTo(first.x, first.y);

    if (stroke.points.length === 1) {
      ctx.lineTo(first.x + 0.01, first.y + 0.01);
    } else {
      for (let i = 1; i < stroke.points.length; i += 1) {
        const point = stroke.points[i];
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.stroke();
  }, []);

  const redrawAll = useCallback(
    (allStrokes: Stroke[]): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (const stroke of allStrokes) {
        drawStroke(ctx, stroke);
      }
    },
    [drawStroke]
  );

  useEffect(() => {
    const unsubscribe = onChildAdded(roomStrokesRef, (snapshot) => {
      const value = snapshot.val() as Omit<Stroke, "id"> | null;
      if (!value) return;

      const incoming: Stroke = {
        id: snapshot.key || generateStrokeId(),
        color: value.color,
        size: value.size,
        tool: value.tool,
        points: Array.isArray(value.points) ? value.points : [],
      };

      setStrokes((prev) => {
        const exists = prev.some((item) => item.id === incoming.id);
        if (exists) return prev;
        return [...prev, incoming];
      });
    });

    return () => unsubscribe();
  }, [roomStrokesRef]);

  useEffect(() => {
    const unsubscribe = onValue(roomStrokesRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Stroke, "id">> | null;

      if (!value) {
        setStrokes([]);
        return;
      }

      const next: Stroke[] = Object.entries(value).map(([id, item]) => ({
        id,
        color: item.color,
        size: item.size,
        tool: item.tool,
        points: Array.isArray(item.points) ? item.points : [],
      }));

      setStrokes(next);
    });

    return () => unsubscribe();
  }, [roomStrokesRef]);

  useEffect(() => {
    redrawAll(strokes);
  }, [strokes, redrawAll]);

  useEffect(() => {
    const handler = (): void => resizeCanvas();

    resizeCanvas();
    window.addEventListener("resize", handler);

    return () => {
      window.removeEventListener("resize", handler);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    void set(roomMetaRef, {
      updatedAt: Date.now(),
      roomId,
    });
  }, [roomId, roomMetaRef]);

  const getPoint = (clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startStroke = (point: Point): void => {
    const newStroke: Stroke = {
      id: generateStrokeId(),
      color,
      size,
      tool,
      points: [point],
    };

    currentStrokeRef.current = newStroke;
    setIsDrawing(true);

    setStrokes((prev) => [...prev, newStroke]);
  };

  const appendPoint = (point: Point): void => {
    const current = currentStrokeRef.current;
    if (!current) return;

    current.points.push(point);

    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.id === current.id
          ? { ...stroke, points: [...current.points] }
          : stroke
      )
    );
  };

  const endStroke = async (): Promise<void> => {
    const current = currentStrokeRef.current;
    if (!current) {
      setIsDrawing(false);
      return;
    }

    currentStrokeRef.current = null;
    setIsDrawing(false);

    const strokeRef = push(roomStrokesRef);

    await set(strokeRef, {
      color: current.color,
      size: current.size,
      tool: current.tool,
      points: current.points,
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const point = getPoint(event.clientX, event.clientY);
    if (!point) return;
    startStroke(point);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!isDrawing) return;
    const point = getPoint(event.clientX, event.clientY);
    if (!point) return;
    appendPoint(point);
  };

  const handleMouseUp = (): void => {
    void endStroke();
  };

  const handleMouseLeave = (): void => {
    if (isDrawing) {
      void endStroke();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;

    const point = getPoint(touch.clientX, touch.clientY);
    if (!point) return;

    startStroke(point);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (!isDrawing) return;

    const touch = event.touches[0];
    if (!touch) return;

    const point = getPoint(touch.clientX, touch.clientY);
    if (!point) return;

    appendPoint(point);
  };

  const handleTouchEnd = (): void => {
    void endStroke();
  };

  const clearBoard = async (): Promise<void> => {
    await remove(roomStrokesRef);
    setStrokes([]);
  };

  const copyLink = async (): Promise<void> => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    window.alert("Room link copy хийгдлээ 🔗");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br  from-slate-950 via-slate-900 to-slate-800 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Room: {roomId}</h1>
              <p className="mt-1 text-sm text-slate-300">
                Link-ээ share хийгээд нэг canvas дээр зэрэг зур 😎
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTool("pen")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  tool === "pen"
                    ? "bg-cyan-500 text-white"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                Pen
              </button>

              <button
                onClick={() => setTool("eraser")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  tool === "eraser"
                    ? "bg-pink-500 text-white"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                Eraser
              </button>

              <button
                onClick={() => void copyLink()}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400"
              >
                Link copy
              </button>

              <button
                onClick={() => void clearBoard()}
                className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <label htmlFor="color" className="text-sm font-semibold text-slate-200">
                Color
              </label>
              <input
                id="color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-11 w-16 cursor-pointer rounded-xl border border-white/10 bg-transparent"
                disabled={tool === "eraser"}
              />
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="size" className="text-sm font-semibold text-slate-200">
                Size
              </label>
              <input
                id="size"
                type="range"
                min={2}
                max={24}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-48"
              />
              <span className="min-w-[32px] text-sm text-slate-300">{size}</span>
            </div>
          </div>
        </div>

        <div
          ref={wrapperRef}
          style={{ touchAction: "none" }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl touch-none"
        >
          <canvas
            ref={canvasRef}
            style={{ touchAction: "none" }}
            className="block touch-none select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
      </div>
    </main>
  );
}