// Lead Tracker Dashboard Script

class LeadTracker {
  constructor() {
    this.leads = [];
    this.apiKey = localStorage.getItem('hubspot_api_key') || '';
    this.currentFilter = 'all';

    this.initElements();
    this.setupEventListeners();

    // If API key saved, load leads automatically
    if (this.apiKey) {
      document.getElementById('api-key-input').value = this.apiKey;
      this.loadLeads();
    }
  }

  initElements() {
    this.apiKeyInput = document.getElementById('api-key-input');
    this.loadBtn = document.getElementById('load-btn');
    this.leadsList = document.getElementById('leads-list');
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.totalCount = document.getElementById('total-count');
    this.hotCount = document.getElementById('hot-count');
    this.warmCount = document.getElementById('warm-count');
    this.coldCount = document.getElementById('cold-count');
  }

  setupEventListeners() {
    this.loadBtn.addEventListener('click', () => this.handleLoadClick());
    this.filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleFilterClick(e));
    });
  }

  handleLoadClick() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      this.showError('Please enter your HubSpot API key');
      return;
    }
    this.apiKey = apiKey;
    localStorage.setItem('hubspot_api_key', apiKey);
    this.loadLeads();
  }

  handleFilterClick(e) {
    const target = e.target;
    this.filterBtns.forEach((btn) => btn.classList.remove('active'));
    target.classList.add('active');
    this.currentFilter = target.dataset.filter;
    this.renderLeads();
  }

  async loadLeads() {
    this.loadBtn.classList.add('loading');
    this.loadBtn.disabled = true;
    this.loadBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';

    try {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100',
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check and try again.');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      this.leads = (data.results || []).map((contact) => ({
        id: contact.id,
        name:
          (contact.properties.firstname?.value || '') +
          ' ' +
          (contact.properties.lastname?.value || ''),
        email: contact.properties.email?.value || 'N/A',
        phone: contact.properties.phone?.value || 'N/A',
        status: contact.properties.hs_lead_status?.value || 'unknown',
        budget: contact.properties.leadbudget?.value || 'N/A',
        timeline: contact.properties.leadtimeline?.value || 'N/A',
        needs: contact.properties.leadneeds?.value || 'N/A',
        createdAt: new Date(contact.createdAt),
      }));

      this.renderLeads();
      this.updateStats();
      this.showSuccess(`Loaded ${this.leads.length} leads`);
    } catch (err) {
      this.showError(String(err));
    } finally {
      this.loadBtn.classList.remove('loading');
      this.loadBtn.disabled = false;
      this.loadBtn.innerHTML = 'Load Leads';
    }
  }

  updateStats() {
    const total = this.leads.length;
    const hot = this.leads.filter((l) => l.status === 'hot').length;
    const warm = this.leads.filter((l) => l.status === 'warm').length;
    const cold = this.leads.filter((l) => l.status === 'cold').length;

    this.totalCount.textContent = total;
    this.hotCount.textContent = hot;
    this.warmCount.textContent = warm;
    this.coldCount.textContent = cold;
  }

  renderLeads() {
    let filtered = this.leads;

    if (this.currentFilter !== 'all') {
      filtered = this.leads.filter((l) => l.status === this.currentFilter);
    }

    if (filtered.length === 0) {
      this.leadsList.innerHTML =
        '<div class="empty-state"><p>No leads found</p></div>';
      return;
    }

    this.leadsList.innerHTML = filtered
      .map((lead) => this.renderLeadCard(lead))
      .join('');
  }

  renderLeadCard(lead) {
    const statusEmoji = {
      hot: '🔴',
      warm: '🟡',
      cold: '🔵',
    }[lead.status] || '⚪';

    const daysAgo = Math.floor((Date.now() - lead.createdAt) / (1000 * 60 * 60 * 24));
    const dateStr = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;

    return `
      <div class="lead-card ${lead.status}">
        <div class="lead-status ${lead.status}">${statusEmoji} ${lead.status.toUpperCase()}</div>
        <div class="lead-name">${lead.name}</div>
        <div class="lead-info">
          <div class="lead-info-row">
            <span class="lead-icon">📧</span>
            <strong>Email:</strong>
            <span>${lead.email}</span>
          </div>
          <div class="lead-info-row">
            <span class="lead-icon">📞</span>
            <strong>Phone:</strong>
            <span>${lead.phone}</span>
          </div>
          <div class="lead-info-row">
            <span class="lead-icon">💰</span>
            <strong>Budget:</strong>
            <span>${lead.budget}</span>
          </div>
          <div class="lead-info-row">
            <span class="lead-icon">⏰</span>
            <strong>Timeline:</strong>
            <span>${lead.timeline}</span>
          </div>
          <div class="lead-info-row">
            <span class="lead-icon">📝</span>
            <strong>Needs:</strong>
            <span>${lead.needs}</span>
          </div>
        </div>
        <div class="lead-footer">
          <div class="lead-date">📅 ${dateStr}</div>
        </div>
      </div>
    `;
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = '❌ ' + message;
    this.leadsList.parentElement.insertBefore(errorDiv, this.leadsList);

    setTimeout(() => errorDiv.remove(), 5000);
  }

  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = '✅ ' + message;
    this.leadsList.parentElement.insertBefore(successDiv, this.leadsList);

    setTimeout(() => successDiv.remove(), 3000);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new LeadTracker();
});
