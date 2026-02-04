// --- 1. IMPORTS & CONFIG ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, runTransaction, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// LOG ERRORS TO SCREEN
window.onerror = function(message, source, lineno, colno, error) {
    const consoleDiv = document.getElementById('error-console');
    consoleDiv.style.display = 'block';
    consoleDiv.innerHTML += `ERROR: ${message} at line ${lineno}<br>`;
};

const firebaseConfig = {
    apiKey: "AIzaSyDZLaQkYIBjV-TKc3al9M97ALLwa3X2sKg",
    authDomain: "stock-ticker-game.firebaseapp.com",
    projectId: "stock-ticker-game",
    storageBucket: "stock-ticker-game.firebasestorage.app",
    messagingSenderId: "756004846868",
    appId: "1:756004846868:web:91b2511bbe6a26213a9601",
    measurementId: "G-ZC3VXLMJS5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- 2. GLOBAL VARIABLES ---
let currentUser = null;
let marketPrices = {};
let userPortfolio = { cash: 0, stocks: {} }; 
let myChart = null;
let chartInstance = null; // For ApexCharts
let lastChartData = []; 
let isDataLoaded = false; 
let cachedLeaderboardData = null; 
let lastFetchTime = 0; 
let historyCache = null; // <--- NEW: Stores graph data
let lastHistoryFetch = 0; // <--- NEW: Timestamp of last graph fetch

// --- 3. THEME ENGINE ---
const stocks = ['Gold', 'Silver', 'Oil', 'Bonds', 'Industrial', 'Grain'];

const THEMES = {
    'classic': {
        name: 'Wall Street',
        desc: 'The original terminal look.',
        css: {
            dark: { '--bg': '#121212', '--card': '#1e1e1e', '--text': '#e0e0e0', '--border': '#333', '--input-bg': '#2a2a2a', '--font-main': "'Courier New', monospace", '--accent': '#ffd700', '--chart-grid': '#333' },
            light: { '--bg': '#f4f6f8', '--card': '#ffffff', '--text': '#212b36', '--border': '#dfe3e8', '--input-bg': '#f9fafb', '--font-main': "'Courier New', monospace", '--accent': '#0066cc', '--chart-grid': '#ddd' }
        },
        map: { 'Gold': {n:'Gold', e:'🏆'}, 'Silver': {n:'Silver', e:'🥈'}, 'Oil': {n:'Oil', e:'🛢️'}, 'Bonds': {n:'Bonds', e:'📜'}, 'Industrial': {n:'Industrial', e:'🏭'}, 'Grain': {n:'Grain', e:'🌾'} }
    },
    'tech': {
        name: 'Silicon Valley',
        desc: 'Clean, modern, corporate.',
        css: {
            dark: { '--bg': '#0d1117', '--card': '#161b22', '--text': '#c9d1d9', '--border': '#30363d', '--input-bg': '#21262d', '--font-main': "sans-serif", '--accent': '#58a6ff', '--chart-grid': '#30363d' },
            light: { '--bg': '#ffffff', '--card': '#f6f8fa', '--text': '#24292f', '--border': '#d0d7de', '--input-bg': '#ffffff', '--font-main': "sans-serif", '--accent': '#0969da', '--chart-grid': '#eaeaea' }
        },
        map: { 'Gold': {n:'Nvidia', e:'📼'}, 'Silver': {n:'Starlink', e:'📡'}, 'Oil': {n:'Tesla', e:'🔋'}, 'Bonds': {n:'Microsoft', e:'💾'}, 'Industrial': {n:'Amazon', e:'📦'}, 'Grain': {n:'Google', e:'🔎'} }
    },
    'cyberpunk': {
        name: 'Night City',
        desc: 'High contrast sci-fi.',
        css: {
            dark: { '--bg': '#050505', '--card': '#0a0a0a', '--text': '#00ff99', '--border': '#00ff99', '--input-bg': '#000', '--font-main': "monospace", '--accent': '#ff00ff', '--chart-grid': '#003300' },
            light: { '--bg': '#e0e0e0', '--card': '#ffffff', '--text': '#000000', '--border': '#ff00ff', '--input-bg': '#f0f0f0', '--font-main': "monospace", '--accent': '#00b36b', '--chart-grid': '#ccc' }
        },
        map: { 'Gold': {n:'Neon Gas', e:'🧪'}, 'Silver': {n:'Neural Link', e:'🧠'}, 'Oil': {n:'Bio-Fuel', e:'🟢'}, 'Bonds': {n:'Credits', e:'💳'}, 'Industrial': {n:'Drones', e:'🛸'}, 'Grain': {n:'Paste', e:'🍱'} }
    },
    'fantasy': {
        name: 'Kingdoms',
        desc: 'Old parchment and wood.',
        css: {
            dark: { '--bg': '#2c241b', '--card': '#3e3226', '--text': '#e0d4b8', '--border': '#8a6a4b', '--input-bg': '#261f18', '--font-main': "serif", '--accent': '#ffb74d', '--chart-grid': '#5c4d3c' },
            light: { '--bg': '#f3e5ab', '--card': '#fffbf0', '--text': '#4a3b2a', '--border': '#d4c5a3', '--input-bg': '#fff8e1', '--font-main': "serif", '--accent': '#8a6a4b', '--chart-grid': '#d4c5a3' }
        },
        map: { 'Gold': {n:'Dragon Scale', e:'🐉'}, 'Silver': {n:'Mithril', e:'⚔️'}, 'Oil': {n:'Elixir', e:'🧪'}, 'Bonds': {n:'Decrees', e:'📜'}, 'Industrial': {n:'Iron', e:'🛡️'}, 'Grain': {n:'Wheat', e:'🍞'} }
    },
    'crypto': {
        name: 'Crypto Bro',
        desc: 'Modern financial apps.',
        css: {
            dark: { '--bg': '#1a1a2e', '--card': '#16213e', '--text': '#e94560', '--border': '#0f3460', '--input-bg': '#0f3460', '--font-main': "sans-serif", '--accent': '#4caf50', '--chart-grid': '#2a2a4e' },
            light: { '--bg': '#f0f5ff', '--card': '#ffffff', '--text': '#1a1a2e', '--border': '#cddeff', '--input-bg': '#f8faff', '--font-main': "sans-serif", '--accent': '#e94560', '--chart-grid': '#e0eaff' }
        },
        map: { 'Gold': {n:'Bitcoin', e:'₿'}, 'Silver': {n:'Ethereum', e:'Ξ'}, 'Oil': {n:'Solana', e:'◎'}, 'Bonds': {n:'USDC', e:'💲'}, 'Industrial': {n:'Doge', e:'🐕'}, 'Grain': {n:'Pepe', e:'🐸'} }
    }
};

let currentThemeKey = localStorage.getItem('market_theme') || 'classic';
let isDarkMode = localStorage.getItem('theme_mode') !== 'light'; 
if(!THEMES[currentThemeKey]) currentThemeKey = 'classic';

function applyVisuals() {
    const t = THEMES[currentThemeKey];
    const mode = isDarkMode ? 'dark' : 'light';
    const root = document.documentElement;
    const palette = t.css[mode];
    
    Object.keys(palette).forEach(prop => {
        root.style.setProperty(prop, palette[prop]);
    });

    document.getElementById('theme-toggle').innerText = isDarkMode ? '🌙' : '☀';
    localStorage.setItem('market_theme', currentThemeKey);
    localStorage.setItem('theme_mode', isDarkMode ? 'dark' : 'light');

    if(lastChartData && lastChartData.length > 0) updateChart(lastChartData);
}

applyVisuals();

function getDisplayInfo(dbName) {
    return THEMES[currentThemeKey].map[dbName] || {n: dbName, e: ''};
}

// --- 4. GLOBAL UI FUNCTIONS (ATTACHED TO WINDOW) ---
window.openSettings = () => document.getElementById('settings-modal').style.display = 'flex';
window.closeSettings = () => document.getElementById('settings-modal').style.display = 'none';

// HELP MODAL LOGIC
window.openHelp = () => document.getElementById('help-modal').style.display = 'flex';
window.closeHelp = () => {
    document.getElementById('help-modal').style.display = 'none';
    localStorage.setItem('hasSeenTutorial', 'true');
};

// GRAPH MODAL LOGIC (FIXED)
window.openGraph = async (stockName) => {
    const modal = document.getElementById('graph-modal');
    modal.style.display = "flex";
    document.getElementById('graph-title').innerText = `${getDisplayInfo(stockName).n} History (48h)`;
    document.getElementById('chart-container').innerHTML = "Loading...";

    try {
        const now = Date.now();
        // --- CACHING FIX: Only fetch if empty or > 1 hour old ---
        if (!historyCache || (now - lastHistoryFetch > 60 * 60 * 1000)) {
            const docRef = doc(db, "game_state", "market_history");
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
                historyCache = snap.data().points || [];
                lastHistoryFetch = now;
            } else {
                historyCache = [];
            }
        }

        if (!historyCache || historyCache.length === 0) {
            document.getElementById('chart-container').innerText = "No history data yet.";
            return;
        }

        const seriesData = historyCache.map(point => [point.ts, point.prices[stockName]]);

        document.getElementById('chart-container').innerHTML = ""; 
        
        const options = {
            series: [{ name: stockName, data: seriesData }],
            chart: { 
                type: 'area', 
                height: 300, 
                toolbar: { show: false }, 
                background: 'transparent',
                // --- GRAPH FIX: DISABLE ZOOM/SELECTION ---
                zoom: { enabled: false },
                selection: { enabled: false },
                events: {
                    selection: function (chart, e) { e.preventDefault(); }
                }
            },
            theme: { mode: isDarkMode ? 'dark' : 'light' },
            stroke: { curve: 'smooth', width: 2, colors: [getStockColor(stockName)] },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 100] } },
            dataLabels: { enabled: false },
            xaxis: { type: 'datetime', tooltip: { enabled: false }, axisBorder: { show: false }, axisTicks: { show: false } },
            
            // --- Y-AXIS LOCK ---
            yaxis: { 
                min: 0, 
                max: 200,
                labels: { formatter: (val) => "$" + val.toFixed(0) } 
            },
            tooltip: {
                enabled: true,
                followCursor: true, 
                x: { format: 'h:mm TT' },
                theme: isDarkMode ? 'dark' : 'light'
            },
            grid: { borderColor: '#333', strokeDashArray: 4 },
            colors: [getStockColor(stockName)]
        };

        if(chartInstance) chartInstance.destroy();
        chartInstance = new ApexCharts(document.querySelector("#chart-container"), options);
        chartInstance.render();

    } catch (e) {
        console.error("Graph Error:", e);
        document.getElementById('chart-container').innerText = "Error loading graph.";
    }
}
window.closeGraph = () => document.getElementById('graph-modal').style.display = 'none';

