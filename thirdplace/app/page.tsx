"use client";
import { useState, useEffect } from "react";

const PROFILES = ["Wheelchair", "Cane", "Walker", "Low crowd"] as const;
type Profile = typeof PROFILES[number];

export default function Home() {
  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<Profile>("Wheelchair");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="app-shell">
      {/* ── LEFT PANEL ── */}
      <aside className="panel stack">
        <div>
          <div className="eyebrow">Hackathon-ready UI</div>
          <h1>AccessRoute mobile prototype</h1>
          <p>A full orange-accent, accessibility-first interface for your reduced-mobility routing app.</p>
        </div>
        <div className="mini-card">
          <h3>Visual direction</h3>
          <p>Calm neutral surfaces, Strava-like orange accent, big touch targets, clear route explanation cards, simple bottom-sheet navigation.</p>
        </div>
        <div className="mini-card">
          <h3>Accent palette</h3>
          <div className="palette">
            {["#FC4C02", "#D94300", "#FFF1EB", "#F7F6F3", "#1F1F1C"].map(c => (
              <div key={c} className="swatch" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="mini-card">
          <h3>5 screens</h3>
          <p>1. Home map<br/>2. Route options<br/>3. Live navigation<br/>4. Report obstacle<br/>5. Accessibility settings</p>
        </div>
      </aside>

      {/* ── SCREENS GRID ── */}
      <section className="phone-grid">

        {/* SCREEN 1 — HOME MAP */}
        <div className="phone-wrap">
          <div className="frame-label">1. Home map</div>
          <div className="frame-sub">Search, mobility profile, and route CTA</div>
          <div className="phone">
            <div className="screen">
              <div className="statusbar"><span>9:41</span><span>5G 100%</span></div>
              <div className="screen-inner">
                <div className="top-row">
                  <div>
                    <div className="eyebrow" style={{fontSize:11}}>AccessRoute</div>
                    <div style={{fontSize:24,fontWeight:800,lineHeight:1.08,marginTop:4}}>Find a safer path</div>
                  </div>
                  <button className="icon-btn" aria-label="Settings">⚙️</button>
                </div>
                <div className="search" role="search">
                  <span>🔍</span>
                  <input defaultValue="Brébeuf main entrance" aria-label="Destination" readOnly />
                </div>
                <div className="chips">
                  {PROFILES.map(p => (
                    <button key={p} className={`chip${profile === p ? " active" : ""}`} onClick={() => setProfile(p)}>
                      {p === "Wheelchair" ? "♿" : p === "Cane" ? "🦯" : p === "Walker" ? "🚶" : "👥"} {p}
                    </button>
                  ))}
                </div>
                <div className="map" aria-label="Map preview">
                  <div className="road" style={{left:-20,top:82,width:280,height:24,transform:"rotate(-12deg)"}}/>
                  <div className="road" style={{left:70,top:180,width:320,height:26,transform:"rotate(22deg)"}}/>
                  <div className="road" style={{left:160,top:28,width:28,height:340}}/>
                  <div className="route" style={{left:40,top:265,width:235,height:12,transform:"rotate(-20deg)"}}/>
                  <div className="route" style={{left:220,top:150,width:14,height:156}}/>
                  <div className="marker m-elevator" style={{left:214,top:130}}/>
                  <div className="marker m-ramp" style={{left:62,top:255}}/>
                  <div className="marker m-obstacle" style={{left:288,top:196}}/>
                  <div className="map-tag" style={{left:20,bottom:28}}>Low slope route</div>
                  <div className="map-tag" style={{right:16,bottom:96}}>Elevator ahead</div>
                  <div className="fab-col">
                    <button className="icon-btn" aria-label="Recenter">📍</button>
                    <button className="icon-btn" aria-label="Voice">🔊</button>
                    <button className="icon-btn primary" aria-label="Report">!</button>
                  </div>
                </div>
              </div>
              <div className="bottom-sheet">
                <div className="handle"/>
                <h2 className="section-title">Ready to route</h2>
                <p className="section-sub">Optimized for {profile.toLowerCase()} access, low slope, and elevator availability.</p>
                <button className="primary-btn">Find accessible route</button>
                <div style={{height:12}}/>
                <div className="alert-card">
                  <div className="row-between"><strong>Nearby alerts</strong><span className="tiny">2 live</span></div>
                  <div className="badge-row">
                    <span className="badge warn">Crowded corridor</span>
                    <span className="badge info">Elevator verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 2 — ROUTE OPTIONS */}
        <div className="phone-wrap">
          <div className="frame-label">2. Route options</div>
          <div className="frame-sub">3 alternatives with accessibility explanations</div>
          <div className="phone">
            <div className="screen">
              <div className="statusbar"><span>9:41</span><span>5G 100%</span></div>
              <div className="screen-inner">
                <div className="top-row" style={{paddingTop:6}}>
                  <button className="icon-btn" aria-label="Back">←</button>
                  <div style={{textAlign:"center",flex:1}}>
                    <div className="tiny">Destination</div>
                    <div style={{fontSize:16,fontWeight:800}}>Brébeuf main entrance</div>
                  </div>
                  <button className="icon-btn" aria-label="Share">↗</button>
                </div>
                <div className="map" style={{height:300,marginTop:16}}>
                  <div className="road" style={{left:20,top:60,width:330,height:22,transform:"rotate(-10deg)"}}/>
                  <div className="road" style={{left:40,top:180,width:290,height:22,transform:"rotate(20deg)"}}/>
                  <div className="road" style={{left:170,top:20,width:24,height:250}}/>
                  <div className="route" style={{left:50,top:188,width:160,height:10,transform:"rotate(20deg)"}}/>
                  <div className="route" style={{left:188,top:84,width:10,height:120}}/>
                  <div className="marker m-ramp" style={{left:52,top:182}}/>
                  <div className="marker m-elevator" style={{left:180,top:100}}/>
                  <div className="marker m-obstacle" style={{left:286,top:168}}/>
                </div>
              </div>
              <div className="bottom-sheet" style={{paddingBottom:22}}>
                <div className="handle"/>
                <h2 className="section-title">Choose a route</h2>
                <p className="section-sub">Best option selected for low slope and step-free access.</p>
                {[
                  {label:"Best accessible",time:"9 min · 620 m",badges:[{t:"No stairs",c:"good"},{t:"1 elevator",c:"info"},{t:"Smooth surface",c:"good"}],conf:"High confidence",sel:true},
                  {label:"Lowest slope",time:"11 min · 710 m",badges:[{t:"Gentler incline",c:"good"},{t:"Longer path",c:"warn"}],conf:"Medium",sel:false},
                  {label:"Least crowded",time:"10 min · 690 m",badges:[{t:"Quiet route",c:"warn"},{t:"1 narrow segment",c:"info"}],conf:"Medium",sel:false},
                ].map(r => (
                  <div key={r.label} className={`route-card${r.sel ? " selected" : ""}`}>
                    <div className="route-top">
                      <div><div className="route-name">{r.label}</div><div className="route-meta">{r.time}</div></div>
                      <strong>{r.conf}</strong>
                    </div>
                    <div className="badge-row">{r.badges.map(b => <span key={b.t} className={`badge ${b.c}`}>{b.t}</span>)}</div>
                  </div>
                ))}
                <div style={{height:12}}/>
                <button className="primary-btn">Start accessible route</button>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 3 — LIVE NAVIGATION */}
        <div className="phone-wrap">
          <div className="frame-label">3. Live navigation</div>
          <div className="frame-sub">Large instruction, warning, voice-friendly controls</div>
          <div className="phone">
            <div className="screen">
              <div className="statusbar"><span>9:41</span><span>5G 100%</span></div>
              <div className="screen-inner">
                <div className="top-row" style={{paddingTop:6}}>
                  <button className="icon-btn" aria-label="Exit">✕</button>
                  <div style={{textAlign:"center",flex:1}}>
                    <div className="tiny">Heading to</div>
                    <div style={{fontSize:16,fontWeight:800}}>Brébeuf main entrance</div>
                  </div>
                  <button className="icon-btn primary" aria-label="Voice">🔊</button>
                </div>
                <div className="map" style={{height:560,marginTop:16}}>
                  <div className="road" style={{left:70,top:-10,width:30,height:520}}/>
                  <div className="road" style={{left:20,top:280,width:320,height:24,transform:"rotate(22deg)"}}/>
                  <div className="route" style={{left:79,top:60,width:12,height:250}}/>
                  <div className="route" style={{left:88,top:290,width:160,height:12,transform:"rotate(22deg)"}}/>
                  <div className="marker m-warning" style={{left:78,top:230}}/>
                  <div className="marker m-elevator" style={{left:228,top:328}}/>
                  <div className="map-tag" style={{left:18,top:24}}>50 m to next turn</div>
                  <div className="fab-col" style={{top:86}}>
                    <button className="icon-btn" aria-label="Recenter">📍</button>
                    <button className="icon-btn" aria-label="Reroute">🔄</button>
                  </div>
                </div>
              </div>
              <div className="nav-card">
                <p className="instruction">Turn right toward the elevator lobby</p>
                <div className="row-between" style={{marginBottom:10}}>
                  <span className="badge warn">Crowded hall reported ahead</span>
                  <span className="tiny">ETA 6 min</span>
                </div>
                <div className="progress"><span/></div>
                <div className="grid-2" style={{marginTop:12}}>
                  <div className="stat-card"><div className="tiny">Distance left</div><strong>410 m</strong></div>
                  <div className="stat-card"><div className="tiny">Accessibility</div><strong>Step-free</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 4 — REPORT */}
        <div className="phone-wrap">
          <div className="frame-label">4. Report obstacle</div>
          <div className="frame-sub">Fast report flow with large tiles</div>
          <div className="phone">
            <div className="screen">
              <div className="statusbar"><span>9:41</span><span>5G 100%</span></div>
              <div className="screen-inner" style={{paddingTop:10}}>
                <div className="top-row">
                  <button className="icon-btn" aria-label="Close">✕</button>
                  <div style={{fontSize:20,fontWeight:800}}>Report obstacle</div>
                  <div style={{width:44}}/>
                </div>
                <p className="section-sub" style={{marginTop:10}}>Help improve route quality for the next person.</p>
                <div className="report-grid">
                  {[
                    {icon:"🚫",label:"Broken elevator",active:true},
                    {icon:"🪜",label:"Stairs only"},
                    {icon:"🚧",label:"Blocked sidewalk"},
                    {icon:"👥",label:"Too crowded"},
                    {icon:"❄️",label:"Snow / ice"},
                    {icon:"✍️",label:"Other issue"},
                  ].map(t => (
                    <div key={t.label} className={`report-tile${t.active ? " active" : ""}`}>
                      <span>{t.icon}</span><span>{t.label}</span>
                    </div>
                  ))}
                </div>
                <div className="route-card">
                  <div className="route-name">Location</div>
                  <div className="route-meta">Main building elevator near east entrance</div>
                </div>
                <div className="grid-2" style={{marginTop:10}}>
                  <button className="secondary-btn">Add photo</button>
                  <button className="secondary-btn">Add audio</button>
                </div>
                <div style={{height:14}}/>
                <button className="primary-btn">Submit report</button>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 5 — SETTINGS */}
        <div className="phone-wrap">
          <div className="frame-label">5. Accessibility settings</div>
          <div className="frame-sub">Comfort, contrast, voice, and confidence controls</div>
          <div className="phone">
            <div className="screen">
              <div className="statusbar"><span>9:41</span><span>5G 100%</span></div>
              <div className="screen-inner" style={{paddingTop:10}}>
                <div className="top-row">
                  <div>
                    <div className="eyebrow" style={{fontSize:11}}>Preferences</div>
                    <div style={{fontSize:24,fontWeight:800,marginTop:4}}>Settings</div>
                  </div>
                  <button className="icon-btn" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
                    {dark ? "☀️" : "🌙"}
                  </button>
                </div>
                <div className="settings-list">
                  {[
                    {label:"Larger text",sub:"Improve readability",on:true},
                    {label:"High contrast",sub:"Boost map separation",on:false},
                    {label:"Voice guidance",sub:"Hear upcoming turns",on:true},
                    {label:"Reduce motion",sub:"Minimize animations",on:true},
                    {label:"Avoid indoor paths",sub:"Prefer outdoor routes",on:false},
                    {label:"Verified routes only",sub:"Hide low-confidence paths",on:true},
                  ].map(s => (
                    <div key={s.label} className="setting-row">
                      <div><strong>{s.label}</strong><div className="tiny">{s.sub}</div></div>
                      <div className={`toggle${s.on ? " on" : ""}`}/>
                    </div>
                  ))}
                </div>
                <div style={{height:14}}/>
                <button className="primary-btn">Save preferences</button>
              </div>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
