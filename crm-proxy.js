const http = require('http');
const https = require('https');
const TOKEN = process.env.HUBSPOT_TOKEN;
const RENTCAST_KEY = process.env.RENTCAST_KEY || 'e6d1d9a8ce9641838c3509e07c533422';
const PORT = 3001;

// ── HubSpot Lead Push ────────────────────────────────────────
function pushContact(lead, cb) {
  const parts = (lead.name||'').trim().split(' ');
  const props = {
    firstname: parts[0]||'Unknown',
    lastname: parts.slice(1).join(' ')||'',
    lifecyclestage: 'lead',
    message: ['budget','beds','timeline','area'].map(k=>lead[k]?`${k}:${lead[k]}`:'').filter(Boolean).join(' | ')
  };
  if (lead.email) props.email = lead.email;
  if (lead.phone) props.phone = lead.phone;
  const body = JSON.stringify({properties: props});
  const req = https.request({
    hostname:'api.hubapi.com', path:'/crm/v3/objects/contacts',
    method:'POST', headers:{
      'Authorization':`Bearer ${TOKEN}`,
      'Content-Type':'application/json',
      'Content-Length':Buffer.byteLength(body)
    }
  }, res => {
    let d='';
    res.on('data',c=>d+=c);
    res.on('end',()=>{
      try {
        const r=JSON.parse(d);
        if (r.id) { console.log('[CRM] Created contact:', r.id, props.firstname, props.lastname); cb(null,r); }
        else { console.error('[CRM] HubSpot error:', d); cb(new Error(r.message||'HubSpot rejected'), null); }
      } catch(e){ cb(e,null); }
    });
  });
  req.on('error', e=>{ console.error('[CRM] Network error:',e.message); cb(e,null); });
  req.write(body); req.end();
}

// ── RentCast API Helper ──────────────────────────────────────
function rentcastGet(path, cb) {
  const req = https.request({
    hostname: 'api.rentcast.io',
    path: path,
    method: 'GET',
    headers: { 'X-Api-Key': RENTCAST_KEY, 'Accept': 'application/json' }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { cb(null, JSON.parse(d)); }
      catch(e) { cb(e, null); }
    });
  });
  req.on('error', e => cb(e, null));
  req.end();
}

// ── Property Intelligence Lookup ─────────────────────────────
function propertyLookup(address, city, state, beds, baths, sqft, cb) {
  const enc = s => encodeURIComponent(s||'');
  const fullAddr = `${address}, ${city}, ${state}`;
  console.log('[Property] Looking up:', fullAddr);

  // Call AVM value estimate
  const valuePath = `/v1/avm/value?address=${enc(address)}&city=${enc(city)}&state=${enc(state)}`;
  rentcastGet(valuePath, (err, valueData) => {
    if (err || valueData.error) {
      console.error('[Property] Value error:', err || valueData);
      return cb(null, { demo: true });
    }

    // Call rent estimate
    const rentPath = `/v1/avm/rent/long-term?address=${enc(address)}&city=${enc(city)}&state=${enc(state)}` +
      (beds ? `&bedrooms=${beds}` : '') +
      (baths ? `&bathrooms=${baths}` : '') +
      (sqft ? `&squareFootage=${sqft}` : '');

    rentcastGet(rentPath, (err2, rentData) => {
      const result = {
        address: fullAddr,
        estimatedValue: valueData.price,
        valueLow: valueData.priceRangeLow,
        valueHigh: valueData.priceRangeHigh,
        estimatedRent: rentData && !rentData.error ? rentData.rent : null,
        rentLow: rentData && !rentData.error ? rentData.rentRangeLow : null,
        rentHigh: rentData && !rentData.error ? rentData.rentRangeHigh : null,
        comparables: (valueData.comparables || []).slice(0, 3).map(c => ({
          address: c.formattedAddress,
          price: c.price,
          beds: c.bedrooms,
          baths: c.bathrooms,
          sqft: c.squareFootage,
          type: c.propertyType,
        })),
      };
      cb(null, result);
    });
  });
}

// ── HTTP Server ───────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

http.createServer((req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k,v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /lead ──
  if (req.method === 'POST' && req.url === '/lead') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const lead = JSON.parse(body);
        pushContact(lead, (err, r) => {
          res.writeHead(err ? 500 : 200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(err ? {ok:false,error:err.message} : {ok:true,id:r.id}));
        });
      } catch(e){ res.writeHead(400); res.end(JSON.stringify({ok:false,error:'Bad JSON'})); }
    });
    return;
  }

  // ── GET /property?address=...&city=...&state=...&beds=&baths=&sqft= ──
  if (req.method === 'GET' && req.url.startsWith('/property')) {
    const url = new URL(req.url, 'http://localhost');
    const address = url.searchParams.get('address') || '';
    const city    = url.searchParams.get('city') || '';
    const state   = url.searchParams.get('state') || 'NM';
    const beds    = url.searchParams.get('beds') || '';
    const baths   = url.searchParams.get('baths') || '';
    const sqft    = url.searchParams.get('sqft') || '';

    if (!address || !city) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false,error:'address and city required'}));
      return;
    }

    propertyLookup(address, city, state, beds, baths, sqft, (err, data) => {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(data || {ok:false,error:String(err)}));
    });
    return;
  }

  // ── GET /health ──
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,ts:Date.now()}));
    return;
  }

  res.writeHead(404); res.end();

}).listen(PORT, '0.0.0.0', () => console.log('[CRM Proxy] Listening on port', PORT));