window.setTheme = (key) => {
    currentThemeKey = key;
    applyVisuals();
    location.reload(); 
};

window.toggleDarkMode = () => {
    isDarkMode = !isDarkMode;
    applyVisuals();
};

// GENERATE THEME BUTTONS
const themeContainer = document.getElementById('theme-options');
Object.keys(THEMES).forEach(key => {
    const t = THEMES[key];
    const btn = document.createElement('button');
    btn.className = 'btn-theme';
    if(key === currentThemeKey) btn.style.border = '2px solid var(--accent)';
    const circle = `<span class="theme-preview" style="background:${t.css.dark['--bg']}"></span>`;
    btn.innerHTML = `${circle} <b>${t.name}</b><br><span style="font-size:0.75em; color:var(--text-muted)">${t.desc}</span>`;
    btn.onclick = () => window.setTheme(key);
    themeContainer.appendChild(btn);
});

// GENERATE MARKET GRID
const grid = document.getElementById('market-grid');
stocks.forEach(stock => {
    const info = getDisplayInfo(stock);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div style="position:absolute; top:10px; right:10px;">
            <button onclick="openGraph('${stock}')" style="background:none; padding:5px; font-size:1.2rem;">📈</button>
        </div>
        <span class="stock-emoji">${info.e}</span>
        <div class="stock-name">${info.n}</div>
        <div class="stock-price" id="price-${stock}">--</div>
        <div class="stock-owned">Owned: <span id="owned-${stock}">0</span></div>
        <div class="max-controls">
            <span class="max-btn" onclick="setMax('${stock}', 'buy')">Max Buy</span>
            <span class="max-btn" onclick="setMax('${stock}', 'sell')">Max Sell</span>
        </div>
        <div style="margin-bottom: 10px; display:flex; align-items:center; justify-content:center;">
            <input type="number" id="qty-${stock}" value="500" min="500" step="500">
        </div>
        <div class="trade-actions">
            <button class="btn-buy" onclick="trade('${stock}', 'buy')">BUY</button>
            <button class="btn-sell" onclick="trade('${stock}', 'sell')">SELL</button>
        </div>
    `;
    grid.appendChild(card);
});

// GENERATE LEADERBOARD BUTTONS
const lbContainer = document.getElementById('lb-buttons');
lbContainer.innerHTML = `
    <button onclick="loadLeaderboard('net_worth')" class="btn-tab active">Net Worth</button>
    <button onclick="loadLeaderboard('cash')" class="btn-tab">Cash</button>
`;
stocks.forEach(s => {
    const info = getDisplayInfo(s);
    const btn = document.createElement('button');
    btn.className = 'btn-tab';
    btn.innerHTML = `${info.e} ${info.n}`;
    btn.onclick = () => loadLeaderboard(`stocks.${s}`);
    lbContainer.appendChild(btn);
});

// --- 5. GAME LOGIC ---
async function handleTrade(stock, type, quantity) {
    if (!currentUser) return alert("Please sign in to trade.");
    if (!isDataLoaded) return alert("Still loading your wallet... please wait 2 seconds.");
    if (marketPrices[stock] === undefined) return alert("Market data loading...");

    const userRef = doc(db, "users", currentUser.uid);
    const marketRef = doc(db, "game_state", "current_market");

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const marketDoc = await transaction.get(marketRef);
            if (!userDoc.exists()) throw "User profile not found.";
            
            const userData = userDoc.data();
            const currentPrice = marketDoc.data()[stock];
            const totalCost = (currentPrice / 100) * quantity;
            
            if (type === 'buy') {
                if (userData.cash < totalCost) throw `Not enough cash! Needed: $${totalCost.toLocaleString()}`;
                transaction.update(userRef, {
                    cash: userData.cash - totalCost,
                    [`stocks.${stock}`]: (userData.stocks[stock] || 0) + quantity
                });
            } else {
                if ((userData.stocks[stock] || 0) < quantity) throw "You don't have enough shares.";
                transaction.update(userRef, {
                    cash: userData.cash + totalCost,
                    [`stocks.${stock}`]: userData.stocks[stock] - quantity
                });
            }
        });
    } catch (e) { alert(e); }
}

// EXPORT TO WINDOW (So HTML can see them)
window.trade = (stock, type) => {
    const qtyInput = document.getElementById(`qty-${stock}`);
    const qty = parseInt(qtyInput.value);
    if (!qty || qty <= 0 || qty % 500 !== 0) return alert("Quantity must be a multiple of 500.");
    handleTrade(stock, type, qty);
};

window.setMax = (stock, type) => {
    if(!marketPrices[stock]) return;
    const priceCents = marketPrices[stock];
    const priceDollars = priceCents / 100;
    const input = document.getElementById(`qty-${stock}`);
    
    if (type === 'buy') {
        if(priceDollars <= 0) return; 
        const maxRaw = userPortfolio.cash / priceDollars;
        const maxValid = Math.floor(maxRaw / 500) * 500;
        input.value = maxValid > 0 ? maxValid : 500; 
    } else {
        const owned = userPortfolio.stocks[stock] || 0;
        const maxValid = Math.floor(owned / 500) * 500;
        input.value = maxValid > 0 ? maxValid : 500;
    }
};

window.loadLeaderboard = (criteria) => fetchLeaderboard(criteria);

window.changeName = async () => {
    if(!currentUser) return;
    const newName = prompt("Enter your new Gamertag:", currentUser.displayName);
    if(newName && newName.trim().length > 0) {
        try {
            const cleanName = newName.trim();
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { name: cleanName });
            await updateProfile(currentUser, { displayName: cleanName });
            document.getElementById('user-name').innerText = cleanName;
            fetchLeaderboard('net_worth'); 
        } catch(e) { alert("Error updating name: " + e.message); }
    }
};

window.declareBankruptcy = async () => {
    if (!currentUser) return;
    if(!confirm("Declare Bankruptcy?\n\n- Wallet resets to $2,000\n- Stocks reset to 0\n- 72 Hour Cooldown")) return;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const docSnap = await transaction.get(userRef);
            if (!docSnap.exists()) throw "User not found";
            
            const data = docSnap.data();
            const totalShares = Object.values(data.stocks || {}).reduce((a, b) => a + b, 0);

            if (data.cash > 500) throw "You have too much cash to declare bankruptcy.";
            if (totalShares > 0) throw "You must sell all stocks before declaring bankruptcy.";

            if (data.lastBankruptcy) {
                const lastTime = data.lastBankruptcy.toDate().getTime();
                const now = Date.now();
                const hoursPassed = (now - lastTime) / (1000 * 60 * 60);
                if (hoursPassed < 72) throw `Wait ${Math.ceil(72 - hoursPassed)} more hours.`;
            }

            transaction.update(userRef, {
                cash: 2000,
                stocks: { Gold: 0, Silver: 0, Oil: 0, Bonds: 0, Industrial: 0, Grain: 0 },
                lastBankruptcy: serverTimestamp()
            });
        });
        alert("You have been bailed out. Wallet set to $2,000.");
    } catch (e) { alert("Failed: " + e); }
};

// --- 6. FIREBASE LISTENERS ---
onSnapshot(doc(db, "game_state", "current_market"), (docSnap) => {
    if (docSnap.exists()) {
        marketPrices = docSnap.data();
        stocks.forEach(s => {
            const price = marketPrices[s];
            const el = document.getElementById(`price-${s}`);
            el.innerText = price;
            const safePrice = Math.min(Math.max(price, 0), 200); 
            const hue = (safePrice / 200) * 120; 
            el.style.color = `hsl(${hue}, 100%, 50%)`;
        });
        const activeBtn = document.querySelector('.btn-tab.active');
        if(activeBtn && activeBtn.innerText.includes("Net Worth")) fetchLeaderboard('net_worth');
    }
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('profile-view').style.display = 'block';
        document.getElementById('user-name').innerText = user.displayName || "Player";
        
        // CHECK FOR FIRST TIME USER
        if (!localStorage.getItem('hasSeenTutorial')) {
            setTimeout(() => window.openHelp(), 1500);
        }

        const userRef = doc(db, "users", user.uid);
        
        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(userRef);
                if (!docSnap.exists()) {
                    transaction.set(userRef, {
                        name: user.displayName,
                        email: user.email,
                        cash: 5000, 
                        stocks: { Gold: 0, Silver: 0, Oil: 0, Bonds: 0, Industrial: 0, Grain: 0 },
                        createdAt: serverTimestamp()
                    });
                }
            });
        } catch (e) { console.error("Init Error:", e); }

        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                userPortfolio = data; 
                isDataLoaded = true; 

                document.getElementById('user-cash').innerText = "$" + Math.floor(data.cash).toLocaleString();
                if(data.name) document.getElementById('user-name').innerText = data.name;
                
                stocks.forEach(s => {
                    const count = (data.stocks && data.stocks[s]) ? data.stocks[s] : 0;
                    document.getElementById(`owned-${s}`).innerText = count;
                });

                const totalShares = Object.values(data.stocks || {}).reduce((a, b) => a + b, 0);
                const bankruptcyBtn = document.getElementById('bankruptcy-btn');
                
                if (data.cash <= 500 && totalShares === 0) {
                    bankruptcyBtn.style.display = 'block';
                    if (data.lastBankruptcy) {
                        const lastTime = data.lastBankruptcy.toDate().getTime();
                        const hoursLeft = 72 - ((Date.now() - lastTime) / (1000 * 60 * 60));
                        if (hoursLeft > 0) {
                            bankruptcyBtn.innerText = `💀 Cooldown (${Math.ceil(hoursLeft)}h)`;
                            bankruptcyBtn.disabled = true;
                        } else {
                            bankruptcyBtn.innerText = "💀 DECLARE BANKRUPTCY";
                            bankruptcyBtn.disabled = false;
                        }
                    } else {
                        bankruptcyBtn.innerText = "💀 DECLARE BANKRUPTCY";
                        bankruptcyBtn.disabled = false;
                    }
                } else {
                    bankruptcyBtn.style.display = 'none';
                }
            }
        });

    } else {
        document.getElementById('login-view').style.display = 'block';
        document.getElementById('profile-view').style.display = 'none';
        isDataLoaded = false; 
        userPortfolio = { cash: 0, stocks: {} };
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);


async function fetchLeaderboard(criteria) {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    if(event && event.target && event.target.classList) event.target.classList.add('active');

    const lbBody = document.getElementById('leaderboard-body');
    const header = document.getElementById('lb-score-header');

    try {
        const now = Date.now();
        const CACHE_DURATION = 60 * 1000; 

        if (!cachedLeaderboardData || (now - lastFetchTime > CACHE_DURATION)) {
            const lbRef = doc(db, "game_state", "leaderboard");
            const directSnap = await getDoc(lbRef);
            if (directSnap.exists()) {
                cachedLeaderboardData = directSnap.data().all_players || [];
                lastFetchTime = now;
            }
        }

        if (!cachedLeaderboardData) {
            lbBody.innerHTML = "<tr><td colspan='3'>Leaderboard calculating...</td></tr>";
            return;
        }

        let players = [...cachedLeaderboardData];
        let sortKey = criteria;
        let isStock = false;

        if (criteria.startsWith('stocks.')) {
            sortKey = criteria.split('.')[1];
            isStock = true;
        }

        if (criteria === 'net_worth') {
            header.innerText = "Net Worth ($)";
            players.sort((a, b) => b.net_worth - a.net_worth);
        } 
        else if (criteria === 'cash') {
            header.innerText = "Cash ($)";
            players.sort((a, b) => b.cash - a.cash);
        } 
        else if (isStock) {
            const info = getDisplayInfo(sortKey);
            header.innerText = `${info.e} ${info.n}`;
            players.sort((a, b) => {
                const valA = (a.stocks && a.stocks[sortKey]) || 0; 
                const valB = (b.stocks && b.stocks[sortKey]) || 0;
                return valB - valA;
            });
        }

        lbBody.innerHTML = "";
        let rank = 1;
        
        players.slice(0, 50).forEach((p) => {
            const isMe = currentUser && (p.id === currentUser.uid);
            let scoreDisplay = "";
            
            if(criteria === 'net_worth') scoreDisplay = "$" + Math.floor(p.net_worth).toLocaleString();
            else if(criteria === 'cash') scoreDisplay = "$" + Math.floor(p.cash).toLocaleString();
            else {
                const qty = (p.stocks && p.stocks[sortKey]) || 0;
                scoreDisplay = qty.toLocaleString();
            }

            const row = document.createElement('tr');
            if(isMe) row.classList.add('is-me');
            
            row.innerHTML = `
                <td style="width:15%">#${rank++}</td>
                <td>${p.name} ${isMe ? "(You)" : ""}</td>
                <td style="text-align:right;">${scoreDisplay}</td>
            `;
            lbBody.appendChild(row);
        });

    } catch (e) {
        console.error("Leaderboard Error:", e);
        lbBody.innerHTML = `<tr><td colspan='3' style='text-align:center;'>Error loading data.</td></tr>`;
    }
}

async function loadHistory() {
    const listEl = document.getElementById('activity-list');
    const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(12));
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = "<li style='padding:10px; text-align:center;'>No activity today.</li>";
            return;
        }

        const docs = snapshot.docs.map(d => d.data());
        listEl.innerHTML = "";
        docs.forEach(data => {
            const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
            const color = data.message.includes("UP") ? "var(--green)" : (data.message.includes("DOWN") ? "var(--red)" : "var(--accent)");
            
            let displayMsg = data.message;
            stocks.forEach(s => {
                if(displayMsg.includes(s)) {
                    const info = getDisplayInfo(s);
                    displayMsg = displayMsg.replace(s, `${info.e} ${info.n}`);
                }
            });

            const li = document.createElement('li');
            li.style.padding = "8px 0";
            li.style.borderBottom = "1px solid var(--border)";
            li.innerHTML = `<span style="color:var(--text-muted); margin-right:10px; font-size:0.8em;">${time}</span><span style="color:${color}; font-weight:bold;">${displayMsg}</span>`;
            listEl.appendChild(li);
        });

        const chartData = [...docs].reverse();
        if(chartData.length > 0 && chartData[0].snapshot) {
            lastChartData = chartData;
            updateChart(chartData);
        }
    });
}

function updateChart(data) {
    const ctx = document.getElementById('marketChart').getContext('2d');
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();

    const labels = data.map(d => d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit'}) : "");
    const datasets = stocks.map(stock => ({
        label: getDisplayInfo(stock).n, 
        data: data.map(d => d.snapshot[stock] || 100),
        borderColor: getStockColor(stock),
        borderWidth: 2,
        pointRadius: 2,
        fill: false,
        tension: 0.1
    }));

    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 200, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

function getStockColor(stock) {
    const colors = { 'Gold': '#ffd700', 'Silver': '#c0c0c0', 'Oil': '#888888', 'Bonds': '#4caf50', 'Industrial': '#ff9800', 'Grain': '#e91e63' };
    return colors[stock] || '#fff';
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js') 
            .then(reg => console.log('✅ PWA Ready'))
            .catch(err => console.log('❌ PWA Error:', err));
    });
}

fetchLeaderboard('net_worth');
loadHistory();