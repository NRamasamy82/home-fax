import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ==============================
// HomeCert — MVP (30-home, Austin & Dallas with ZIPs)
// ==============================

// ---- Safe logo helper (no import.meta) ----
const PLACEHOLDER_LOGO_DATA_URI =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>` +
      `<rect width='64' height='64' rx='12' fill='#111827'/><g fill='#fff'>` +
      `<path d='M18 44c0-10 8-18 18-18h4c4 0 8 4 8 8v6c0 2-2 4-4 4h-4l-2 4h-6l-2-4h-6c-2 0-4-2-4-4z'/>` +
      `<circle cx='24' cy='24' r='6'/></g>` +
    `</svg>`
  );

const getLogoSrc = () => "/logo.png"; // canvas-safe

const LogoImg: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <img
    src={getLogoSrc()}
    alt="HomeCert Watchdog"
    className={className}
    crossOrigin="anonymous"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO_DATA_URI;
    }}
  />
);

const CURRENT_YEAR = new Date().getFullYear();
const STREETS = ["Maple","Oak","Pine","Cedar","Elm","Willow","Birch","Walnut","Chestnut","Sycamore"] as const;
const AUSTIN_ZIPS = [78701,78702,78703,78704,78705,78723,78727,78731,78741,78745] as const;
const DALLAS_ZIPS = [75201,75204,75205,75206,75208,75214,75219,75225,75230,75248] as const;

const yearsOld = (y: number | undefined) => (typeof y === "number" ? CURRENT_YEAR - y : undefined);
const DEFAULT_WEIGHTS = { roof:0.2,hvac:0.2,plumbing:0.15,electrical:0.15,waterHeater:0.1,solar:0.2 } as const;

const ageToScore = (a: number) => a<=2?100:a<=5?90:a<=8?80:a<=12?65:a<=18?50:a<=25?35:20;
const computeHealthScore = (h: any, w = DEFAULT_WEIGHTS) => {
  const s = h.systems || {};
  let total = 0, sum = 0;
  for (const k in w) {
    // @ts-ignore
    const weight = w[k];
    const y = s[k]?.year ? yearsOld(s[k].year) : undefined;
    let sc = 60;
    if (k === "solar") {
      sc = s[k]?.year ? Math.max(0, 100 - (yearsOld(s[k].year) || 0)) : 0; // newer solar → higher
    } else {
      sc = typeof y === "number" ? ageToScore(y) : 60;
    }
    total += sc * (weight as number);
    sum += (weight as number);
  }
  return Math.round(total / (sum || 1));
};

// ---------- Predictive Maintenance ----------
const LIFE = {
  roof: 25, // years
  hvac: 15,
  waterHeater: 12,
  plumbing: 50,
  electrical: 35,
  windows: 25,
  garageDoor: 18,
  solar: 30,
  bathroomRemodel: 20,
} as const;

function remainingLife(installedYear?: number, typical = 20) {
  if (!installedYear) return undefined;
  const age = Math.max(0, CURRENT_YEAR - installedYear);
  return Math.max(0, typical - age);
}

function bandColorByRemaining(rem?: number) {
  if (rem === undefined) return "text-gray-600";
  if (rem <= 2) return "text-red-600";
  if (rem <= 5) return "text-yellow-600";
  return "text-green-600";
}

function addSuggestion(list: { text: string; color: string }[], label: string, instYear?: number, typical?: number, extra?: string) {
  const rem = remainingLife(instYear, typical);
  const color = bandColorByRemaining(rem);
  const age = instYear ? CURRENT_YEAR - instYear : undefined;
  const ageStr = age !== undefined ? `${age} yrs old` : "age unknown";
  const remStr = rem !== undefined ? `, ~${rem} yrs remaining` : "";
  const detail = extra ? ` — ${extra}` : "";
  list.push({ text: `${label}: ${ageStr}${remStr}${detail}`, color });
}

const getMaintenanceSuggestions = (systems: any) => {
  const s: { text: string; color: string }[] = [];
  addSuggestion(s, "Roof", systems.roof?.year, LIFE.roof, systems.roof?.lastRepair ? `last repair ${systems.roof.lastRepair}` : undefined);
  addSuggestion(s, "HVAC", systems.hvac?.year, LIFE.hvac);
  addSuggestion(s, "Water Heater", systems.waterHeater?.year, LIFE.waterHeater, systems.waterHeater?.lastFlush ? `last flush ${systems.waterHeater.lastFlush}` : undefined);
  addSuggestion(s, "Plumbing (supply)", systems.plumbing?.year, LIFE.plumbing);
  addSuggestion(s, "Electrical (panel)", systems.electrical?.year, LIFE.electrical);
  addSuggestion(s, "Windows", systems.windows?.year, LIFE.windows);
  addSuggestion(s, "Garage Door", systems.garageDoor?.year, LIFE.garageDoor, systems.garageDoor?.lastRepair ? `last repair ${systems.garageDoor.lastRepair}` : undefined);
  if (systems.solar) addSuggestion(s, "Solar Array", systems.solar?.year, LIFE.solar);
  if (systems.bathroomRemodel) addSuggestion(s, "Bathroom Remodel", systems.bathroomRemodel?.year, LIFE.bathroomRemodel, systems.bathroomRemodel?.type);
  return s;
};

// ---------- Sample Data ----------
function defaultData(){
  const arr: any[] = [];
  const vendors = ["Ace Roofing Co.", "HVAC Heroes", "PipeMasters Inc.", "BrightSolar LLC", "WindowWorld", "GaragePros", "BathRemodelers"];

  for (let i = 1; i <= 30; i++) {
    let systems: any;
    const tier = (i - 1) % 3; // 0 green, 1 yellow, 2 red

    if (tier === 0) {
      // Green
      systems = {
        roof:{year:CURRENT_YEAR - (1 + (i % 2)), vendor:vendors[0], lastRepair:`${CURRENT_YEAR - 1}`},
        hvac:{year:CURRENT_YEAR - (2 + (i % 3)), vendor:vendors[1]},
        plumbing:{year:CURRENT_YEAR - (3 + (i % 3)), vendor:vendors[2]},
        electrical:{year:CURRENT_YEAR - (2 + (i % 4))},
        waterHeater:{year:CURRENT_YEAR - (1 + (i % 2)), vendor:vendors[2], lastFlush:`${CURRENT_YEAR}`},
        windows:{year:CURRENT_YEAR - (2 + (i % 3)), vendor:vendors[4]},
        garageDoor:{year:CURRENT_YEAR - (1 + (i % 3)), vendor:vendors[5], lastRepair:`${CURRENT_YEAR - 1}`},
        bathroomRemodel:{year:CURRENT_YEAR - (2 + (i % 2)), vendor:vendors[6], type:"Tub to Walk-in Shower"},
        solar: i % 2 === 0 ? {year:CURRENT_YEAR - (1 + (i % 2)), vendor:vendors[3]} : null
      };
    } else if (tier === 1) {
      // Yellow
      systems = {
        roof:{year:2013 + (i % 5), vendor:vendors[0], lastRepair:`${2018 + (i % 3)}`},
        hvac:{year:2014 + (i % 5), vendor:vendors[1]},
        plumbing:{year:2010 + (i % 6), vendor:vendors[2]},
        electrical:{year:2008 + (i % 8)},
        waterHeater:{year:2013 + (i % 4), vendor:vendors[2], lastFlush:`${2020 + (i % 2)}`},
        windows:{year:2015 + (i % 3), vendor:vendors[4]},
        garageDoor:{year:2014 + (i % 4), vendor:vendors[5], lastRepair:`${2019 + (i % 2)}`},
        bathroomRemodel:{year:2016 + (i % 3), vendor:vendors[6], type:"Tub to Walk-in Shower"},
        solar: i % 4 === 0 ? {year:2016 + (i % 3), vendor:vendors[3]} : null
      };
    } else {
      // Red
      systems = {
        roof:{year:2000 + (i % 5), vendor:vendors[0], lastRepair:`${2009 + (i % 5)}`},
        hvac:{year:2002 + (i % 6), vendor:vendors[1]},
        plumbing:{year:1995 + (i % 8), vendor:vendors[2]},
        electrical:{year:1990 + (i % 10)},
        waterHeater:{year:2005 + (i % 6), vendor:vendors[2], lastFlush:`${2015 + (i % 3)}`},
        windows:{year:2006 + (i % 4), vendor:vendors[4]},
        garageDoor:{year:2008 + (i % 5), vendor:vendors[5], lastRepair:`${2013 + (i % 3)}`},
        bathroomRemodel:{year:2010 + (i % 4), vendor:vendors[6], type:"Tub to Walk-in Shower"},
        solar: null
      };
    }

    const city = i % 2 === 0 ? "Austin" : "Dallas";
    const zip = city === "Austin" ? AUSTIN_ZIPS[i % AUSTIN_ZIPS.length] : DALLAS_ZIPS[i % DALLAS_ZIPS.length];
    const street = STREETS[i % STREETS.length];

    arr.push({
      id:i,
      address:`${100+i} ${street} St, ${city}, TX ${zip}`,
      city,
      state:"TX",
      zip,
      yearBuilt:1980+(i%40),
      sqFt:1500+(i%10)*100,
      beds:(i%5)+2,
      baths:(i%3)+1,
      systems
    });
  }
  return arr;
}

// ---------- Timeline helpers ----------
function toYear(n?: number | string | null): number | undefined {
  if (n === null || n === undefined) return undefined;
  if (typeof n === 'number') return n;
  const m = String(n).match(/(19|20)\\d{2}/);
  return m ? parseInt(m[0], 10) : undefined;
}

type TLItem = { year: number; label: string; kind: string };

function buildTimeline(home: any): TLItem[] {
  const s = home.systems || {};
  const items: TLItem[] = [];
  const push = (y: any, label: string, kind: string) => { const yr = toYear(y); if (yr) items.push({ year: yr, label, kind }); };

  push(home.yearBuilt, 'Built', 'built');
  push(s.roof?.year, 'Roof installed', 'roof');
  push(s.roof?.lastRepair, 'Roof repaired', 'roof');
  push(s.hvac?.year, 'HVAC installed', 'hvac');
  push(s.plumbing?.year, 'Plumbing updated', 'plumbing');
  push(s.electrical?.year, 'Electrical panel', 'electrical');
  push(s.waterHeater?.year, 'Water heater installed', 'water');
  push(s.waterHeater?.lastFlush, 'Water heater flush', 'water');
  push(s.windows?.year, 'Windows replaced', 'windows');
  push(s.garageDoor?.year, 'Garage door installed', 'garage');
  push(s.garageDoor?.lastRepair, 'Garage door repair', 'garage');
  push(s.bathroomRemodel?.year, s.bathroomRemodel?.type || 'Bathroom remodel', 'bath');
  if (s.solar) push(s.solar?.year, 'Solar installed', 'solar');

  return items.sort((a,b)=>a.year-b.year);
}

const KIND_COLOR: Record<string, string> = {
  built: '#111827',
  roof: '#dc2626',
  hvac: '#2563eb',
  plumbing: '#0ea5e9',
  electrical: '#f59e0b',
  water: '#14b8a6',
  windows: '#8b5cf6',
  garage: '#6b7280',
  bath: '#ec4899',
  solar: '#16a34a',
};

const TimelineStrip: React.FC<{ items: TLItem[]; startYear?: number; endYear?: number }> = ({ items, startYear, endYear }) => {
  if (!items.length) return null;
  const minY = startYear ?? Math.min(items[0].year, CURRENT_YEAR - 20);
  const maxY = endYear ?? CURRENT_YEAR;
  const span = Math.max(1, maxY - minY);
  const x = (y:number) => ((y - minY) / span) * 100; // percent

  return (
    <div className="mt-2">
      <div className="relative w-full h-20">
        {/* axis */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-gray-200 rounded" />
        {/* ticks for every ~5 years */}
        {Array.from({length: Math.floor(span/5)+1}).map((_,i)=>{
          const yr = minY + i*5; if (yr>maxY) return null;
          return <div key={yr} className="absolute" style={{left: `${x(yr)}%`}}>
            <div className="w-px h-3 bg-gray-400 mx-auto" />
            <div className="text-[10px] text-gray-500 -translate-x-1/2 mt-1">{yr}</div>
          </div>
        })}
        {/* events */}
        {items.map((it, idx)=>{
          const left = x(it.year);
          const color = KIND_COLOR[it.kind] || '#111827';
          return (
            <div key={idx} className="absolute -translate-x-1/2" style={{left: `${left}%`}}>
              <div className="w-0.5 h-5" style={{backgroundColor: color, margin: '0 auto'}} />
              <div className="text-[11px] text-gray-800 whitespace-nowrap mt-1 px-1 rounded" style={{border: `1px solid ${color}`}}>
                <span className="font-medium" style={{color}}>{it.year}</span> · {it.label}
              </div>
            </div>
          );
        })}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-gray-700">
        {Object.entries(KIND_COLOR).map(([k,c])=> (
          <div key={k} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor:c}} /> {k}</div>
        ))}
      </div>
    </div>
  );
};

const ScoreBadge: React.FC<{score:number}> = ({score}) => {
  let c = "bg-red-600";
  if (score >= 85) c = "bg-green-600";
  else if (score >= 70) c = "bg-yellow-500";
  return <span className={`px-2 py-1 text-white rounded-full text-xs ${c}`}>HomeCert HealthIndex {score}</span>;
};

const ScoreGauge: React.FC<{ value:number; size?:number; stroke?:number }>=({value, size=64, stroke=8})=>{
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  let strokeColor = "#dc2626"; // red-600
  if (clamped >= 85) strokeColor = "#16a34a"; // green-600
  else if (clamped >= 70) strokeColor = "#eab308"; // yellow-500

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`HomeCert HealthIndex ${clamped}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size*0.28} fontWeight="700" fill="#111827">{clamped}</text>
    </svg>
  );
};

const AIBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <motion.div
    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full text-white shadow-sm ${className}`}
    style={{
      background: "linear-gradient(90deg, #0ea5e9, #8b5cf6)",
      boxShadow: "0 0 0px rgba(99,102,241,0.0)",
    }}
    animate={{ opacity: [0.8, 1, 0.8], filter: ["drop-shadow(0 0 0 rgba(99,102,241,0.0))", "drop-shadow(0 0 6px rgba(99,102,241,0.6))", "drop-shadow(0 0 0 rgba(99,102,241,0.0))"] }}
    transition={{ duration: 2, repeat: Infinity }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l1.8 4.7L18 8.5l-4.2 1.6L12 15l-1.8-4.9L6 8.5l4.2-1.8L12 2z" fill="white"/>
    </svg>
    <span className="font-semibold tracking-wide">AI Insights</span>
  </motion.div>
);

function getAIInsights(home: any): string[] {
  const score = computeHealthScore(home);
  const hasSolar = !!home.systems?.solar;
  const out: string[] = [];
  if (score >= 85) out.push("Strong overall condition. Low short-term CapEx exposure.");
  if (score >= 70 && score < 85) out.push("Mid-life systems. Budget for targeted refresh over 3–5 yrs.");
  if (score < 70) out.push("Aging systems detected. Prioritize roof/HVAC and water heater.");
  if (hasSolar) out.push("Solar present. Expect reduced utility costs; verify inverter age.");
  if (home.systems?.waterHeater?.lastFlush) out.push("Water heater maintenance recorded—keep annual flush cadence.");
  if (home.systems?.roof?.lastRepair) out.push("Roof repairs on file—inspect flashing and underlayment.");
  return out.length ? out.slice(0, 3) : ["No risk signals detected in available records."];
}

const AddressSearch: React.FC<{ query: string; setQuery: (s: string) => void }> = ({ query, setQuery }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">Search by Address / City / ZIP</label>
    <input
      type="text"
      placeholder="Enter street, city, or zip"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      className="w-full border rounded-md px-3 py-2 text-sm"
    />
  </div>
);

const DetailedReport: React.FC<{ home: any }> = ({ home }) => {
  const s = computeHealthScore(home);
  const maintenance = getMaintenanceSuggestions(home.systems);
  const insights = getAIInsights(home);
  const tl = buildTimeline(home);
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <LogoImg className="w-8 h-8"/>
        <h2 className="text-xl font-bold">HomeCert Property History Report™</h2>
        <AIBadge />
      </div>

      {/* Score & Address (single gauge) */}
      <div className="flex items-center gap-4">
        <div className="shrink-0"><ScoreGauge value={s} size={96} stroke={10}/></div>
        <div>
          <p className="text-gray-600 font-medium">{home.address}</p>
        </div>
      </div>

      {/* Value */}
      <div>
        <h3 className="font-semibold mt-2">History-Based Value Report</h3>
        <p>Estimated HomeCert Retail Value: ${(400000 + (s*2000)).toLocaleString()}</p>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="font-semibold mt-2">Maintenance Timeline</h3>
        <TimelineStrip items={tl} />
      </div>

      {/* Records */}
      <div>
        <h3 className="font-semibold mt-2">System & Maintenance Records</h3>
        <ul className="list-disc ml-6 text-sm space-y-1">
          <li>Roof: {home.systems.roof.year}, Vendor: {home.systems.roof.vendor}, Last Repair: {home.systems.roof.lastRepair}</li>
          <li>HVAC: {home.systems.hvac.year}, Vendor: {home.systems.hvac.vendor}</li>
          <li>Plumbing: {home.systems.plumbing.year}, Vendor: {home.systems.plumbing.vendor}</li>
          <li>Electrical: {home.systems.electrical.year}</li>
          <li>Water Heater: {home.systems.waterHeater.year}, Vendor: {home.systems.waterHeater.vendor}, Last Flush: {home.systems.waterHeater.lastFlush}</li>
          <li>Windows: {home.systems.windows.year}, Vendor: {home.systems.windows.vendor}</li>
          <li>Garage Door: {home.systems.garageDoor.year}, Vendor: {home.systems.garageDoor.vendor}, Last Repair: {home.systems.garageDoor.lastRepair}</li>
          <li>Bathroom Remodel: {home.systems.bathroomRemodel.year}, {home.systems.bathroomRemodel.type}, Vendor: {home.systems.bathroomRemodel.vendor}</li>
          {home.systems.solar && (<li>Solar: {home.systems.solar.year}, Vendor: {home.systems.solar.vendor}</li>)}
        </ul>
      </div>

      {/* Predictive Maintenance */}
      <div>
        <h3 className="font-semibold mt-2">Predictive Maintenance & Remaining Life</h3>
        <ul className="list-disc ml-6 text-sm space-y-1">
          {maintenance.map((m, i) => (
            <li key={i} className={m.color}>{m.text}</li>
          ))}
        </ul>
      </div>

      {/* AI Insights */}
      <div>
        <h3 className="font-semibold mt-2 flex items-center gap-2">AI Insights <AIBadge /></h3>
        <ul className="list-disc ml-6 text-sm space-y-1">
          {insights.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      {/* Glossary */}
      <div>
        <h3 className="font-semibold mt-2">Glossary of Terms</h3>
        <ul className="list-disc ml-6 text-sm space-y-1 text-gray-700">
          <li><strong>Roof Replacement</strong>: Full replacement of roof covering and materials, typically every 20–30 years.</li>
          <li><strong>HVAC Service</strong>: Inspection or replacement of heating, ventilation, and air conditioning systems; lifespan ~15 years.</li>
          <li><strong>Water Heater Flush</strong>: Routine maintenance to remove sediment; lifespan ~12 years.</li>
          <li><strong>Plumbing (Supply)</strong>: Replacement or maintenance of supply pipes and fixtures; lifespan ~50 years depending on material.</li>
          <li><strong>Electrical (Panel)</strong>: Replacement or upgrade of electrical service panel; lifespan ~35 years.</li>
          <li><strong>Windows</strong>: Replacement of window units and seals; lifespan ~25 years.</li>
          <li><strong>Garage Door</strong>: Repairs or replacement of door, tracks, and opener; lifespan ~18 years.</li>
          <li><strong>Solar Array</strong>: Installation of rooftop solar panels; lifespan ~30 years, may require inverter replacement sooner.</li>
          <li><strong>Bathroom Remodel</strong>: Renovation such as tub-to-shower conversion; recommended updates every 20 years.</li>
        </ul>
      </div>
    </div>
  );
};

const ReportView: React.FC<{ home: any; onClose: () => void }> = ({ home, onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  // A4 constants
  const PAGE_W = 595.28; // pt
  const PAGE_H = 841.89; // pt
  const MARGIN = 24;

  const saveBlob = (pdf: jsPDF, filename: string) => {
    try {
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    } catch {
      pdf.save(filename);
    }
  };

  const renderCanvasToPdf = async (filename: string) => {
    if (!reportRef.current) return;

    // wait one frame for layout
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(reportRef.current, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const usableW = PAGE_W - MARGIN * 2;
    const usableH = PAGE_H - MARGIN * 2;

    const imgW = usableW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    if (imgH <= usableH) {
      pdf.addImage(imgData, "PNG", MARGIN, MARGIN, imgW, imgH);
      saveBlob(pdf, filename);
      return;
    }

    // paginate
    let y = 0;
    const ratio = canvas.width / imgW; // px per pt at target width
    const slicePx = Math.floor(usableH * ratio);
    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d")!;

    while (y < canvas.height) {
      const h = Math.min(slicePx, canvas.height - y);
      pageCanvas.width = canvas.width;
      pageCanvas.height = h;
      pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

      const pageImg = pageCanvas.toDataURL("image/png");
      if (y > 0) pdf.addPage();
      pdf.addImage(pageImg, "PNG", MARGIN, MARGIN, imgW, h / ratio);
      y += h;
    }

    saveBlob(pdf, filename);
  };

  const handleDownloadPDF = async () => {
    const safe = String(home.address || "Home").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    const filename = `HomeCert_${safe}.pdf`;
    try {
      await renderCanvasToPdf(filename);
    } catch (e) {
      // last resort: create minimal PDF so button always does something in demo
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.text("HomeCert report (demo).", 48, 72);
      saveBlob(pdf, filename);
    }
  };

  return (
    <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <div className="bg-white rounded-xl w-full max-w-3xl p-6 relative overflow-y-auto max-h-[90vh]">
        <div className="absolute top-2 right-2 flex gap-2">
          <button onClick={handleDownloadPDF} className="px-3 h-8 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" title="Demo only">Download PDF</button>
          <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-lg font-bold hover:bg-gray-300" aria-label="Close">×</button>
        </div>
        <div ref={reportRef}>
          <DetailedReport home={home} />
        </div>
      </div>
    </motion.div>
  );
};

// ---------- App (filters + grid) ----------
export default function HomeCertApp(){
  // helpers
  const matchesSolar = (home: any, mode: 'any'|'yes'|'no') => mode === 'any' ? true : (mode === 'yes' ? !!home.systems?.solar : !home.systems?.solar);
  const matchesYear = (home: any, minY: number, maxY: number) => (home.yearBuilt ?? 0) >= minY && (home.yearBuilt ?? 0) <= maxY;

  const [homes] = useState(() => defaultData());
  const [sel, setSel] = useState<any | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");

  const globalMinYear = Math.min(...homes.map((h:any)=>h.yearBuilt));
  const globalMaxYear = Math.max(...homes.map((h:any)=>h.yearBuilt));
  const [yearMin, setYearMin] = useState<number>(globalMinYear);
  const [yearMax, setYearMax] = useState<number>(globalMaxYear);
  const [hasSolar, setHasSolar] = useState<'any'|'yes'|'no'>('any');

  const filtered = homes
    .filter((h:any) => (query
      ? (h.address.toLowerCase().includes(query.toLowerCase()) || h.city.toLowerCase().includes(query.toLowerCase()) || String(h.zip).includes(query))
      : true))
    .filter((h:any) => computeHealthScore(h) >= minScore)
    .filter((h:any) => matchesSolar(h, hasSolar))
    .filter((h:any) => matchesYear(h, yearMin, yearMax));

  return (
    <>
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-1">
          <LogoImg className="w-10 h-10"/>
          <h1 className="text-2xl font-bold">HomeCert</h1>
        </div>
        <p className="text-sm text-gray-600 mb-4">Because every home has a story</p>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <AddressSearch query={query} setQuery={setQuery} />
          <div>
            <label className="block text-sm font-medium mb-1">Minimum HealthIndex: {minScore}</label>
            <input type="range" min="0" max="100" value={minScore} onChange={(e)=>setMinScore(Number(e.target.value))} className="w-full"/>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-28">Has Solar</label>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={hasSolar}
              onChange={(e)=>setHasSolar(e.target.value as 'any'|'yes'|'no')}
            >
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Year Built (Min)</label>
              <input
                type="number"
                className="w-full border rounded-md px-2 py-1 text-sm"
                min={globalMinYear}
                max={yearMax}
                value={yearMin}
                onChange={(e)=>setYearMin(Math.min(Number(e.target.value||globalMinYear), yearMax))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Year Built (Max)</label>
              <input
                type="number"
                className="w-full border rounded-md px-2 py-1 text-sm"
                min={yearMin}
                max={globalMaxYear}
                value={yearMax}
                onChange={(e)=>setYearMax(Math.max(Number(e.target.value||globalMaxYear), yearMin))}
              />
            </div>
          </div>
          <div className="text-xs text-gray-600">Showing <strong>{filtered.length}</strong> of {homes.length} homes</div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((h:any) => (
            <Card key={h.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="pr-3">
                    <p className="font-semibold">{h.address}</p>
                    <p className="text-xs text-gray-500">Built {h.yearBuilt} • {h.city}, {h.state} {h.zip}</p>
                    <div className="mt-1"><AIBadge /></div>
                  </div>
                  <div className="shrink-0">
                    <ScoreGauge value={computeHealthScore(h)} size={56} stroke={8}/>
                  </div>
                </div>
                <Button size="sm" className="mt-2" onClick={()=>setSel(h)}>Open Report</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal outside the main wrapper, but safely enclosed in a Fragment */}
      <AnimatePresence>{sel && <ReportView home={sel} onClose={()=>setSel(null)}/>}</AnimatePresence>
    </>
  );
}
