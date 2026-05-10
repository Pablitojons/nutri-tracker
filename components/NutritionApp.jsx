"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { localDateStamp } from "@/lib/dateLocal";
import {
  CONSTRAINT_OPTIONS,
  MEAL_LABELS,
  MEAL_ORDER,
  NUTRITION_TARGETS,
} from "@/lib/nutritionTargets";

const MEAL_SET = new Set(["breakfast", "lunch", "dinner", "snack"]);

function normalizeMealType(m) {
  const s = String(m || "")
    .toLowerCase()
    .trim();
  return MEAL_SET.has(s) ? s : "snack";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function maybeResizeImage(file, maxW = 1280) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const w = bitmap.width;
    const h = bitmap.height;
    if (w <= maxW) {
      bitmap.close();
      return file;
    }
    const scale = maxW / w;
    const canvas = document.createElement("canvas");
    canvas.width = maxW;
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b || null), "image/jpeg", 0.88)
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^/.]+$/, "") || "scan";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function MacroBar({ label, current, target, unit }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium tracking-tight text-zinc-200">{label}</span>
        <span className="text-xs tabular-nums text-zinc-400">
          <span className="font-[family-name:var(--font-dm-mono)] text-zinc-100">
            {Math.round(current * 10) / 10}
          </span>
          {" / "}
          <span className="font-[family-name:var(--font-dm-mono)]">{target}</span>
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/45 ring-1 ring-[#945474]/25">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#945474] via-[#c875a8] to-[#ff96c9] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl px-2 py-2.5 text-center text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-gradient-to-br from-[#945474]/90 to-[#321f2f] text-white shadow-[0_0_20px_-6px_rgba(255,148,208,0.45)] ring-1 ring-[#ff96c9]/35"
          : "bg-black/25 text-zinc-400 ring-1 ring-[#945474]/20 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function NutritionApp() {
  const supabase = useMemo(() => createClient(), []);
  const [todayStr, setTodayStr] = useState("");

  const [tab, setTab] = useState("dashboard");

  const [entries, setEntries] = useState([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [journalError, setJournalError] = useState(null);

  const [selectedConstraints, setSelectedConstraints] = useState(() => new Set());
  const [menuNotes, setMenuNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState(null);
  const [menuApiError, setMenuApiError] = useState(null);
  const [addingMenu, setAddingMenu] = useState(false);

  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [addingScan, setAddingScan] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setTodayStr(localDateStamp());
    });
  }, []);

  const loadJournal = useCallback(async () => {
    if (!todayStr) return;
    setLoadingJournal(true);
    setJournalError(null);
    const { data, error } = await supabase
      .from("journal")
      .select("*")
      .eq("date", todayStr)
      .order("created_at", { ascending: true });

    setLoadingJournal(false);
    if (error) {
      setJournalError(error.message);
      setEntries([]);
      return;
    }
    setEntries(data || []);
  }, [supabase, todayStr]);

  useEffect(() => {
    if (!todayStr) return;
    void Promise.resolve().then(() => {
      void loadJournal();
    });
  }, [todayStr, loadJournal]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, row) => ({
        kcal: acc.kcal + num(row.kcal),
        protein: acc.protein + num(row.protein),
        carbs: acc.carbs + num(row.carbs),
        fat: acc.fat + num(row.fat),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  const byMeal = useMemo(() => {
    const map = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const row of entries) {
      const mt = normalizeMealType(row.meal_type);
      map[mt].push(row);
    }
    return map;
  }, [entries]);

  const proteinLow = totals.protein < NUTRITION_TARGETS.protein;

  const toggleConstraint = (id) => {
    setSelectedConstraints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flattenGeneratedMenu = (menu) => {
    const out = [];
    for (const block of menu.meals || []) {
      const mt = normalizeMealType(block.meal_type);
      for (const it of block.items || []) {
        out.push({
          meal_type: mt,
          food_name: String(it.food_name ?? "Sans nom"),
          kcal: num(it.kcal),
          protein: num(it.protein),
          carbs: num(it.carbs),
          fat: num(it.fat),
        });
      }
    }
    return out;
  };

  const insertJournalRows = async (rows, source) => {
    if (!todayStr || !rows.length) return { error: new Error("Rien à enregistrer") };
    const payload = rows.map((r) => ({
      date: todayStr,
      meal_type: r.meal_type,
      food_name: r.food_name,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      source,
    }));
    const { error } = await supabase.from("journal").insert(payload);
    return { error };
  };

  const handleGenerateMenu = async () => {
    setGenerating(true);
    setMenuApiError(null);
    try {
      const labels = CONSTRAINT_OPTIONS.filter((o) =>
        selectedConstraints.has(o.id)
      ).map((o) => o.label);
      const res = await fetch("/api/generate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constraints: labels, notes: menuNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur API menu");
      setGeneratedMenu(data);
    } catch (e) {
      setGeneratedMenu(null);
      setMenuApiError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddMenuToJournal = async () => {
    if (!generatedMenu) return;
    const rows = flattenGeneratedMenu(generatedMenu);
    if (!rows.length) return;
    setAddingMenu(true);
    try {
      const { error } = await insertJournalRows(rows, "menu");
      if (error) throw error;
      setGeneratedMenu(null);
      await loadJournal();
      setTab("dashboard");
    } catch (e) {
      setMenuApiError(e.message || String(e));
    } finally {
      setAddingMenu(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scanPreview) URL.revokeObjectURL(scanPreview);
    };
  }, [scanPreview]);

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    setScanResult(null);
    setScanError(null);
    if (scanPreview) URL.revokeObjectURL(scanPreview);
    setScanPreview(null);
    setScanFile(null);
    if (!file) return;
    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
  };

  const handleScan = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanError(null);
    try {
      const resized = await maybeResizeImage(scanFile);
      const fd = new FormData();
      fd.append("image", resized);
      const res = await fetch("/api/scan-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur analyse");
      const items = (data.items || []).map((it) => ({
        meal_type: normalizeMealType(it.meal_type),
        food_name: String(it.food_name ?? "Sans nom"),
        kcal: num(it.kcal),
        protein: num(it.protein),
        carbs: num(it.carbs),
        fat: num(it.fat),
      }));
      setScanResult(items);
    } catch (e) {
      setScanResult(null);
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAddScanToJournal = async () => {
    if (!scanResult?.length) return;
    setAddingScan(true);
    try {
      const { error } = await insertJournalRows(scanResult, "scan");
      if (error) throw error;
      setScanResult(null);
      setScanFile(null);
      if (scanPreview) URL.revokeObjectURL(scanPreview);
      setScanPreview(null);
      await loadJournal();
      setTab("dashboard");
    } catch (e) {
      setScanError(e.message || String(e));
    } finally {
      setAddingScan(false);
    }
  };

  if (!todayStr) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-400">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col pb-28">
      <header className="sticky top-0 z-40 border-b border-[#945474]/25 bg-[#120a10]/75 px-5 py-5 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff96c9]/80">
            Journal du jour
          </p>
          <div className="flex items-end justify-between gap-3">
            <h1 className="bg-gradient-to-r from-[#fff0f7] via-[#ff96c9] to-[#cc6b9e] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              Nutri Tracker
            </h1>
            <time
              className="font-[family-name:var(--font-dm-mono)] text-xs tabular-nums text-zinc-400"
              dateTime={todayStr}
            >
              {todayStr}
            </time>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-6">
        {tab === "dashboard" && (
          <>
            <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.35)] backdrop-blur-md">
              <div className="mb-5 flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-zinc-50">Macros du jour</h2>
                <p className="text-xs text-zinc-500">
                  Profil fixe&nbsp;: {NUTRITION_TARGETS.kcal} kcal · P{" "}
                  {NUTRITION_TARGETS.protein} g · G {NUTRITION_TARGETS.carbs} g · L{" "}
                  {NUTRITION_TARGETS.fat} g
                </p>
              </div>

              <div className="space-y-5">
                <MacroBar label="Calories" current={totals.kcal} target={NUTRITION_TARGETS.kcal} unit="kcal" />
                <MacroBar label="Protéines" current={totals.protein} target={NUTRITION_TARGETS.protein} unit="g" />
                <MacroBar label="Glucides" current={totals.carbs} target={NUTRITION_TARGETS.carbs} unit="g" />
                <MacroBar label="Lipides" current={totals.fat} target={NUTRITION_TARGETS.fat} unit="g" />
              </div>
            </section>

            {proteinLow && (
              <div
                role="alert"
                className="rounded-3xl border border-amber-500/40 bg-amber-500/12 px-5 py-4 text-sm text-amber-100 shadow-[0_0_28px_-12px_rgba(251,191,36,0.55)] backdrop-blur-sm"
              >
                <strong className="font-semibold">Protéines insuffisantes</strong>
                <p className="mt-2 text-amber-100/90">
                  Vous êtes à <span className="font-[family-name:var(--font-dm-mono)] font-semibold">{Math.round(totals.protein * 10) / 10} g</span> sur{" "}
                  <span className="font-[family-name:var(--font-dm-mono)]">{NUTRITION_TARGETS.protein} g</span>. Ajoutez une source de protéines (menu ou scan).
                </p>
              </div>
            )}

            {!proteinLow && totals.protein > 0 && (
              <div className="rounded-3xl border border-[#945474]/35 bg-[#231a26]/55 px-5 py-3 text-sm text-pink-100/90">
                Objectif protéines atteint ou dépassé pour aujourd’hui. Continuez ainsi.
              </div>
            )}

            <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.28)] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-50">Journal alimentaire</h2>
                <button
                  type="button"
                  onClick={() => loadJournal()}
                  className="rounded-lg border border-[#945474]/40 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-[#ff96c9]/45 hover:text-white"
                >
                  Actualiser
                </button>
              </div>

              {loadingJournal && <p className="text-sm text-zinc-500">Chargement du journal…</p>}
              {journalError && (
                <p className="text-sm text-red-300">
                  {journalError}
                  <span className="mt-1 block text-xs text-zinc-500">
                    Vérifiez la table <code className="font-[family-name:var(--font-dm-mono)]">journal</code> dans Supabase (script <code className="font-[family-name:var(--font-dm-mono)]">supabase/journal.sql</code>).
                  </span>
                </p>
              )}

              {!loadingJournal && !journalError && entries.length === 0 && (
                <p className="text-sm leading-relaxed text-zinc-400">
                  Aucun repas pour aujourd’hui. Utilisez l’onglet <strong className="text-zinc-200">Menu</strong> ou <strong className="text-zinc-200">Scanner</strong> pour enrichir votre journal.
                </p>
              )}

              <div className="mt-4 space-y-6">
                {MEAL_ORDER.map((meal) => {
                  const rows = byMeal[meal];
                  if (!rows.length) return null;
                  return (
                    <div key={meal}>
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#ff96c9]/80">
                        {MEAL_LABELS[meal]}
                      </h3>
                      <ul className="space-y-3">
                        {rows.map((row) => (
                          <li
                            key={row.id}
                            className="rounded-2xl border border-[#945474]/22 bg-black/35 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex-1 text-sm font-medium text-zinc-100">
                                {row.food_name}
                              </span>
                              <span className="shrink-0 rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                {row.source === "scan" ? "Scan" : row.source === "menu" ? "Menu" : row.source || "—"}
                              </span>
                            </div>
                            <p className="mt-2 font-[family-name:var(--font-dm-mono)] text-xs tabular-nums text-zinc-400">
                              {Math.round(num(row.kcal))} kcal · P {Math.round(num(row.protein) * 10) / 10} · G{" "}
                              {Math.round(num(row.carbs) * 10) / 10} · L {Math.round(num(row.fat) * 10) / 10}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {tab === "menu" && (
          <div className="flex flex-col gap-5">
            <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.28)] backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-zinc-50">Contraintes alimentaires</h2>
              <div className="flex flex-wrap gap-2">
                {CONSTRAINT_OPTIONS.map((c) => {
                  const active = selectedConstraints.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleConstraint(c.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-[#ff96c9]/50 bg-[#ff96c9]/12 text-[#fff0fb] shadow-[0_0_18px_-8px_rgba(255,148,208,0.45)]"
                          : "border-[#945474]/35 bg-black/35 text-zinc-400 hover:border-[#945474]/55 hover:text-zinc-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <label className="mt-6 block text-sm font-semibold text-zinc-300">
                Notes
                <textarea
                  rows={4}
                  value={menuNotes}
                  onChange={(e) => setMenuNotes(e.target.value)}
                  placeholder="Allergie, préférences de goût, budget, saison…"
                  className="mt-2 w-full resize-y rounded-2xl border border-[#945474]/35 bg-black/35 px-4 py-3 text-sm text-zinc-100 outline-none ring-[#ff96c9]/0 transition placeholder:text-zinc-600 focus:border-[#ff96c9]/45 focus:ring-2 focus:ring-[#ff96c9]/25"
                />
              </label>

              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateMenu}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#945474] to-[#f067b8] px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-black shadow-[0_0_32px_-10px_rgba(255,148,208,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? "Génération en cours…" : "Générer le menu (Gemini)"}
              </button>

              {menuApiError && (
                <p className="mt-4 text-sm text-red-300" role="alert">
                  {menuApiError}
                </p>
              )}
            </section>

            {generatedMenu && (
              <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.28)] backdrop-blur-md">
                <h3 className="mb-4 text-base font-semibold text-zinc-50">Menu proposé</h3>
                <div className="space-y-5">
                  {(generatedMenu.meals || []).map((block, i) => {
                    const mt = normalizeMealType(block.meal_type);
                    return (
                      <div key={`${mt}-${i}`}>
                        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#ff96c9]/75">
                          {MEAL_LABELS[mt]}
                        </h4>
                        <ul className="space-y-2">
                          {(block.items || []).map((it, j) => (
                            <li key={j} className="rounded-xl border border-[#945474]/22 bg-black/35 px-3 py-2 text-sm">
                              <span className="font-medium text-zinc-100">{it.food_name}</span>
                              <span className="mt-1 block font-[family-name:var(--font-dm-mono)] text-[11px] tabular-nums text-zinc-500">
                                {Math.round(num(it.kcal))} kcal · P {num(it.protein)} · G {num(it.carbs)} · L{" "}
                                {num(it.fat)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={addingMenu}
                  onClick={handleAddMenuToJournal}
                  className="mt-6 w-full rounded-2xl border border-[#ff96c9]/40 bg-transparent px-5 py-3.5 text-sm font-bold text-[#ffe8f5] shadow-[0_0_24px_-12px_rgba(255,148,208,0.45)] ring-1 ring-[#945474]/30 transition hover:bg-[#ff96c9]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingMenu ? "Ajout…" : "Ajouter le menu au journal"}
                </button>
              </section>
            )}
          </div>
        )}

        {tab === "scanner" && (
          <div className="flex flex-col gap-5">
            <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.28)] backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-zinc-50">Scanner une photo</h2>
              <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                Étiquette, emballage ou plat repérable. La photo est redimensionnée côté appareil pour limiter la taille.
              </p>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-[#945474]/45 bg-black/35 px-4 py-8 text-center text-sm font-semibold text-zinc-300 transition hover:border-[#ff96c9]/40 hover:text-[#ffe8f5]">
                <span className="block">Choisis une image</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPickImage} />
              </label>

              {scanPreview && (
                <Image
                  src={scanPreview}
                  alt="Aperçu du scan"
                  width={800}
                  height={512}
                  unoptimized
                  className="mt-4 max-h-64 w-full rounded-2xl border border-[#945474]/30 object-cover"
                />
              )}

              <button
                type="button"
                disabled={!scanFile || scanning}
                onClick={handleScan}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#945474] to-[#f067b8] px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-black shadow-[0_0_32px_-10px_rgba(255,148,208,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? "Analyse Gemini…" : "Lire les valeurs nutritionnelles"}
              </button>

              {scanError && (
                <p className="mt-4 text-sm text-red-300" role="alert">
                  {scanError}
                </p>
              )}
            </section>

            {scanResult && scanResult.length > 0 && (
              <section className="card-organic rounded-3xl border border-[#945474]/35 bg-[#1a141c]/72 p-5 shadow-[0_0_32px_-14px_rgba(255,148,208,0.28)] backdrop-blur-md">
                <h3 className="mb-4 text-base font-semibold text-zinc-50">Résultats</h3>
                <ul className="space-y-3">
                  {scanResult.map((it, i) => (
                    <li key={i} className="rounded-xl border border-[#945474]/22 bg-black/35 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-100">{it.food_name}</span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">
                          {MEAL_LABELS[it.meal_type] || MEAL_LABELS.snack}
                        </span>
                      </div>
                      <p className="mt-2 font-[family-name:var(--font-dm-mono)] text-xs tabular-nums text-zinc-400">
                        {Math.round(it.kcal)} kcal · P {Math.round(it.protein * 10) / 10} · G {Math.round(it.carbs * 10) / 10}{" "}
                        · L {Math.round(it.fat * 10) / 10}
                      </p>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={addingScan}
                  onClick={handleAddScanToJournal}
                  className="mt-6 w-full rounded-2xl border border-[#ff96c9]/40 bg-transparent px-5 py-3.5 text-sm font-bold text-[#ffe8f5] shadow-[0_0_24px_-12px_rgba(255,148,208,0.45)] transition hover:bg-[#ff96c9]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingScan ? "Ajout…" : "Ajouter au journal"}
                </button>
              </section>
            )}
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#945474]/35 bg-[#0c0610]/85 px-4 py-3 backdrop-blur-xl supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-2">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
            Tableau de bord
          </TabButton>
          <TabButton active={tab === "menu"} onClick={() => setTab("menu")}>
            Menu du jour
          </TabButton>
          <TabButton active={tab === "scanner"} onClick={() => setTab("scanner")}>
            Scanner
          </TabButton>
        </div>
      </nav>
    </div>
  );
}
