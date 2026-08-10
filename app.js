// Real Rent Growth — Frontend
// Census ACS 5-year median gross rent (B25064) × CPI-U, nominal vs real growth.

const DATA_BASE = "data/";

let mode = "search";
let indexCache = {};
let allCounties = null;   // lazy-loaded full set (rankings)

const WINDOWS = {
    "14_19": { label: "2014 \u2192 2019", sub: "5 years (midpoint 2012 \u2192 2017)", key: "g14_19", r14: "rent14", r23: "rent19" },
    "19_23": { label: "2019 \u2192 2023", sub: "4 years (midpoint 2017 \u2192 2021)", key: "g19_23", r14: "rent19", r23: "rent23" },
    "14_23": { label: "2014 \u2192 2023", sub: "9 years (midpoint 2012 \u2192 2021)", key: "g14_23", r14: "rent14", r23: "rent23" },
};

// --- Helpers ---
async function fetchJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
}
function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtMoney(n) {
    if (n === null || n === undefined) return "—";
    return "$" + n.toLocaleString();
}
function fmtPct(p) {
    if (p === null || p === undefined) return "—";
    const sign = p > 0 ? "+" : "";
    return sign + p.toFixed(1) + "%";
}
function pctClass(p) {
    if (p === null || p === undefined) return "neu";
    if (p > 0.5) return "pos";
    if (p < -0.5) return "neg";
    return "neu";
}

// --- Mode ---
function setMode(m) {
    mode = m;
    document.getElementById("tab-search").classList.toggle("active", m === "search");
    document.getElementById("tab-rank").classList.toggle("active", m === "rank");
    document.getElementById("tab-about").classList.toggle("active", m === "about");
    document.getElementById("mode-search").classList.toggle("active", m === "search");
    document.getElementById("mode-rank").classList.toggle("active", m === "rank");
    document.getElementById("mode-about").classList.toggle("active", m === "about");
    if (m === "search") document.getElementById("search-input").focus();
    if (m === "rank") renderRankings();
    if (m === "search" && !document.getElementById("hero-count").textContent.startsWith("—")) initHero();
}

// --- Hero ---
async function initHero() {
    try {
        const stats = await fetchJson(DATA_BASE + "stats.json");
        const meta = await fetchJson(DATA_BASE + "meta.json");
        document.getElementById("hero-count").textContent = stats.count.toLocaleString();
        document.getElementById("hero-median").textContent = "$" + stats.median_rent23.toLocaleString();
        document.getElementById("hero-real").textContent = stats.count_negative_real_19_23.toLocaleString();
    } catch (e) { /* leave placeholders */ }
}

// --- Search ---
function handleSearch() {
    const q = document.getElementById("search-input").value.trim();
    const container = document.getElementById("search-results");
    if (q.length === 0) { container.innerHTML = ""; return; }
    const letter = q[0].toUpperCase();
    const key = letter >= 'A' && letter <= 'Z' ? letter.toLowerCase() : "other";
    if (indexCache[key]) {
        renderSearchResults(searchIndex(indexCache[key], q), container);
        return;
    }
    container.innerHTML = '<div class="loading">Loading…</div>';
    fetchJson(DATA_BASE + "index/" + key + ".json").then(data => {
        indexCache[key] = data;
        renderSearchResults(searchIndex(data, q), container);
    }).catch(() => {
        container.innerHTML = '<div class="no-results">No data for this letter.</div>';
    });
}

function searchIndex(entries, q) {
    const ql = q.toLowerCase();
    return entries.filter(e => e[0].toLowerCase().includes(ql)).slice(0, 30);
}

function renderSearchResults(entries, container) {
    if (!entries || entries.length === 0) {
        container.innerHTML = '<div class="no-results">No counties match that name.</div>';
        return;
    }
    container.innerHTML = entries.map(e =>
        `<div class="result-item" onclick="showDetail('${e[2]}')">
            <div class="info">
                <div class="name">${esc(e[0])}</div>
                <div class="location">${esc(e[1])}</div>
            </div>
            <span class="change-badge">Median rent →</span>
        </div>`
    ).join("");
}

