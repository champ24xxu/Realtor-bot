// NeighborAI Sales Widget — v1.0
// Qualifies real estate agents as leads for NeighborAI
// Mirrors chat-widget.js architecture, drop-in replacement for landing page

// ── Sales Bot Engine ────────────────────────────────────────────
class SalesBot {
  constructor() {
    this.step    = 0;
    this.profile = {};
    this.score   = 0;
    this.steps   = [
      {
        key: null,
        ask: "Hey! 👋 I'm the NeighborAI assistant. I help real estate agents capture more leads — automatically. Quick question: are you currently missing leads when you're with clients or after hours?",
        options: ["Yeah, happens all the time 😬", "Probably some, not sure", "I have a system for that"],
      },
      { key: 'name',       ask: "Got it. What's your name?" },
      { key: 'email',      ask: "Nice to meet you, {name}! What's the best email to reach you?" },
      { key: 'phone',      ask: "And a phone number? (Optional — only for scheduling a demo)" },
      {
        key: 'leads_per_month',
        ask: "Quick baseline: roughly how many leads do you get from your website per month?",
        options: ["Less than 10", "10–30", "30–50", "50+"],
      },
      {
        key: 'crm',
        ask: "Are you using a CRM right now?",
        options: ["HubSpot", "Follow Up Boss", "Salesforce", "Spreadsheets / nothing", "Something else"],
      },
      {
        key: 'after_hours',
        ask: "What happens when someone fills out a form on your site at 11pm on a Sunday?",
        options: ["They wait till I'm free", "I try to reply ASAP but it's tough", "I have a VA or team", "Honestly… I probably miss it"],
      },
      {
        key: 'team_size',
        ask: "Are you a solo agent or do you work with a team / brokerage?",
        options: ["Solo agent", "Small team (2–5)", "Brokerage / large team"],
      },
      {
        key: null,
        ask: 'SCORE_AND_PITCH',
      },
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
    if (next.ask === 'SCORE_AND_PITCH') {
      return { type: 'pitch', score: this.calcScore(), profile: this.profile };
    }
    const text = next.ask.replace('{name}', this.profile.name || 'there');
    return { type: 'chat', text, options: next.options || null };
  }

  calcScore() {
    let s = 0;

    // Misses leads → hot signal
    const afterHours = this.profile.after_hours || '';
    if (afterHours.includes('wait') || afterHours.includes('miss') || afterHours.includes('tough')) s += 3;
    else if (afterHours.includes('ASAP')) s += 2;

    // No CRM or spreadsheets → high pain
    const crm = this.profile.crm || '';
    if (crm.includes('Spreadsheets') || crm.includes('nothing')) s += 3;
    else if (crm.includes('HubSpot') || crm.includes('Follow Up Boss')) s += 1;

    // Lead volume → higher = better fit
    const vol = this.profile.leads_per_month || '';
    if (vol.includes('50+')) s += 3;
    else if (vol.includes('30')) s += 2;
    else if (vol.includes('10')) s += 1;

    // First answer — admitted they miss leads
    const first = this.profile[this.steps[0]?.key || ''] || '';
    if ((this.profile._firstAnswer || '').includes('happens all the time')) s += 1;

    // Team size — brokerage = team tier pitch
    const team = this.profile.team_size || '';
    if (team.includes('Brokerage')) s += 2;
    else if (team.includes('team')) s += 1;

    this.score = s;
    return s;
  }

  getPitchTier(score) {
    if (score >= 8) return 'hot';
    if (score >= 5) return 'warm';
    return 'cold';
  }
}

// ── Feature Cards Data ──────────────────────────────────────────
const FEATURES = [
  { icon: '🕐', title: '24/7 Lead Capture',    desc: 'Qualifies buyers & sellers while you sleep. No lead left behind.' },
  { icon: '🎯', title: 'Auto-Qualification',   desc: 'Scores every lead 1–10. You only call the hot ones.' },
  { icon: '📅', title: 'Auto-Books Showings',  desc: 'Syncs with your calendar. Appointments show up — you show up.' },
  { icon: '🏠', title: 'Live Home Valuations', desc: 'Sellers get an instant AVM estimate. You get their contact info.' },
  { icon: '📊', title: 'CRM Sync',             desc: 'Every lead pushed to HubSpot or your preferred CRM automatically.' },
  { icon: '💬', title: 'Follow-Up Sequences',  desc: 'Automated Day 1/3/7 follow-ups so no lead goes cold.' },
];

// ── Main Sales Chat Widget ──────────────────────────────────────
class SalesChat {
  constructor() {
    this.salesBot        = new SalesBot();
    this.useDemoMode     = true; // Always demo mode — no backend needed for sales widget
    this.CALENDLY_URL    = 'https://calendly.com/grow-neighborai';
    this.idleTimer       = null;
    this.idleNudges      = [
      "Still there? 😊 Takes under 2 minutes — and you might be surprised what you're missing.",
      "No pressure! I'll be here if you want to see how agents are closing more deals on autopilot.",
    ];
    this.idleNudgeIndex  = 0;
    this.exitIntentFired = sessionStorage.getItem('sales_exit_fired') === '1';
    this.pageEntryTime   = Date.now();

    this.initElements();
    this.bindEvents();
    this.bindExitIntent();
  }

