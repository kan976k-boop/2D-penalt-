// --- Mega Market Edition ---
const AudioEngine = {
    ctx: null,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    play(f, t='sine', d=0.1, v=0.1) {
        this.init(); if(!this.ctx) return;
        const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
        o.type=t; o.frequency.setValueAtTime(f, this.ctx.currentTime);
        g.gain.setValueAtTime(v, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0, this.ctx.currentTime+d);
        o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+d);
    },
    kick() { this.play(160, 'sine', 0.15, 0.2); },
    whistle() { this.play(850, 'triangle', 0.4, 0.1); },
    goal() { 
        // Temel Gol Sesi
        this.play(450, 'square', 0.6, 0.15); 
        // Alkış Simülasyonu (Beyaz Gürültü)
        this.applause();
    },
    applause() {
        this.init(); if(!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 1000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
        noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        noise.start(); noise.stop(this.ctx.currentTime + 1.5);
    },
    miss() { this.play(120, 'sawtooth', 0.5, 0.1); }
};

const state = {
    name: 'Efsane', score: 0, gold: 0, lives: 5, maxLives: 5,
    isShooting: false, isGameOver: false,
    power: 0, isCharging: false,
    ballScale: 1.0, keeperFactor: 1.0,
    goldMultiplier: 1, fireShotActive: false,
    purchased: {}
};

const els = {
    app: document.getElementById('app-root'),
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    shop: document.getElementById('shop-screen'),
    over: document.getElementById('game-over-screen'),
    lb: document.getElementById('leaderboard-screen'),
    stadium: document.getElementById('stadium'),
    ball: document.getElementById('ball'),
    keeper: document.getElementById('goalkeeper'),
    aim: document.getElementById('aim-guide'),
    score: document.getElementById('current-score'),
    gold: document.getElementById('gold-count'),
    shopGold: document.getElementById('shop-gold-count'),
    lives: document.getElementById('lives'),
    pBar: document.getElementById('power-fill'),
    pCont: document.getElementById('power-container'),
    confetti: document.getElementById('confetti-container')
};

// Initialize
document.getElementById('start-btn').onclick = () => {
    state.name = document.getElementById('player-name').value || 'Efsane';
    els.start.classList.add('hidden');
    els.game.classList.remove('hidden');
    AudioEngine.whistle();
    
    // Driperx Special Cheat
    if (state.name.toLowerCase() === 'driperx') {
        state.gold = 999999;
        state.lives = 999999;
        state.score = 0;
        showFeedback('Hile modu aktif', '#ffdb15');
    }

    // Ryzo Super Cheat
    if (state.name.toLowerCase() === 'ryzo') {
        state.gold = 999999;
        state.lives = 999999;
        state.score = 0;
        state.ballScale = 1.6;
        state.keeperFactor = 0.6;
        state.goldMultiplier = 2;
        state.fireShotActive = true;
        state.purchased = { extraLife: true, bigBall: true, slowKeeper: true, goldBall: true, fireShot: true };
        els.ball.style.fontSize = '45px';
        showFeedback('RYZO MODU: TÜM GÜÇLER AKTİF! ⚡', '#00ff88');
    }

    updateUI();
};

document.getElementById('leaderboard-btn').onclick = showLB;
document.getElementById('back-to-menu').onclick = () => { els.lb.classList.add('hidden'); els.start.classList.remove('hidden'); };
document.getElementById('open-shop-btn').onclick = () => { els.shop.classList.remove('hidden'); els.shopGold.innerText = state.gold; };
document.getElementById('close-shop-btn').onclick = () => els.shop.classList.add('hidden');
document.getElementById('restart-btn').onclick = restart;
document.getElementById('main-menu-btn').onclick = () => location.reload();

document.getElementById('fs-btn').onclick = () => {
    if (!document.fullscreenElement) els.app.requestFullscreen().catch(e => console.log(e));
    else document.exitFullscreen();
};

function restart() {
    state.score = 0; state.lives = state.maxLives; state.isGameOver = false;
    els.over.classList.add('hidden');
    els.game.classList.remove('hidden');
    updateUI();
    reset();
}

function updateUI() {
    els.score.innerText = state.score;
    els.gold.innerText = state.gold;
    els.lives.innerText = state.lives;
}

// Controls
function startCharge(e) {
    if (state.isShooting || state.isGameOver || !els.shop.classList.contains('hidden')) return;
    state.isCharging = true;
    state.power = 0;
    els.pCont.classList.remove('hidden');
    updateAim(e);
}

function endCharge(e) {
    if (!state.isCharging) return;
    state.isCharging = false;
    els.pCont.classList.add('hidden');
    shoot(e);
}