// --- Detail ---
async function showDetail(fips) {
    const prefix = md5(fips.toLowerCase()).substring(0, 2);
    const panel = document.getElementById("detail-panel");
    panel.innerHTML = '<div class="loading">Loading…</div>';
    panel.classList.add("active");
    document.getElementById("search-results").innerHTML = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    let meta = null;
    try { meta = await fetchJson(DATA_BASE + "meta.json"); } catch (e) {}
    try {
        const shard = await fetchJson(DATA_BASE + "detail/" + prefix + ".json");
        const d = shard[fips];
        if (!d) { panel.innerHTML = '<div class="no-results">County not found.</div>'; return; }
        renderDetail(d, meta);
    } catch (e) {
        panel.innerHTML = '<div class="no-results">Could not load county data.</div>';
    }
}

function windowRow(w, d, cpiPct, maxAbs) {
    const g = d[w.key];
    const nom = g ? g[0] : null;
    const real = g ? g[1] : null;
    if (nom === null) {
        return `<div class="window-card"><h4>${w.label} — ${w.sub}</h4>
            <div class="window-note">Growth not computed: rent data missing for one or both windows.</div></div>`;
    }
    const bar = (label, val) => {
        const cls = pctClass(val);
        const pctOfMax = Math.min(Math.abs(val) / maxAbs * 100, 100);
        return `<div class="bar-row">
            <div class="bar-label">${label}</div>
            <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pctOfMax}%"></div></div>
            <div class="bar-value ${cls}">${fmtPct(val)}</div>
        </div>`;
    };
    const diff = nom - real;
    return `<div class="window-card">
        <h4>${w.label} <span style="color:var(--text2);font-weight:400">— ${w.sub}</span></h4>
        ${bar("Nominal", nom)}
        ${bar("Real (CPI-adj.)", real)}
        <div class="window-note">Inflation over this window: <b>+${cpiPct.toFixed(1)}%</b> (CPI-U). The gap between nominal and real is the inflation gap: <b>${fmtPct(diff)}</b> of the sticker increase was inflation.</div>
    </div>`;
}