  initElements() {
    this.chatWidget   = document.getElementById('sales-chat-widget');
    this.chatMessages = document.getElementById('sales-chat-messages');
    this.chatInput    = document.getElementById('sales-chat-input');
    this.sendBtn      = document.getElementById('sales-send-btn');
    this.closeBtn     = document.getElementById('sales-close-chat');
    this.overlay      = document.getElementById('sales-chat-overlay');
  }

  bindEvents() {
    document.querySelectorAll('[data-sales-chat-open]').forEach(el => {
      el.addEventListener('click', () => this.openChat());
    });
    this.closeBtn?.addEventListener('click', () => this.closeChat());
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
  }

  bindExitIntent() {
    document.addEventListener('mouseleave', (e) => {
      if (e.clientY > 0) return;
      if (this.exitIntentFired) return;
      if (Date.now() - this.pageEntryTime < 8000) return;
      this.exitIntentFired = true;
      sessionStorage.setItem('sales_exit_fired', '1');
      this.openChat("Wait — before you go! Most agents don't realize how many leads they're losing. Let me show you in 60 seconds? 👀");
    });
  }

  openChat(overrideMsg) {
    this.chatWidget?.classList.remove('hidden');
    this.overlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.chatInput?.focus();
    this.resetIdleTimer();

    if (!this.salesBot._started) {
      this.salesBot._started = true;
      this.addTyping();
      setTimeout(() => {
        this.removeTyping();
        const msg   = overrideMsg || this.salesBot.steps[0].ask;
        const opts  = this.salesBot.steps[0].options;
        this.addMessage('bot', msg);
        if (opts) this.addQuickReplies(opts);
        // Advance past the first step (it has no key, just captures first answer vibe)
        this.salesBot.profile._firstAnswer = '';
        this.salesBot.step = 1;
      }, 600);
    }
  }

  closeChat() {
    this.chatWidget?.classList.add('hidden');
    this.overlay?.classList.add('hidden');
    document.body.style.overflow = '';
    this.clearIdleTimer();
  }

  resetIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.sendIdleNudge(), 35000);
  }

  clearIdleTimer() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
  }

  sendIdleNudge() {
    const msg = this.idleNudges[this.idleNudgeIndex % this.idleNudges.length];
    this.idleNudgeIndex++;
    this.addMessage('bot', msg);
    this.idleTimer = setTimeout(() => this.sendIdleNudge(), 50000);
  }

  sendMessage(text) {
    const msg = text || this.chatInput?.value.trim();
    if (!msg) return;

    document.querySelectorAll('.sales-quick-replies').forEach(el => el.remove());

    this.addMessage('user', msg);
    if (this.chatInput) this.chatInput.value = '';
    this.chatInput?.focus();
    this.resetIdleTimer();

    // Capture first-answer vibe
    if (this.salesBot.step === 1) {
      this.salesBot.profile._firstAnswer = msg;
    }

    this.handleSalesReply(msg);
  }

  handleSalesReply(userMsg) {
    this.addTyping();
    setTimeout(() => {
      this.removeTyping();

      const result = this.salesBot.reply(userMsg);

      if (result.type === 'chat') {
        this.addMessage('bot', result.text);
        if (result.options) this.addQuickReplies(result.options);

      } else if (result.type === 'pitch') {
        this.deliverPitch(result.score, result.profile);

      } else {
        this.addMessage('bot', "Thanks — we'll be in touch! 🏡");
      }
    }, 700 + Math.random() * 400);
  }

  deliverPitch(score, profile) {
    const tier = this.salesBot.getPitchTier(score);
    const name = profile.name ? `, ${profile.name.split(' ')[0]}` : '';

    // Push to HubSpot via crm-proxy
    this.pushToHubSpot(profile, score, tier);

    if (tier === 'hot') {
      this.addMessage('bot', `${name ? name.replace(',','') + ',' : 'Honestly,'} you're exactly who we built NeighborAI for. 🔥`);
      setTimeout(() => {
        this.addMessage('bot', "You're losing leads right now that a $499 bot would capture automatically. Want to see it live in 15 minutes?");
        setTimeout(() => {
          this.addFeatureCards();
          setTimeout(() => {
            this.addMessage('bot', "Book a quick demo — I'll show you the exact setup that would work for your business:");
            setTimeout(() => this.addCalendlyButton('📅 Book Your Free Demo'), 500);
          }, 800);
        }, 600);
      }, 600);

    } else if (tier === 'warm') {
      this.addMessage('bot', `Here's what agents like you are using NeighborAI for${name}:`);
      setTimeout(() => {
        this.addFeatureCards();
        setTimeout(() => {
          this.addMessage('bot', "Curious if it fits your workflow? Grab a free 15-min call — no pitch, just a look:");
          setTimeout(() => this.addCalendlyButton('📅 See It In Action'), 600);
        }, 800);
      }, 500);

    } else {
      this.addMessage('bot', `Thanks for chatting${name}! 🙌 Here's a quick look at what NeighborAI does:`);
      setTimeout(() => {
        this.addFeatureCards();
        setTimeout(() => {
          this.addMessage('bot', "If things change and you want to explore — the demo is always free:");
          setTimeout(() => this.addCalendlyButton('📅 Schedule a Demo'), 500);
        }, 800);
      }, 500);
    }
  }

  pushToHubSpot(profile, score, tier) {
    const lead = {
      name:            profile.name    || '',
      email:           profile.email   || '',
      phone:           profile.phone   || '',
      lead_source:     'sales-widget',
      lead_score:      score,
      lead_tier:       tier,
      leads_per_month: profile.leads_per_month || '',
      crm:             profile.crm || '',
      after_hours:     profile.after_hours || '',
      team_size:       profile.team_size || '',
      ts:              new Date().toISOString(),
    };

    // LocalStorage fallback
    try {
      const saved = JSON.parse(localStorage.getItem('neighborai_sales_leads') || '[]');
      saved.push(lead);
      localStorage.setItem('neighborai_sales_leads', JSON.stringify(saved));
    } catch(e) {}

    // Push to crm-proxy
    const tryPush = (attempt) => {
      fetch('http://31.97.212.21:3001/lead', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(lead),
      })
      .then(r => r.json())
      .then(r => { if (!r.ok && attempt < 3) setTimeout(() => tryPush(attempt + 1), 3000); })
      .catch(() => { if (attempt < 3) setTimeout(() => tryPush(attempt + 1), 3000); });
    };
    tryPush(1);
  }

  // ── Render Helpers ──────────────────────────────────────────
  addMessage(role, text) {
    const wrap   = document.createElement('div');
    wrap.className = `sales-message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'sales-message-content';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addQuickReplies(options) {
    const container = document.createElement('div');
    container.className = 'sales-quick-replies';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'sales-quick-reply-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => this.sendMessage(opt));
      container.appendChild(btn);
    });
    this.chatMessages.appendChild(container);
    this.scrollBottom();
  }

  addFeatureCards() {
    const wrap = document.createElement('div');
    wrap.className = 'sales-message bot';
    const grid = document.createElement('div');
    grid.className = 'sales-feature-grid';

    FEATURES.forEach(f => {
      const card = document.createElement('div');
      card.className = 'sales-feature-card';
      card.innerHTML = `
        <div class="sales-feat-icon">${f.icon}</div>
        <div class="sales-feat-title">${this.esc(f.title)}</div>
        <div class="sales-feat-desc">${this.esc(f.desc)}</div>
      `;
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addCalendlyButton(label) {
    const wrap = document.createElement('div');
    wrap.className = 'sales-message bot';
    const btn = document.createElement('a');
    btn.className = 'sales-calendly-btn';
    btn.href = this.CALENDLY_URL;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.textContent = label || '📅 Book a Free Demo';
    wrap.appendChild(btn);
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  addTyping() {
    this.removeTyping();
    const wrap = document.createElement('div');
    wrap.className = 'sales-message bot sales-typing-wrap';
    wrap.id = 'sales-typing-indicator';
    wrap.innerHTML = '<div class="sales-message-content sales-typing"><span></span><span></span><span></span></div>';
    this.chatMessages.appendChild(wrap);
    this.scrollBottom();
  }

  removeTyping() {
    document.getElementById('sales-typing-indicator')?.remove();
  }

  scrollBottom() {
    if (this.chatMessages) this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

// ── CSS Injection ───────────────────────────────────────────────
(function injectSalesStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Sales Widget Container */
    #sales-chat-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 380px;
      max-height: 600px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      overflow: hidden;
    }
    #sales-chat-widget.hidden { display: none; }

    #sales-chat-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 9998;
    }
    #sales-chat-overlay.hidden { display: none; }

    /* Header */
    .sales-chat-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 16px 16px 0 0;
    }
    .sales-chat-header-title { font-weight: 700; font-size: 15px; }
    .sales-chat-header-sub   { font-size: 12px; opacity: 0.75; margin-top: 2px; }
    .sales-close-btn {
      background: none; border: none; color: #fff;
      font-size: 20px; cursor: pointer; opacity: 0.7; padding: 0 4px;
    }
    .sales-close-btn:hover { opacity: 1; }

    /* Messages */
    #sales-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f7f8fc;
    }

    .sales-message { display: flex; }
    .sales-message.bot  { justify-content: flex-start; }
    .sales-message.user { justify-content: flex-end; }

    .sales-message-content {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      line-height: 1.5;
    }
    .sales-message.bot  .sales-message-content {
      background: #fff;
      color: #1a1a2e;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .sales-message.user .sales-message-content {
      background: #1a1a2e;
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .sales-typing { display: flex; gap: 5px; align-items: center; padding: 12px 14px; }
    .sales-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #aaa;
      animation: sales-bounce 1.2s infinite;
    }
    .sales-typing span:nth-child(2) { animation-delay: 0.2s; }
    .sales-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes sales-bounce {
      0%,80%,100% { transform: translateY(0); opacity: 0.5; }
      40%          { transform: translateY(-6px); opacity: 1; }
    }

    /* Quick replies */
    .sales-quick-replies {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 2px 0 4px 0;
    }
    .sales-quick-reply-btn {
      background: #fff;
      border: 1.5px solid #1a1a2e;
      color: #1a1a2e;
      border-radius: 20px;
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .sales-quick-reply-btn:hover {
      background: #1a1a2e;
      color: #fff;
    }

    /* Feature cards grid */
    .sales-feature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      width: 100%;
    }
    .sales-feature-card {
      background: #f0f4ff;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .sales-feat-icon  { font-size: 20px; margin-bottom: 4px; }
    .sales-feat-title { font-weight: 700; font-size: 12px; color: #1a1a2e; margin-bottom: 3px; }
    .sales-feat-desc  { font-size: 11px; color: #555; line-height: 1.4; }

    /* Calendly button */
    .sales-calendly-btn {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .sales-calendly-btn:hover { opacity: 0.9; }

    /* Input bar */
    .sales-chat-input-bar {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      background: #fff;
      border-top: 1px solid #eee;
    }
    #sales-chat-input {
      flex: 1;
      border: 1.5px solid #ddd;
      border-radius: 20px;
      padding: 9px 14px;
      font-size: 14px;
      outline: none;
    }
    #sales-chat-input:focus { border-color: #1a1a2e; }
    #sales-send-btn {
      background: #1a1a2e;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      cursor: pointer;
      font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s;
    }
    #sales-send-btn:hover { opacity: 0.85; }

    /* Floating trigger button */
    #sales-chat-trigger {
      position: fixed;
      bottom: 24px; right: 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      border: none;
      border-radius: 28px;
      padding: 14px 22px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      z-index: 9997;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.15s;
    }
    #sales-chat-trigger:hover { transform: translateY(-2px); }
    #sales-chat-trigger.hidden { display: none; }

    @media (max-width: 480px) {
      #sales-chat-widget {
        width: 100vw; height: 100vh; max-height: 100vh;
        bottom: 0; right: 0; border-radius: 0;
      }
      .sales-feature-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
})();

// ── HTML Injection ──────────────────────────────────────────────
(function injectSalesHTML() {
  const trigger = document.createElement('button');
  trigger.id = 'sales-chat-trigger';
  trigger.setAttribute('data-sales-chat-open', '');
  trigger.innerHTML = '🤖 <span>See How It Works</span>';

  const overlay = document.createElement('div');
  overlay.id = 'sales-chat-overlay';
  overlay.className = 'hidden';

  const widget = document.createElement('div');
  widget.id = 'sales-chat-widget';
  widget.className = 'hidden';
  widget.innerHTML = `
    <div class="sales-chat-header">
      <div>
        <div class="sales-chat-header-title">NeighborAI Assistant</div>
        <div class="sales-chat-header-sub">Let's see if we're a fit</div>
      </div>
      <button class="sales-close-btn" id="sales-close-chat">✕</button>
    </div>
    <div id="sales-chat-messages"></div>
    <div class="sales-chat-input-bar">
      <input id="sales-chat-input" type="text" placeholder="Type a message…" autocomplete="off" />
      <button id="sales-send-btn">➤</button>
    </div>
  `;

  // Hide trigger when widget opens, show when closed
  overlay.addEventListener('click', () => {
    widget.classList.add('hidden');
    overlay.classList.add('hidden');
    trigger.classList.remove('hidden');
    document.body.style.overflow = '';
  });

  document.body.appendChild(trigger);
  document.body.appendChild(overlay);
  document.body.appendChild(widget);
})();

// ── Init ────────────────────────────────────────────────────────
window.salesChat = new SalesChat();

// Hide trigger when chat opens
document.getElementById('sales-chat-trigger')?.addEventListener('click', () => {
  document.getElementById('sales-chat-trigger').classList.add('hidden');
});
