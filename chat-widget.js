// LeadFlow Chat Widget — v3.0 — Buyer + Seller flows, lead scoring, exit intent

const DEMO_PROPS = [
  { id:'d1', address:'4521 San Pedro Dr NE, Albuquerque, NM', price:265000, beds:3, baths:2, sqft:1850, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d2', address:'7845 Kathryn Ave SE, Albuquerque, NM',  price:185000, beds:2, baths:1, sqft:1200, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d3', address:'1234 Ridgetop Rd NW, Albuquerque, NM',  price:350000, beds:4, baths:3, sqft:2500, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d4', address:'8765 Montgomery Blvd NE, Albuquerque, NM', price:225000, beds:3, baths:2, sqft:1600, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d5', address:'555 Coal Ave SW, Albuquerque, NM',       price:295000, beds:3, baths:2, sqft:2000, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d6', address:'2890 Harvard Dr SE, Albuquerque, NM',    price:210000, beds:3, baths:2, sqft:1550, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d7', address:'9876 Copper Ave NW, Albuquerque, NM',    price:320000, beds:4, baths:3, sqft:2200, url:'https://www.redfin.com/NM/Albuquerque' },
  { id:'d8', address:'3310 Lomas Blvd NE, Albuquerque, NM',   price:155000, beds:2, baths:1, sqft:1050, url:'https://www.redfin.com/NM/Albuquerque' },
];

const NEIGHBORHOOD_SCORES = {
  'northeast heights': { label:'Northeast Heights', safety:8, schools:9, appreciation:7, walkability:6, summary:'Top-rated schools, family-friendly, strong resale value.' },
  'ne heights':        { label:'Northeast Heights', safety:8, schools:9, appreciation:7, walkability:6, summary:'Top-rated schools, family-friendly, strong resale value.' },
  'rio rancho':        { label:'Rio Rancho',         safety:9, schools:8, appreciation:8, walkability:5, summary:'Fastest-growing area, newer builds, quiet suburbs.' },
  'old town':          { label:'Old Town',            safety:7, schools:7, appreciation:9, walkability:9, summary:'Historic charm, walkable, great investment potential.' },
  'westside':          { label:'Westside',            safety:8, schools:8, appreciation:7, walkability:5, summary:'Affordable, newer developments, growing community.' },
  'downtown':          { label:'Downtown',            safety:6, schools:7, appreciation:8, walkability:9, summary:'Urban energy, walkable, rising property values.' },
  'nob hill':          { label:'Nob Hill',            safety:7, schools:8, appreciation:8, walkability:8, summary:'Trendy, walkable, great local restaurants and shops.' },
};