function renderDetail(d, meta) {
    const panel = document.getElementById("detail-panel");
    const cpiPct = {
        "14_19": ((meta && meta.cpi ? meta.cpi.factor_14_19 : 1.0677) - 1) * 100,
        "19_23": ((meta && meta.cpi ? meta.cpi.factor_19_23 : 1.1055) - 1) * 100,
        "14_23": ((meta && meta.cpi ? meta.cpi.factor_14_23 : 1.1803) - 1) * 100,
    };

    // Money line: pick the most recent computable window
    let ml = "";
    for (const wk of ["19_23", "14_23"]) {
        const g = d[wk];
        if (g && g[0] !== null) {
            const w = WINDOWS[wk];
            const nom = g[0], real = g[1];
            const verb = real >= 0 ? "rose" : "fell";
            const realAbs = Math.abs(real);
            ml = `<div class="money-line">Median gross rent ${verb} <b>${fmtPct(nom)}</b> (${w.label}) — but inflation ate <b>+${cpiPct[wk].toFixed(1)}%</b>. In real terms, rents ${verb} <b>${fmtPct(real)}</b>.</div>`;
            break;
        }
    }
    if (!ml) ml = `<div class="money-line">Not enough data to compute rent growth for this county.</div>`;

    const windows = ["14_19", "19_23", "14_23"].map(wk => windowRow(WINDOWS[wk], d, cpiPct[wk], 60)).join("");

    const rents = `<div class="section"><h3>Median Gross Rent (ACS 5-year)</h3>
        <table class="rent-table">
            <thead><tr><th>Window</th><th>Years covered</th><th class="num">Median rent</th><th class="num">Midpoint</th></tr></thead>
            <tbody>
                <tr><td>2014 5-year</td><td>2010–2014</td><td class="num">${fmtMoney(d.rent14)}</td><td class="num">2012</td></tr>
                <tr><td>2019 5-year</td><td>2015–2019</td><td class="num">${fmtMoney(d.rent19)}</td><td class="num">2017</td></tr>
                <tr><td>2023 5-year</td><td>2019–2023</td><td class="num">${fmtMoney(d.rent23)}</td><td class="num">2021</td></tr>
            </tbody>
        </table></div>`;

    panel.innerHTML = `
        <button class="back" onclick="hideDetail()">← Back to search</button>
        <div class="detail-title">${esc(d.name)}</div>
        <div class="subtitle">${esc(d.state)} — median gross rent vs. inflation</div>
        ${ml}
        <div class="stats-grid">
            <div class="stat-card"><div class="big">${fmtMoney(d.rent23)}</div><div class="small">Median rent, 2019–2023</div></div>
            <div class="stat-card"><div class="big">${fmtMoney(d.rent19)}</div><div class="small">Median rent, 2015–2019</div></div>
            <div class="stat-card"><div class="big">${fmtMoney(d.rent14)}</div><div class="small">Median rent, 2010–2014</div></div>
        </div>
        ${rents}
        <div class="section"><h3>Growth, Nominal vs. Real</h3>${windows}</div>
        <div class="section"><h3>About These Numbers</h3>
            <p style="font-size:0.85em;color:var(--text2)">
                Median gross rent comes from the Census American Community Survey 5-year estimates (table B25064);
                each figure covers the whole 5-year window, not a single year. Growth is the ratio of two vintage
                medians — it is not a repeat-rent index, so it mixes unit turnover and quality changes with price change.
                The real adjustment uses the national CPI-U between window midpoints (2012, 2017, 2021).
                Margins of error are not shown.
            </p>
        </div>
    `;
}

function hideDetail() {
    document.getElementById("detail-panel").classList.remove("active");
    document.getElementById("detail-panel").innerHTML = "";
}

// --- Rankings ---
async function loadAllCounties() {
    if (allCounties) return allCounties;
    const data = await fetchJson(DATA_BASE + "counties.json");
    allCounties = data;
    return allCounties;
}

async function renderRankings() {
    const container = document.getElementById("rank-results");
    container.innerHTML = '<div class="loading">Loading…</div>';
    try {
        const counties = await loadAllCounties();
        const wk = document.getElementById("rank-window").value;
        const sortKey = document.getElementById("rank-sort").value;
        const min100 = document.getElementById("rank-min100").checked;
        const w = WINDOWS[wk];

        let rows = counties
            .filter(c => c[w.key] && c[w.key][0] !== null)
            .filter(c => !min100 || (c.rent23 || 0) >= 500)
            .map(c => ({
                name: c.name, state: c.state, fips: c.fips,
                nom: c[w.key][0], real: c[w.key][1],
            }));

        if (sortKey === "real") rows.sort((a, b) => b.real - a.real);
        else if (sortKey === "nominal") rows.sort((a, b) => b.nom - a.nom);
        else rows.sort((a, b) => (b.nom - b.real) - (a.nom - a.real));

        const head = sortKey === "diff" ? "Inflation gap (nominal − real)" :
                     sortKey === "nominal" ? "Nominal growth" : "Real growth (after inflation)";
        const show = rows.slice(0, 25);
        container.innerHTML = `
            <div style="color:var(--text2);font-size:0.85em;margin-bottom:10px">
                ${rows.length.toLocaleString()} counties with data for ${w.label} — sorted by ${head.toLowerCase()}.
                Top 25 shown.
            </div>
            <table class="rank-table">
                <thead><tr><th>#</th><th>County</th><th class="num">${head}</th><th class="num">Nominal</th><th class="num">2023 rent</th></tr></thead>
                <tbody>
                ${show.map((r, i) => `
                    <tr onclick="showDetail('${r.fips}')">
                        <td>${i + 1}</td>
                        <td>${esc(r.name)}, ${esc(r.state)}</td>
                        <td class="num ${pctClass(r.real)}">${fmtPct(r.real)}</td>
                        <td class="num">${fmtPct(r.nom)}</td>
                        <td class="num">${fmtMoney(counties.find(c => c.fips === r.fips).rent23)}</td>
                    </tr>`).join("")}
                </tbody>
            </table>`;
    } catch (e) {
        container.innerHTML = '<div class="no-results">Could not load rankings.</div>';
    }
}