function updateAim(e) {
    const rect = els.stadium.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const bx = els.ball.offsetLeft + els.ball.offsetWidth/2;
    const by = els.ball.offsetTop + els.ball.offsetHeight/2;
    const angle = Math.atan2(cy - rect.top - by, cx - rect.left - bx);
    els.aim.style.opacity = '1';
    els.aim.style.transform = `translateX(-50%) rotate(${(angle*180/Math.PI)+90}deg)`;
}

setInterval(() => {
    if (state.isCharging) {
        state.power = Math.min(100, state.power + 2.5);
        els.pBar.style.height = `${state.power}%`;
    }
}, 30);

els.stadium.addEventListener('mousedown', startCharge);
els.stadium.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge(e); }, {passive: false});
window.addEventListener('mouseup', endCharge);
window.addEventListener('touchend', (e) => { if(state.isCharging) endCharge(e); });
els.stadium.addEventListener('mousemove', (e) => { if(state.isCharging) updateAim(e); });
els.stadium.addEventListener('touchmove', (e) => { if(state.isCharging) { e.preventDefault(); updateAim(e); } }, {passive: false});

function shoot(e) {
    state.isShooting = true;
    els.aim.style.opacity = '0';
    els.ball.classList.add('moving');
    AudioEngine.kick();

    const rect = els.stadium.getBoundingClientRect();
    const goal = document.querySelector('.goal-area').getBoundingClientRect();
    const gt = goal.top - rect.top;
    
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const tx = cx - rect.left;
    const ty = cy - rect.top;

    let baseDur = 0.55 - (state.power/100)*0.3;
    if (state.fireShotActive) baseDur *= 0.6; // Much faster

    els.ball.style.transition = `all ${baseDur}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    els.ball.style.bottom = `${rect.height - ty}px`;
    els.ball.style.left = `${tx}px`;
    els.ball.style.transform = `translateX(-50%) scale(${0.3 * state.ballScale})`;

    setTimeout(() => {
        const bp = (tx/rect.width)*100;
        const dist = Math.abs(bp - 50);
        
        // "Altın Orta" Kurtarma Olasılığı (Merkez: %55, Köşeler: %20)
        let saveProb = (0.55 - (dist/50)*0.35) * state.keeperFactor;
        
        if (state.fireShotActive) saveProb *= 0.6; // Alevli şut hala zor ama imkansız değil
        if (state.power > 85) saveProb *= 0.8;    // Çok güçlü şutlar kaleciyi zorlar

        const willSave = Math.random() < saveProb;
        let kx = 50;
        let jumpY = -20; // Varsayılan hafif zıplama
        
        // Top yüksekliğine göre zıplama ayarı
        if (ty < gt + 60) jumpY = -70; // Üst köşelere daha yüksek zıplama
        else if (ty < gt + 120) jumpY = -40;

        if (willSave) {
            kx = bp; // Topun olduğu yere atla
            els.keeper.classList.add(bp < 50 ? 'dive-left' : 'dive-right');
            els.keeper.style.transform = `translateX(-50%) translateY(${jumpY}px) rotate(${bp < 50 ? -70 : 70}deg)`;
        } else {
            // Kurtaramasa bile %80 ihtimalle bir tarafa atlasın (görsel tatmin için)
            if (Math.random() > 0.2) {
                // Ya yanlış tarafa atlar ya da geç kalır
                const wrongSide = Math.random() > 0.5;
                kx = wrongSide ? (bp < 50 ? 80 : 20) : (bp + (bp < 50 ? 15 : -15));
                els.keeper.classList.add(kx < 50 ? 'dive-left' : 'dive-right');
                els.keeper.style.transform = `translateX(-50%) translateY(${jumpY/2}px) rotate(${kx < 50 ? -45 : 45}deg)`;
            }
        }
        els.keeper.style.left = `${kx}%`;
        setTimeout(() => check(tx, ty, kx, jumpY), baseDur*1000 - 50);
    }, 100);
}

function check(bx, by, kx, jumpY) {
    const rect = els.stadium.getBoundingClientRect();
    const goal = document.querySelector('.goal-area').getBoundingClientRect();
    const gl = goal.left - rect.left; const gr = goal.right - rect.left;
    const gt = goal.top - rect.top; const gb = goal.bottom - rect.top;

    const inGoal = (bx >= gl && bx <= gr && by >= gt && by <= gb);
    const bp = (bx/rect.width)*100;

    const keeperTop = gb - 100 + (jumpY || -25);
    const hDist = Math.abs(bp - kx);
    const vDist = Math.abs(by - (keeperTop + 30));

    // Kurtarma alanı dengelendi (Ne çok geniş ne çok dar: 5.0)
    const saved = hDist < (5.0 * state.ballScale) && vDist < 55;

    if (inGoal && !saved) {
        state.score += 10; 
        state.gold += 5 * state.goldMultiplier;
        showFeedback(`GOL! +${5 * state.goldMultiplier} 💰`, '#00ff88');
        AudioEngine.goal();
        createConfetti();
        
        // Ekran Sarsıntısı
        els.app.classList.add('shake');
        setTimeout(() => els.app.classList.remove('shake'), 400);
    } else {
        state.lives--;
        showFeedback(saved ? 'KURTARILDI! 🧤' : 'DIŞARI! ❌', '#ff3e3e');
        AudioEngine.miss();
    }

    updateUI();
    if (state.lives <= 0) setTimeout(endGame, 1000);
    else setTimeout(reset, 1500);
}

function endGame() {
    state.isGameOver = true;
    document.getElementById('final-score').innerText = state.score;
    els.game.classList.add('hidden');
    els.over.classList.remove('hidden');
    saveScore(state.name, state.score);
}

function showFeedback(t, c) {
    const f = document.createElement('div');
    f.innerText = t; f.className = 'fade-up'; f.style.color = c;
    f.style.left = '50%'; f.style.top = '40%';
    els.stadium.appendChild(f);
    setTimeout(() => f.remove(), 1000);
}

function reset() {
    els.ball.classList.remove('moving');
    els.ball.style.transition = 'none';
    els.ball.style.bottom = '80px';
    els.ball.style.left = '50%';
    els.ball.style.transform = `translateX(-50%) scale(${state.ballScale})`;
    els.keeper.style.left = '50%';
    els.keeper.style.transform = 'translateX(-50%)';
    els.keeper.classList.remove('dive-left', 'dive-right');
    els.ball.offsetHeight;
    state.isShooting = false;
}

function createConfetti() {
    for (let i=0; i<40; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random()*100+'%';
        c.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 50%)`;
        c.style.animationDuration = (Math.random()*2+1.5)+'s';
        els.confetti.appendChild(c);
        setTimeout(() => c.remove(), 3000);
    }
}