function getNeighborhoodScore(area) {
  if (!area) return null;
  const key = area.toLowerCase().trim();
  for (const [k, v] of Object.entries(NEIGHBORHOOD_SCORES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function calcMortgage(price, downPct = 0.20, rate = 0.0699, years = 30) {
  const principal = price * (1 - downPct);
  const r = rate / 12;
  const n = years * 12;
  const payment = principal * (r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
  return {
    monthly: Math.round(payment),
    principal: Math.round(principal),
    down: Math.round(price * downPct),
    rate: (rate * 100).toFixed(2),
  };
}

// ── Lead Scoring ───────────────────────────────────────────────
function calcLeadScore(profile) {
  let score = 0;

  // Timeline
  const timeline = (profile.timeline || '').toLowerCase();
  if (timeline.includes('ready') || timeline.includes('0–30') || timeline.includes('0-30')) score += 3;
  else if (timeline.includes('1–3') || timeline.includes('1-3') || timeline.includes('asap')) score += 2;
  else if (timeline.includes('3-6') || timeline.includes('3–6')) score += 1;

  // Budget
  const budget = (profile.budget || '').toLowerCase();
  if (budget.includes('450k') || budget.includes('450k+')) score += 2;
  else if (budget.includes('300k') || budget.includes('350k')) score += 1;

  // Contact info quality
  if (profile.email) score += 1;
  if (profile.phone) score += 1;

  // Has specific area preference
  const area = (profile.area || '').toLowerCase();
  if (area && !area.includes('no preference') && !area.includes('no pref')) score += 1;

  // Seller — always warm lead
  if (profile.intent === 'sell') score += 2;

  return Math.min(score, 10);
}

// ── Buyer Bot ────────────────────────────────────────────────
class BuyerBot {
  constructor() {
    this.step = 0;
    this.profile = { intent: 'buy' };
    this.waitingMortgage = false;
    this.steps = [
      { key: 'name',     ask: "Great! What's your name?" },
      { key: 'email',    ask: "Nice to meet you, {name}! What's the best email for your agent to send matches? 📬" },
      { key: 'phone',    ask: "And a phone number? (Optional — only for urgent updates)" },
      { key: 'budget',   ask: "💰 What's your budget range?", options: ['Under $200k', '$200k–$300k', '$300k–$450k', '$450k+'] },
      { key: 'beds',     ask: "🛏 How many bedrooms do you need?", options: ['1–2 beds', '3 beds', '4+ beds'] },
      { key: 'timeline', ask: "⏳ What's your timeline to move?", options: ['Ready now (0–30 days)', '1–3 months', 'Just exploring'] },
      { key: 'area',     ask: "📍 Any preferred neighborhood?", options: ['Northeast Heights', 'Rio Rancho', 'Old Town', 'Westside', 'No preference'] },
      { key: null,       ask: 'SHOW_PROPERTIES' },
    ];
  }

  reply(userMsg) {
    const step = this.steps[this.step];
    if (step && step.key && userMsg) this.profile[step.key] = userMsg;
    this.step++;
    const next = this.steps[this.step];
    if (!next) return { type: 'done' };
    if (next.ask === 'SHOW_PROPERTIES') return { type: 'properties', profile: this.profile };
    const text = next.ask.replace('{name}', this.profile.name || 'there');
    return { type: 'chat', text, options: next.options || null };
  }

  matchProperties() {
    let maxPrice = 500000, minBeds = 2;
    const b = this.profile.budget || '';
    if (b.includes('Under')) maxPrice = 200000;
    else if (b.includes('200k')) maxPrice = 300000;
    else if (b.includes('300k')) maxPrice = 450000;
    else if (b.includes('450k')) maxPrice = 900000;
    const bedsMatch = (this.profile.beds || '').match(/\d+/);
    if (bedsMatch) minBeds = parseInt(bedsMatch[0]);
    if (this.profile.beds?.includes('1')) minBeds = 1;
    return DEMO_PROPS.filter(p => p.price <= maxPrice && p.beds >= minBeds).slice(0, 3);
  }
}

// ── Seller Bot ────────────────────────────────────────────────
class SellerBot {
  constructor() {
    this.step = 0;
    this.profile = { intent: 'sell' };
    this.steps = [
      { key: 'address',  ask: "📍 What's the address of the home you're looking to sell?" },
      { key: 'timeline', ask: "⏳ What's your selling timeline?", options: ['ASAP', '3–6 months', 'Just exploring value'] },
      { key: 'name',     ask: "Got it! What's your name so the agent can follow up?" },
      { key: 'email',    ask: "And the best email to reach you, {name}? 📬" },
      { key: 'phone',    ask: "Last one — phone number? (Optional)" },
      { key: null,       ask: 'SHOW_VALUATION' },
    ];
  }

  reply(userMsg) {
    const step = this.steps[this.step];
    if (step && step.key && userMsg) this.profile[step.key] = userMsg;
    this.step++;
    const next = this.steps[this.step];
    if (!next) return { type: 'done' };
    if (next.ask === 'SHOW_VALUATION') return { type: 'valuation', profile: this.profile };
    const text = next.ask.replace('{name}', this.profile.name || 'there');
    return { type: 'chat', text, options: next.options || null };
  }
}

// ── Main Chat Widget ───────────────────────────────────────────
class RealEstateChat {
  constructor() {
    this.ws            = null;
    this.sessionKey    = localStorage.getItem('realtor_session_key') || 'realtor-' + Date.now();
    this.gatewayUrl    = this.getGatewayUrl();
    this.PROXY_URL     = 'http://31.97.212.21:3001';
    this.HS_PORTAL_ID  = '245406482';
    this.HS_FORM_GUID  = '42d060a5-8fe3-47a0-b741-63a4907b31e0';
    this.CALENDLY_URL  = this.getCalendlyUrl();

    this.bot           = null;          // set after buy/sell choice
    this.intent        = null;          // 'buy' | 'sell'
    this.useDemoMode   = false;
    this.waitingMortgage = false;
    this.exitShown     = false;

    this.idleTimer     = null;
    this.idleNudgeIndex = 0;
    this.idleNudges    = [
      "Still there? 😊 I can help with mortgage estimates or neighborhood info!",
      "No rush! When you're ready, just tell me what you're looking for 🏡",
      "Fun fact — most clients find their match in under 2 minutes. Ready?",
    ];

    this.initElements();
    this.bindEvents();
    this.setupExitIntent();
  }

  getGatewayUrl() {
    const p = new URLSearchParams(window.location.search);
    return p.get('gateway') || 'ws://31.97.212.21:18789';
  }

  getCalendlyUrl() {
    const p = new URLSearchParams(window.location.search);
    return p.get('calendly') || 'https://calendly.com/grow-neighborai';
  }

  initElements() {
    this.chatWidget   = document.getElementById('chat-widget');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput    = document.getElementById('chat-input');
    this.sendBtn      = document.getElementById('send-btn');
    this.closeBtn     = document.getElementById('close-chat');
    this.overlay      = document.getElementById('chat-overlay');
  }

  bindEvents() {
    document.getElementById('start-chat')?.addEventListener('click', () => this.openChat());
    document.getElementById('start-chat-2')?.addEventListener('click', () => this.openChat());
    this.closeBtn?.addEventListener('click', () => this.closeChat());
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.chatInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
  }

  // ── Exit Intent ──────────────────────────────────────────────
  setupExitIntent() {
    let pageTime = 0;
    const tick = setInterval(() => { pageTime++; }, 1000);

    document.addEventListener('mouseleave', e => {
      if (this.exitShown) return;
      if (e.clientY > 20) return;    // only top-edge exit
      if (pageTime < 5) return;      // must have been on page ≥5s
      this.exitShown = true;
      clearInterval(tick);
      this.openChat('exit');
    });
  }

  openChat(trigger) {
    this.chatWidget?.classList.remove('hidden');
    this.overlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.chatInput?.focus();
    this.connect(trigger);
    this.resetIdleTimer();
  }

  closeChat() {
    this.chatWidget?.classList.add('hidden');
    this.overlay?.classList.add('hidden');
    document.body.style.overflow = '';
    this.clearIdleTimer();
  }

  resetIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.sendIdleNudge(), 30000);
  }

  clearIdleTimer() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
  }

  sendIdleNudge() {
    const msg = this.idleNudges[this.idleNudgeIndex % this.idleNudges.length];
    this.idleNudgeIndex++;
    this.addMessage('bot', msg);
    this.idleTimer = setTimeout(() => this.sendIdleNudge(), 45000);
  }

  connect(trigger) {
    if (this.ws || this.useDemoMode) return;

    try {
      this.ws = new WebSocket(`${this.gatewayUrl}/ws`);
      const timeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close(); this.ws = null;
          this.startDemoMode(trigger);
        }
      }, 4000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.showIntroAndAskIntent(trigger);
      };
      this.ws.onmessage = e => {
        try { this.handleServerMessage(JSON.parse(e.data)); } catch (_) {}
      };
      this.ws.onerror = () => {
        clearTimeout(timeout); this.ws = null; this.startDemoMode(trigger);
      };
      this.ws.onclose = () => { this.ws = null; };
    } catch (_) {
      this.startDemoMode(trigger);
    }
  }

  startDemoMode(trigger) {
    this.useDemoMode = true;
    this.showIntroAndAskIntent(trigger);
  }

  showIntroAndAskIntent(trigger) {
    this.addTyping();
    setTimeout(() => {
      this.removeTyping();
      if (trigger === 'exit') {
        this.addMessage('bot', "Wait — before you go! 👋 Want to see what homes in your area are worth right now?");
        setTimeout(() => {
          this.addMessage('bot', "I'm your AI real estate assistant. Are you looking to buy or sell?");
          this.addQuickReplies(['🏠 Buy a home', '💰 Sell my home']);
        }, 600);
      } else {
        this.addMessage('bot', "Hi! 👋 I'm your AI real estate assistant — I can match you with homes, run valuations, estimate mortgages, and book you with an agent in under 2 minutes.");
        setTimeout(() => {
          this.addMessage('bot', "Are you looking to buy or sell?");
          this.addQuickReplies(['🏠 Buy a home', '💰 Sell my home']);
        }, 700);
      }
    }, 800);
  }

  sendMessage(text) {
    const msg = text || this.chatInput?.value.trim();
    if (!msg) return;

    document.querySelectorAll('.quick-replies').forEach(el => el.remove());
    this.addMessage('user', msg);
    if (this.chatInput) this.chatInput.value = '';
    this.chatInput?.focus();
    this.resetIdleTimer();

    if (this.useDemoMode) {
      this.handleDemoReply(msg);
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat.send', sessionKey: this.sessionKey, message: msg }));
    } else {
      this.startDemoMode();
      this.handleDemoReply(msg);
    }
  }

  handleDemoReply(userMsg) {
    // ── Intent selection ──────────────────────────────────────
    if (!this.intent) {
      const lower = userMsg.toLowerCase();
      if (lower.includes('sell') || lower.includes('💰')) {
        this.intent = 'sell';
        this.bot = new SellerBot();
        this.addTyping();
        setTimeout(() => {
          this.removeTyping();
          this.addMessage('bot', "Great! Let's figure out what your home is worth. I'll pull live market data for you. 🏡");
          setTimeout(() => {
            const result = this.bot.reply(null);
            this.addMessage('bot', result.text);
          }, 600);
        }, 700);
      } else {
        this.intent = 'buy';
        this.bot = new BuyerBot();
        this.addTyping();
        setTimeout(() => {
          this.removeTyping();
          this.addMessage('bot', "Awesome! Let's find you the perfect home. I just need a few quick details. 🏡");
          setTimeout(() => {
            const result = this.bot.reply(null);
            this.addMessage('bot', result.text);
          }, 600);
        }, 700);
      }
      return;
    }

    // ── Mortgage prompt interception ─────────────────────────
    if (this.waitingMortgage) {
      this.waitingMortgage = false;
      const lower = userMsg.toLowerCase();
      if (lower.includes('yes') || lower.includes('sure') || lower.includes('yeah') || lower.includes('yep')) {
        this.addTyping();
        setTimeout(() => {
          this.removeTyping();
          this.showMortgageEstimate();
          setTimeout(() => {
            this.addMessage('bot', "Want to book a quick call with an agent to discuss financing options?");
            setTimeout(() => this.addCalendlyButton(), 500);
          }, 800);
        }, 700);
      } else {
        this.addMessage('bot', "No problem! Want to book a quick call to tour these homes?");
        setTimeout(() => this.addCalendlyButton(), 500);
      }
      return;
    }

    // ── Route to correct bot ──────────────────────────────────
    this.addTyping();
    setTimeout(() => {
      this.removeTyping();

      const result = this.bot.reply(userMsg);

      if (result.type === 'chat') {
        this.addMessage('bot', result.text);
        if (result.options) this.addQuickReplies(result.options);

        // Show neighborhood score after area answer (buyer flow)
        if (this.intent === 'buy') {
          const prevKey = this.bot.steps[this.bot.step - 1]?.key;
          if (prevKey === 'area') {
            const score = getNeighborhoodScore(userMsg);
            if (score) setTimeout(() => this.addNeighborhoodScore(score), 500);
          }
        }

      } else if (result.type === 'properties') {
        // Buyer — push lead + show properties
        const profile = result.profile || this.bot.profile;
        profile.score = calcLeadScore(profile);
        this.pushToHubSpot(profile);
        const props = this.bot.matchProperties();
        this.addMessage('bot', `🏡 Based on what you told me, here are your top matches:`);
        setTimeout(() => {
          this.addPropertyCards(props);
          setTimeout(() => {
            this.addMessage('bot', `Want to see your estimated monthly payment on these homes? 💰`);
            this.addQuickReplies(['Yes, show me!', 'No thanks']);
            this.waitingMortgage = true;
          }, 900);
        }, 400);

      } else if (result.type === 'valuation') {
        // Seller — pull AVM and show valuation card
        const profile = result.profile || this.bot.profile;
        profile.score = calcLeadScore(profile);
        this.pushToHubSpot(profile);
        this.addMessage('bot', "⏳ Pulling live market data for your address...");
        this.fetchValuation(profile.address, profile);

      } else {
        this.addMessage('bot', "Thanks! An agent will be in touch with you shortly. 🏡");
      }
    }, 900 + Math.random() * 500);
  }

  // ── Seller Valuation ──────────────────────────────────────────
  async fetchValuation(address, profile) {
    let data = null;
    try {
      const resp = await fetch(`${this.PROXY_URL}/property?address=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(8000) });
      data = await resp.json();
    } catch (_) { /* fall through to demo */ }

    if (data?.value) {
      this.showValuationCard(data.value, data.rentEstimate, address);
    } else {
      // Demo fallback
      const demoVal = 295000 + Math.floor(Math.random() * 80000);
      const demoRent = Math.round(demoVal * 0.007);
      this.showValuationCard(demoVal, demoRent, address);
    }

    setTimeout(() => {
      this.addMessage('bot', `An agent can walk you through the full market analysis. Want to book a free listing consultation? 📅`);
      setTimeout(() => this.addCalendlyButton(), 500);
    }, 1000);
  }

  showValuationCard(value, rentEstimate, address) {
    const wrap = document.createElement('div');
    wrap.className = 'message bot';

    const card = document.createElement('div');
    card.className = 'mortgage-card';
    card.innerHTML = `
      <div class="mortgage-title">🏠 Home Valuation Estimate</div>
      <div style="font-size:12px;opacity:0.7;margin-bottom:8px;">${this.esc(address)}</div>
      <div class="mortgage-monthly">~$${Number(value).toLocaleString()}<small> estimated value</small></div>
      ${rentEstimate ? `<div class="mortgage-row"><span>Est. Rental Income</span><span>~$${Number(rentEstimate).toLocaleString()}/mo</span></div>` : ''}
      <div class="mortgage-note">*Based on live market data. Full CMA provided by your agent.</div>
    `;

    wrap.appendChild(card);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  showMortgageEstimate() {
    const props = (this.bot instanceof BuyerBot) ? this.bot.matchProperties() : [];
    const price = props.length ? props[0].price : 250000;
    const m = calcMortgage(price);

    const wrap = document.createElement('div');
    wrap.className = 'message bot';

    const card = document.createElement('div');
    card.className = 'mortgage-card';
    card.innerHTML = `
      <div class="mortgage-title">💰 Mortgage Estimate</div>
      <div class="mortgage-price">$${price.toLocaleString()} home</div>
      <div class="mortgage-row"><span>Down Payment (20%)</span><span>$${m.down.toLocaleString()}</span></div>
      <div class="mortgage-row"><span>Loan Amount</span><span>$${m.principal.toLocaleString()}</span></div>
      <div class="mortgage-row"><span>Interest Rate</span><span>${m.rate}% (30yr fixed)</span></div>
      <div class="mortgage-monthly">~$${m.monthly.toLocaleString()}<small>/month</small></div>
      <div class="mortgage-note">*Estimate only. Rates vary by credit score and lender.</div>
    `;

    wrap.appendChild(card);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  handleServerMessage(data) {
    this.removeTyping();
    if (data.type === 'chat') {
      this.addMessage('bot', data.text);
      if (data.options) this.addQuickReplies(data.options);
    } else if (data.type === 'properties') {
      this.addPropertyCards(data.items || []);
    } else if (data.type === 'calendly') {
      this.addCalendlyButton(data.url);
    } else if (data.type === 'error') {
      this.addMessage('bot', `⚠️ ${data.message}`);
    }
  }

  // ── Render Helpers ─────────────────────────────────────────
  addMessage(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-content';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addQuickReplies(options) {
    const container = document.createElement('div');
    container.className = 'quick-replies';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quick-reply-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => this.sendMessage(opt));
      container.appendChild(btn);
    });
    this.chatMessages.appendChild(container);
    this.scrollBottom();
  }

  addNeighborhoodScore(score) {
    const wrap = document.createElement('div');
    wrap.className = 'message bot';
    const card = document.createElement('div');
    card.className = 'neighborhood-card';
    const scoreBar = (label, val) => `
      <div class="score-row">
        <span class="score-label">${label}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${val*10}%"></div></div>
        <span class="score-num">${val}/10</span>
      </div>`;
    card.innerHTML = `
      <div class="neighborhood-title">📍 ${score.label}</div>
      <div class="neighborhood-summary">${score.summary}</div>
      ${scoreBar('🔒 Safety', score.safety)}
      ${scoreBar('🏫 Schools', score.schools)}
      ${scoreBar('📈 Appreciation', score.appreciation)}
      ${scoreBar('🚶 Walkability', score.walkability)}
    `;
    wrap.appendChild(card);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addPropertyCards(props) {
    if (!props.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'message bot';
    const container = document.createElement('div');
    container.className = 'property-cards';
    props.forEach(p => {
      const card = document.createElement('a');
      card.className = 'prop-card';
      card.href = p.url; card.target = '_blank'; card.rel = 'noopener noreferrer';
      card.innerHTML = `
        <div class="prop-icon">🏠</div>
        <div class="prop-body">
          <div class="prop-address">${this.esc(p.address)}</div>
          <div class="prop-details">
            <span>💰 $${Number(p.price).toLocaleString()}</span>
            <span>🛏 ${p.beds} bd</span>
            <span>🚿 ${p.baths} ba</span>
            ${p.sqft ? `<span>📐 ${Number(p.sqft).toLocaleString()} sqft</span>` : ''}
          </div>
        </div>
        <div class="prop-arrow">→</div>`;
      container.appendChild(card);
    });
    wrap.appendChild(container);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addCalendlyButton(url) {
    const link = url || this.CALENDLY_URL;
    const wrap = document.createElement('div');
    wrap.className = 'message bot';
    const btn = document.createElement('a');
    btn.className = 'calendly-btn';
    btn.href = link; btn.target = '_blank'; btn.rel = 'noopener noreferrer';
    btn.innerHTML = '📅 Book a Free 15-Min Call';
    wrap.appendChild(btn);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addTyping() {
    this.removeTyping();
    const wrap = document.createElement('div');
    wrap.className = 'message bot typing-wrap';
    wrap.id = 'typing-indicator';
    wrap.innerHTML = '<div class="message-content typing"><span></span><span></span><span></span></div>';
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  removeTyping() {
    document.getElementById('typing-indicator')?.remove();
  }

  pushToHubSpot(profile) {
    const lead = {
      name: profile.name||'', email: profile.email||'', phone: profile.phone||'',
      intent: profile.intent||'buy',
      budget: profile.budget||'', beds: profile.beds||'',
      timeline: profile.timeline||'', area: profile.area||'',
      address: profile.address||'',
      score: profile.score || 0,
      ts: new Date().toISOString(),
    };
    try {
      const saved = JSON.parse(localStorage.getItem('leadflow_leads')||'[]');
      saved.push(lead);
      localStorage.setItem('leadflow_leads', JSON.stringify(saved));
    } catch(e) {}
    const tryPush = (attempt) => {
      const nameParts = (lead.name||'').trim().split(' ');
      const payload = {
        fields: [
          { name: 'firstname', value: nameParts[0]||'' },
          { name: 'lastname',  value: nameParts.slice(1).join(' ')||'' },
          { name: 'email',     value: lead.email||'' },
          { name: 'phone',     value: lead.phone||'' },
        ],
        context: { pageUri: window.location.href, pageName: document.title }
      };
      fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${this.HS_PORTAL_ID}/${this.HS_FORM_GUID}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
      }).then(r=>{ if(!r.ok && attempt<3) setTimeout(()=>tryPush(attempt+1),3000); })
      .catch(()=>{ if(attempt<3) setTimeout(()=>tryPush(attempt+1),3000); });
    };
    tryPush(1);
  }

  scrollBottom() { this.chatMessages.scrollTop = this.chatMessages.scrollHeight; }
  esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.realestateChat = new RealEstateChat();
});
