// LeadFlow Chat Widget — v2.1 — Quick replies, mortgage calc, neighborhood scores, email capture

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

// Neighborhood scores (Safety/Schools/Appreciation/Walkability out of 10)
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

// ── Demo Bot Engine ────────────────────────────────────────────
class DemoBot {
  constructor() {
    this.step = 0;
    this.profile = {};
    this.awaitingMortgage = false;
    this.steps = [
      {
        key: null,
        ask: "Hi! 👋 I'm your AI home-finding assistant. I'll help match you with the perfect property in just 2 minutes. Ready to start?",
        options: ['Yes, let\'s go! 🏡', 'How does this work?'],
      },
      { key: 'name',     ask: "Great! What's your name?" },
      { key: 'email',    ask: "Nice! What's the best email to reach you, {name}? (So your agent can follow up with matches 📬)" },
      { key: 'phone',    ask: "And your phone number? (Optional — for urgent updates only)" },
      { key: 'budget',   ask: "💰 What's your budget range?", options: ['Under $200k', '$200k–$300k', '$300k–$450k', '$450k+'] },
      { key: 'beds',     ask: "🛏 How many bedrooms?", options: ['1–2 beds', '3 beds', '4+ beds'] },
      { key: 'timeline', ask: "⏳ What's your timeline?", options: ['Ready now (0–30 days)', '1–3 months', 'Just exploring'] },
      { key: 'area',     ask: "📍 Any preferred area?", options: ['Northeast Heights', 'Rio Rancho', 'Old Town', 'Westside', 'No preference'] },
      { key: null,       ask: 'SHOW_PROPERTIES' },
    ];
  }

  reply(userMsg) {
    const step = this.steps[this.step];
    if (step && step.key && userMsg) {
      this.profile[step.key] = userMsg;
    }

    this.step++;
    const next = this.steps[this.step];
    if (!next) return { type: 'done' };

    if (next.ask === 'SHOW_PROPERTIES') {
      return { type: 'properties', profile: this.profile };
    }

    let text = next.ask.replace('{name}', this.profile.name || 'there');
    return { type: 'chat', text, options: next.options || null };
  }

  matchProperties() {
    let maxPrice = 500000;
    let minBeds = 2;

    const budgetStr = (this.profile.budget || '').replace(/[^0-9k\-]/gi, '');
    const nums = budgetStr.split('-').map(s => {
      s = s.trim().replace(/k$/i, '000');
      return parseInt(s) || 0;
    }).filter(n => n > 0);
    if (nums.length) maxPrice = Math.max(...nums);

    // Handle "Under $200k" etc
    if (this.profile.budget?.includes('Under') || this.profile.budget?.includes('under')) maxPrice = 200000;
    if (this.profile.budget?.includes('200k–300k') || this.profile.budget?.includes('200k-300k')) maxPrice = 300000;
    if (this.profile.budget?.includes('300k–450k') || this.profile.budget?.includes('300k-450k')) maxPrice = 450000;
    if (this.profile.budget?.includes('450k+') || this.profile.budget?.includes('450k')) maxPrice = 900000;

    const bedsMatch = (this.profile.beds || '').match(/\d+/);
    if (bedsMatch) minBeds = parseInt(bedsMatch[0]);
    if (this.profile.beds?.includes('1')) minBeds = 1;

    return DEMO_PROPS.filter(p => p.price <= maxPrice && p.beds >= minBeds).slice(0, 3);
  }
}

// ── Main Chat Widget ───────────────────────────────────────────
class RealEstateChat {
  constructor() {
    this.ws              = null;
    this.sessionKey      = localStorage.getItem('realtor_session_key') || 'realtor-' + Date.now();
    this.gatewayUrl      = this.getGatewayUrl();
    this.demoBot         = new DemoBot();
    this.useDemoMode     = false;
    this.waitingMortgage = false;
    this.CALENDLY_URL    = this.getCalendlyUrl();
    this.idleTimer       = null;
    this.idleNudges      = [
      "Still there? 😊 I can also help with mortgage estimates or neighborhood info!",
      "No rush! When you're ready, just tell me what you're looking for 🏡",
      "Fun fact — most of my clients find their match in under 2 minutes. Ready to try?",
    ];
    this.idleNudgeIndex  = 0;

    this.initElements();
    this.bindEvents();
  }

  getGatewayUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gateway') || 'ws://31.97.212.21:18789';
  }

  getCalendlyUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('calendly') || 'https://calendly.com/grow-neighborai';
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
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
  }

  openChat() {
    this.chatWidget?.classList.remove('hidden');
    this.overlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.chatInput?.focus();
    this.connect();
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
    if (!this.useDemoMode && this.ws?.readyState !== WebSocket.OPEN) return;
    const msg = this.idleNudges[this.idleNudgeIndex % this.idleNudges.length];
    this.idleNudgeIndex++;
    this.addMessage('bot', msg);
    // Schedule another nudge in 45s if still idle
    this.idleTimer = setTimeout(() => this.sendIdleNudge(), 45000);
  }

  connect() {
    if (this.ws || this.useDemoMode) return;

    try {
      this.ws = new WebSocket(`${this.gatewayUrl}/ws`);

      const timeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          this.ws = null;
          this.startDemoMode();
        }
      }, 4000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.addTyping();
        setTimeout(() => {
          this.removeTyping();
          const firstStep = this.demoBot.steps[0];
          this.addMessage('bot', firstStep.ask);
          if (firstStep.options) this.addQuickReplies(firstStep.options);
        }, 800);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (_) {}
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        this.ws = null;
        this.startDemoMode();
      };

      this.ws.onclose = () => { this.ws = null; };

    } catch (_) {
      this.startDemoMode();
    }
  }

  startDemoMode() {
    this.useDemoMode = true;
    this.addTyping();
    setTimeout(() => {
      this.removeTyping();
      const firstStep = this.demoBot.steps[0];
      this.addMessage('bot', firstStep.ask);
      if (firstStep.options) this.addQuickReplies(firstStep.options);
      this.demoBot.step = 1;
    }, 600);
  }

  sendMessage(text) {
    const msg = text || this.chatInput?.value.trim();
    if (!msg) return;

    // Remove quick reply buttons
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
    }
  }

  handleDemoReply(userMsg) {
    // Mortgage calculator interception
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
        this.addMessage('bot', "No problem! Want to book a quick call with an agent to see these homes?");
        setTimeout(() => this.addCalendlyButton(), 500);
      }
      return;
    }

    this.addTyping();
    setTimeout(() => {
      this.removeTyping();
      const result = this.demoBot.reply(userMsg);

      if (result.type === 'chat') {
        this.addMessage('bot', result.text);
        if (result.options) this.addQuickReplies(result.options);

        // Show neighborhood score after area is answered
        const prevStep = this.demoBot.steps[this.demoBot.step - 1];
        if (prevStep?.key === 'area') {
          const score = getNeighborhoodScore(userMsg);
          if (score) {
            setTimeout(() => this.addNeighborhoodScore(score), 500);
          }
        }

      } else if (result.type === 'properties') {
        this.pushToHubSpot(result.profile || this.demoBot.profile);
        const props = this.demoBot.matchProperties();
        this.addMessage('bot', `🏡 Based on what you told me, here are your top matches:`);
        setTimeout(() => {
          this.addPropertyCards(props);
          // Offer mortgage calculator
          setTimeout(() => {
            this.addMessage('bot', `Want to see your estimated monthly payment on these homes? 💰`);
            this.addQuickReplies(['Yes, show me!', 'No thanks']);
            this.waitingMortgage = true;
          }, 900);
        }, 400);
      } else {
        this.addMessage('bot', "Thanks! An agent will be in touch with you shortly. 🏡");
      }
    }, 900 + Math.random() * 500);
  }

  showMortgageEstimate() {
    // Get best-guess price from matched properties
    const props = this.demoBot.matchProperties();
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
      btn.addEventListener('click', () => {
        this.sendMessage(opt);
      });
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
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${val * 10}%"></div>
        </div>
        <span class="score-num">${val}/10</span>
      </div>
    `;

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
      card.href = p.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
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
        <div class="prop-arrow">→</div>
      `;
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
    btn.href = link;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
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
      budget: profile.budget||'', beds: profile.beds||'', timeline: profile.timeline||'',
      area: profile.area||'', ts: new Date().toISOString(),
    };
    try {
      const saved = JSON.parse(localStorage.getItem('leadflow_leads')||'[]');
      saved.push(lead); localStorage.setItem('leadflow_leads', JSON.stringify(saved));
    } catch(e) {}
    const tryPush = (attempt) => {
      const portalId = '245406482';
      const formGuid = '42d060a5-8fe3-47a0-b741-63a4907b31e0';
      const nameParts = (lead.name||'').trim().split(' ');
      const payload = {
        fields: [
          { name: 'firstname', value: nameParts[0]||'' },
          { name: 'lastname', value: nameParts.slice(1).join(' ')||'' },
          { name: 'email', value: lead.email||'' },
          { name: 'phone', value: lead.phone||'' },
        ],
        context: { pageUri: window.location.href, pageName: document.title }
      };
      fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
      }).then(r=>{ if(!r.ok && attempt<3) setTimeout(()=>tryPush(attempt+1),3000); })
      .catch(()=>{ if(attempt<3) setTimeout(()=>tryPush(attempt+1),3000); });
    };
    tryPush(1);
  }

  scrollBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.realestateChat = new RealEstateChat();
});

