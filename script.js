const { useState, useMemo, useEffect, useRef } = React;
const { jsPDF } = window.jspdf;

function DownloadIcon(props){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 3v10m0 0 4-4m-4 4-4-4M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);}

function HomeIcon(props){ return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);}

function SearchIcon(props){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);}

const HOMES = [
  { id: 1, address: "123 Maple St, Austin, TX", year: 1995, report: "Good condition. Minor HVAC service suggested.", sqft: 1920 },
  { id: 2, address: "456 Oak Ave, Dallas, TX", year: 2005, report: "Roof shows wear; consider inspection in 12 months.", sqft: 2210 },
  { id: 3, address: "789 Pine Ln, Houston, TX", year: 2015, report: "Excellent condition. No immediate concerns.", sqft: 1780 },
];

function App(){
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const sheetRef = useRef(null);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return HOMES;
    return HOMES.filter(h =>
      h.address.toLowerCase().includes(q) ||
      String(h.year).includes(q)
    );
  }, [query]);

  useEffect(()=>{
    // add opening class for the slide-in effect
    if(sheetRef.current){
      requestAnimationFrame(()=> sheetRef.current.classList.add("open"));
    }
  }, [selected]);

  async function exportPDF(){
    if(!selected) return;
    const node = document.getElementById("report-sheet");
    if(!node) return;

    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 24;
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
    const safeName = selected.address.replace(/\s+/g, "_").replace(/[^\w\-]/g,"");
    pdf.save(`${safeName}_report.pdf`);
  }

  return (
    <>
      <header>
        <div className="brand">
          <span className="logo">H</span>
          HomeCert
        </div>
        <div className="toolbar">
          <span className="chip">Beta</span>
          <span className="chip">Client Demo</span>
        </div>
      </header>

      <div className="grid">
        <div className="card" style={{gridColumn:"1 / -1"}}>
          <div style={{display:"flex", gap:10, alignItems:"center"}}>
            <SearchIcon />
            <input
              placeholder="Search by address or year…"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              style={{
                width:"100%", border:"1px solid #e6e6ee", borderRadius:12,
                padding:"10px 12px", outline:"none", fontSize:14
              }}
            />
          </div>
        </div>

        {filtered.map(home=>(
          <div
            key={home.id}
            className="card"
            onClick={()=>setSelected(home)}
            role="button"
            tabIndex={0}
            onKeyDown={(e)=> (e.key === "Enter") && setSelected(home)}
          >
            <div className="addr">{home.address}</div>
            <div className="muted">Year Built: {home.year}</div>
            <div className="muted">Sq Ft: {home.sqft}</div>
            <p style={{marginTop:8}}>{home.report}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="overlay" onClick={()=>setSelected(null)}>
          <div
            id="report-sheet"
            className="sheet"
            ref={sheetRef}
            onClick={(e)=>e.stopPropagation()}
          >
            <button className="close-btn" onClick={()=>setSelected(null)}>✕</button>

            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
              <HomeIcon />
              <h2 style={{margin:0}}>Home Certification Report</h2>
            </div>

            <div className="muted" style={{marginBottom:14}}>{selected.address}</div>
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16
            }}>
              <div className="card" style={{padding:12}}>
                <div className="muted">Year Built</div>
                <div style={{fontWeight:700}}>{selected.year}</div>
              </div>
              <div className="card" style={{padding:12}}>
                <div className="muted">Square Feet</div>
                <div style={{fontWeight:700}}>{selected.sqft}</div>
              </div>
            </div>

            <div className="card" style={{padding:16}}>
              <div className="muted">Summary</div>
              <p style={{marginTop:6}}>{selected.report}</p>
            </div>

            <div className="footer">
              <button className="primary" onClick={exportPDF}>
                <DownloadIcon style={{marginRight:6}}/> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
