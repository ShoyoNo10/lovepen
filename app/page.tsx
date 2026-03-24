"use client";

import Link from "next/link";
import { useMemo } from "react";

function createRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function HomePage() {
  const roomId = useMemo(() => createRoomId(), []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
        <div className="mt-16 w-full rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <h1 className="text-4xl font-black sm:text-5xl">DrawTogether</h1>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Найзтайгаа эсвэл хостойгоо нэг canvas дээр real-time зурдаг жижиг
            хөөрхөн site 😎
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href={`/room/${roomId}`}
              className="rounded-2xl bg-cyan-500 px-6 py-4 text-base font-bold text-white transition hover:scale-[1.02] hover:bg-cyan-400"
            >
              Шинэ room үүсгэх
            </Link>

            <Link
              href="/room/demo1234"
              className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-base font-bold text-white transition hover:scale-[1.02] hover:bg-white/15"
            >
              Demo room орох
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-sm text-slate-300">
            <p>1. Room үүсгэнэ</p>
            <p>2. Link-ээ найздаа явуулна</p>
            <p>3. 2-уулаа зэрэг зурахад шууд харна</p>
          </div>
        </div>
      </div>
    </main>
  );
}