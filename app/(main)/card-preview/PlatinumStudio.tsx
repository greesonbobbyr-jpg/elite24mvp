"use client";
import { useEffect, useRef, useState } from "react";
import { PlayerCard, type CardPlayer } from "@/app/components/PlayerCard";
import { processPortrait, type PortraitResult } from "@/lib/portrait/process";
import { analyzePortrait } from "@/lib/portrait/analyze";
import { normalizePortrait } from "@/lib/portrait/normalize";
import { FINISH_ORDER, type FinishKey } from "@/lib/cardTheme";
const TEAM = { name: "Mustang Broncos", logoUrl: "/mustang-logo.png", primaryColor: "#c9223a", secondaryColor: "#f2a900" };
const SAMPLE: CardPlayer = { name: "Cason Wallace", jerseyNumber: 22, position: "COMBO GUARD", heightInches: 76, points: 525, total: 20000, rank: 1, rosterSize: 7 };
const REF = "/api/dev/reference/platinum-b3-outward-approved.png";
type ReadyPortrait = Exclude<PortraitResult, { error: string }>;

/** DEV ONLY: exercises the same portrait pipeline and PlayerCard as the app.
 * Photos never leave this browser; nothing here submits a player profile. */
export function PlatinumStudio({ isStatic }: { isStatic: boolean }) {
  const processingStarted = useRef(false);
  const [player, setPlayer] = useState<CardPlayer>(SAMPLE);
  const [status, setStatus] = useState("Loading the saved cutout…");
  const [busy, setBusy] = useState(false);
  const [freeze, setFreeze] = useState(isStatic);
  const [compare, setCompare] = useState(false);
  const [size, setSize] = useState(520);
  const [level, setLevel] = useState<FinishKey>("platinum");
  const [light, setLight] = useState(38);
  const [ready, setReady] = useState<ReadyPortrait | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.onload = async () => {
      try {
        const analysis = await analyzePortrait(img);
        const result = normalizePortrait(analysis);
        if (!active || processingStarted.current) return;
        if (result.ok) {
          setPlayer(p => ({ ...p, cutoutUrl: img.src, photoMeta: result.meta }));
          setStatus("Saved cutout loaded. Process the original to test background removal.");
        } else setStatus(`Saved cutout needs processing (${result.reason}).`);
      } catch { if (active) setStatus("Process the original photo to start."); }
    };
    img.onerror = () => { if (active) setStatus("Choose a chest-up photo to start."); };
    img.src = "/api/dev/reference/sample-athlete-cutout.png";
    return () => { active = false; };
  }, []);
  async function process(file: File) {
    processingStarted.current = true;
    setBusy(true); setError(""); setReady(null);
    try {
      const result = await processPortrait(file, (phase, progress) => setStatus(`${phase} ${Math.round(progress * 100)}%`));
      if ("error" in result) { setError(result.error); setStatus("Photo could not be prepared."); return; }
      setPlayer(p => ({ ...p, cutoutUrl: result.cutoutUrl, photoMeta: result.meta }));
      setReady(result);
      setStatus("Background removed and portrait fitted by the app pipeline. Nothing saved to a profile.");
    } catch (e) { setError(e instanceof Error ? e.message : "Photo processing failed."); }
    finally { setBusy(false); }
  }
  async function original() {
    setError("");
    try {
      const response = await fetch("/api/dev/reference/sample-athlete.png");
      if (!response.ok) throw new Error("Sample photo unavailable");
      await process(new File([await response.blob()], "cason.png", { type: "image/png" }));
    } catch (e) { setError(String(e)); }
  }
  const control = "rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-xs text-zinc-200";
  return <main className="mx-auto w-full max-w-[1500px] px-3 py-6 pb-28 sm:px-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="e24-eyebrow">Platinum • design studio</p><h1 className="mt-1 text-xl font-bold">The player. The process.</h1><p className="mt-1 max-w-xl text-xs text-zinc-400">Live app component · authored frame · editable data · on-device photo processing</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={control} onClick={() => setCompare(!compare)}>{compare ? "Hide reference" : "Compare reference"}</button>
        <button className={control} onClick={() => setFreeze(!freeze)}>{freeze ? "Enable motion" : "Freeze motion"}</button>
        <select aria-label="Card level" className={control} value={level} onChange={e => setLevel(e.target.value as FinishKey)}>{FINISH_ORDER.map((key, i) => <option key={key} value={key}>{`${"★".repeat(i + 1)} ${key}`}</option>)}</select>
        <select aria-label="Card size" className={control} value={size} onChange={e => setSize(Number(e.target.value))}><option value={340}>Phone · 340</option><option value={520}>Review · 520</option><option value={1000}>Master · 1000</option></select>
      </div>
    </div>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <button disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40" onClick={() => void original()}>Process Cason original</button>
      <label className={control}>Try another photo<input aria-label="Try another photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="ml-2 max-w-44 text-xs" onChange={e => { const f = e.target.files?.[0]; if (f) void process(f); }} /></label>
      <label className="flex items-center gap-2 text-xs text-zinc-400">Light angle<input aria-label="Light angle" type="range" min="0" max="100" value={light} onChange={e => setLight(Number(e.target.value))} /></label>
    </div>
    <p role="status" className="mb-4 text-xs text-zinc-400">{status}</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
    <div className="flex flex-wrap items-start justify-center gap-7">
      <section style={{ width: size, maxWidth: "100%" }}>
        <div data-shot={`master-${level}`} style={{ width: "100%", position: "relative", '--sx': `${light}%`, '--sy': `${22 + light * .4}%` } as React.CSSProperties}>
          <PlayerCard size="full" player={player} team={TEAM} finishOverride={level} staticRender={freeze} width="100%" />
        </div>
        <p className="mt-3 text-center text-xs text-zinc-500">Live card · drag across the frame to explore the light</p>
        <div className="mt-6 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Small sizes</p>
          <div data-shot={`compact-${level}`}>
            <PlayerCard size="compact" player={player} team={TEAM} finishOverride={level} />
          </div>
          <div data-shot={`avatar-${level}`} className="inline-flex items-center gap-3 rounded-xl bg-zinc-950 px-3 py-2">
            <PlayerCard size="avatar" player={player} team={TEAM} finishOverride={level} />
            <span className="text-sm font-semibold text-zinc-200">{player.name}</span>
          </div>
        </div>
      </section>
      {compare && <section style={{ width: size, maxWidth: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={REF} alt="Approved B3 number and foil reference" className="w-full" />
        <p className="mt-3 text-center text-xs text-zinc-500">Approved B3 · number and foil only; keep our existing frame and layout</p>
      </section>}
    </div>
    <details className="mt-8 rounded-xl border border-white/10 p-4 text-xs text-zinc-400"><summary className="cursor-pointer">Test different player details</summary>
      <div className="mt-4 grid max-w-xl grid-cols-2 gap-3">
        <label>Name<input aria-label="Player name" className={`${control} mt-1 w-full`} value={player.name} onChange={e => setPlayer({ ...player, name: e.target.value })} /></label>
        <label>Jersey number<input aria-label="Jersey number" className={`${control} mt-1 w-full`} type="number" min="0" max="99" value={player.jerseyNumber ?? 0} onChange={e => setPlayer({ ...player, jerseyNumber: Number(e.target.value) })} /></label>
        <label>Points<input aria-label="Player points" className={`${control} mt-1 w-full`} type="number" min="0" value={player.points} onChange={e => setPlayer({ ...player, points: Number(e.target.value) })} /></label>
      </div>
    </details>
    {ready && <details className="mt-4 text-xs text-zinc-500"><summary>Portrait verification</summary><pre data-portrait-meta className="mt-2 whitespace-pre-wrap">{JSON.stringify(ready.meta, null, 2)}</pre><a download="cason-processed.webp" href={ready.cutoutUrl} className="underline">Download processed cutout</a><p>{ready.warnings.join(" ")}</p></details>}
  </main>;
}