window.buyItem = (i) => {
    const prices = { extraLife: 50, bigBall: 100, slowKeeper: 150, goldBall: 250, fireShot: 400 };
    let p = prices[i];
    const btn = event.currentTarget.querySelector('.buy-action-btn');

    if (state.gold >= p) {
        if (i !== 'extraLife' && state.purchased[i]) {
            alert("Bu özellik zaten aktif!"); return;
        }

        state.gold -= p;
        if (i === 'extraLife') {
            state.lives++; showFeedback('+1 CAN! 💖', '#ffdb15');
        } else {
            state.purchased[i] = true;
            if (i === 'bigBall') { state.ballScale = 1.6; els.ball.style.fontSize = '45px'; }
            if (i === 'slowKeeper') { state.keeperFactor = 0.6; }
            if (i === 'goldBall') { state.goldMultiplier = 2; showFeedback('ALTIN ÇARPAN X2! 💰', '#ffdb15'); }
            if (i === 'fireShot') { state.fireShotActive = true; showFeedback('ALEVLİ ŞUT AKTİF! 🔥', '#ffdb15'); }
            
            btn.innerText = "ALINDI";
            btn.style.background = "#333";
            btn.style.color = "#777";
        }
        updateUI(); els.shopGold.innerText = state.gold; AudioEngine.whistle();
    } else {
        alert("Yetersiz altın! Biraz daha gol atmalısın. ⚽");
    }
};

function saveScore(n, s) {
    let sc = JSON.parse(localStorage.getItem('penaltyScores') || '[]');
    sc.push({ name: n, score: s });
    sc.sort((a,b) => b.score - a.score);
    localStorage.setItem('penaltyScores', JSON.stringify(sc.slice(0,5)));
}

function showLB() {
    const sc = JSON.parse(localStorage.getItem('penaltyScores') || '[]');
    document.getElementById('leaderboard-list').innerHTML = sc.length === 0 ? '<p style="opacity:0.5;">Skor yok!</p>' :
        sc.map((s,i) => `
            <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
                <span><strong style="color:var(--primary)">#${i+1}</strong> ${s.name}</span>
                <span style="font-weight:800; color:var(--gold);">${s.score}</span>
            </div>
        `).join('');
    els.start.classList.add('hidden');
    els.lb.classList.remove('hidden');
}