// MD5 implementation (pure JS, for FIPS → shard prefix mapping)
function md5(A){function B(B,C){return B<<C|B>>>32-C}function C(B,C){var D,E,F,G,H;F=2147483648&B,G=2147483648&C;D=1073741824&B,E=1073741824&C;H=(1073741823&B)+(1073741823&C);return D&E?H^2147483648^F^G:D|E?1073741824&H?H^3221225472^F^G:H^1073741824^F^G:H^F^G}function D(A,D,E,F,G,H,I){A=C(A,C(C(function(B,C,D){return B&C|~B&D}(D,E,F),G),I));return C(B(A,H),D)}function E(A,D,E,F,G,H,I){A=C(A,C(C(function(B,C,D){return B&D|C&~D}(D,E,F),G),I));return C(B(A,H),D)}function F(A,D,E,F,G,H,I){A=C(A,C(C(function(B,C,D){return B^C^D}(D,E,F),G),I));return C(B(A,H),D)}function G(A,D,E,F,G,H,I){A=C(A,C(C(function(B,C,D){return C^(B|~D)}(D,E,F),G),I));return C(B(A,H),D)}function H(A){var B,D=A.length,E=D+8,F=(E-E%64)/64,G=16*(F+1),H=Array(G-1),I=0,J=0;while(J<D)B=(J-J%4)/4,I=J%4*8,H[B]=H[B]|A.charCodeAt(J)<<I,J++;B=(J-J%4)/4;I=J%4*8;H[B]=H[B]|128<<I;H[G-2]=D<<3;H[G-1]=D>>>29;return H}function I(A){var B,C,D="",E="";for(C=0;C<=3;C++)B=A>>>8*C&255,E="0"+B.toString(16),D=D+E.substr(E.length-2,2);return D}var J=Array(),K,L,M,N,O,P,Q,R,S,T=7,U=12,V=17,W=22,X=5,Y=9,Z=13,$=14,_=4,a=11,b=16,c=23,d=6,e=10,f=15,g=21;A=function(A){for(var A=A.replace(/\r\n/g,"\n"),B="",C=0;C<A.length;C++){var D=A.charCodeAt(C);D<128?B+=String.fromCharCode(D):D>127&&D<2048?(B+=String.fromCharCode(D>>6|192),B+=String.fromCharCode(63&D|128)):(B+=String.fromCharCode(D>>12|224),B+=String.fromCharCode(D>>6&63|128),B+=String.fromCharCode(63&D|128))}return B}(A);J=H(A);P=1732584193;Q=4023233417;R=2562383102;S=271733878;for(K=0;K<J.length;K+=16){L=P;M=Q;N=R;O=S;P=D(P,Q,R,S,J[K+0],T,3614090360);S=D(S,P,Q,R,J[K+1],U,3905402710);R=D(R,S,P,Q,J[K+2],V,606105819);Q=D(Q,R,S,P,J[K+3],W,3250441966);P=D(P,Q,R,S,J[K+4],T,4118548399);S=D(S,P,Q,R,J[K+5],U,1200080426);R=D(R,S,P,Q,J[K+6],V,2821735955);Q=D(Q,R,S,P,J[K+7],W,4249261313);P=D(P,Q,R,S,J[K+8],T,1770035416);S=D(S,P,Q,R,J[K+9],U,2336552879);R=D(R,S,P,Q,J[K+10],V,4294925233);Q=D(Q,R,S,P,J[K+11],W,2304563134);P=D(P,Q,R,S,J[K+12],T,1804603682);S=D(S,P,Q,R,J[K+13],U,4254626195);R=D(R,S,P,Q,J[K+14],V,2792965006);Q=D(Q,R,S,P,J[K+15],W,1236535329);P=E(P,Q,R,S,J[K+1],X,4129170786);S=E(S,P,Q,R,J[K+6],Y,3225465664);R=E(R,S,P,Q,J[K+11],Z,643717713);Q=E(Q,R,S,P,J[K+0],$,3921069994);P=E(P,Q,R,S,J[K+5],X,3593408605);S=E(S,P,Q,R,J[K+10],Y,38016083);R=E(R,S,P,Q,J[K+15],Z,3634488961);Q=E(Q,R,S,P,J[K+4],$,3889429448);P=E(P,Q,R,S,J[K+9],X,568446438);S=E(S,P,Q,R,J[K+14],Y,3275163606);R=E(R,S,P,Q,J[K+3],Z,4107603335);Q=E(Q,R,S,P,J[K+8],$,1163531501);P=E(P,Q,R,S,J[K+13],X,2850285829);S=E(S,P,Q,R,J[K+2],Y,4243563512);R=E(R,S,P,Q,J[K+7],Z,1735328473);Q=E(Q,R,S,P,J[K+12],$,2368359562);P=F(P,Q,R,S,J[K+5],_,4294588738);S=F(S,P,Q,R,J[K+8],a,2272392833);R=F(R,S,P,Q,J[K+11],b,1839030562);Q=F(Q,R,S,P,J[K+14],c,4259657740);P=F(P,Q,R,S,J[K+1],_,2763975236);S=F(S,P,Q,R,J[K+4],a,1272893353);R=F(R,S,P,Q,J[K+7],b,4139469664);Q=F(Q,R,S,P,J[K+10],c,3200236656);P=F(P,Q,R,S,J[K+13],_,681279174);S=F(S,P,Q,R,J[K+0],a,3936430074);R=F(R,S,P,Q,J[K+3],b,3572445317);Q=F(Q,R,S,P,J[K+6],c,76029189);P=F(P,Q,R,S,J[K+9],_,3654602809);S=F(S,P,Q,R,J[K+12],a,3873151461);R=F(R,S,P,Q,J[K+15],b,530742520);Q=F(Q,R,S,P,J[K+2],c,3299628645);P=G(P,Q,R,S,J[K+0],d,4096336452);S=G(S,P,Q,R,J[K+7],e,1126891415);R=G(R,S,P,Q,J[K+14],f,2878612391);Q=G(Q,R,S,P,J[K+5],g,4237533241);P=G(P,Q,R,S,J[K+12],d,1700485571);S=G(S,P,Q,R,J[K+3],e,2399980690);R=G(R,S,P,Q,J[K+10],f,4293915773);Q=G(Q,R,S,P,J[K+1],g,2240044497);P=G(P,Q,R,S,J[K+8],d,1873313359);S=G(S,P,Q,R,J[K+15],e,4264355552);R=G(R,S,P,Q,J[K+6],f,2734768916);Q=G(Q,R,S,P,J[K+13],g,1309151649);P=G(P,Q,R,S,J[K+4],d,4149444226);S=G(S,P,Q,R,J[K+11],e,3174756917);R=G(R,S,P,Q,J[K+2],f,718787259);Q=G(Q,R,S,P,J[K+9],g,3951481745);P=C(P,L);Q=C(Q,M);R=C(R,N);S=C(S,O)}return(I(P)+I(Q)+I(R)+I(S)).toLowerCase()};

// --- Init ---
setMode("search");
initHero();
