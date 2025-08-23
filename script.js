import { CONFIG } from './config.js?v=13';

/** Draws a subtle animated gradient background on a canvas (lightweight). */
(function bg(){
  const c=document.getElementById('bg-canvas'); if(!c) return;
  const ctx=c.getContext('2d'); const dpr=Math.min(devicePixelRatio||1,2);
  function resize(){ c.width=Math.floor(innerWidth*dpr); c.height=Math.floor(innerHeight*dpr); c.style.width=innerWidth+'px'; c.style.height=innerHeight+'px'; }
  addEventListener('resize', resize, {passive:true}); resize();
  let t=0;
  function blob(x,y,r,cr,cg,cb,a){ const g=ctx.createRadialGradient(x,y,r*0.2,x,y,r); g.addColorStop(0,`rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  function loop(){ t+=0.002; ctx.clearRect(0,0,c.width,c.height); ctx.globalCompositeOperation='lighter'; const cx=c.width*0.5, cy=c.height*0.5, s=Math.min(c.width,c.height);
    blob(cx+Math.cos(t)*s*0.2, cy+Math.sin(t*0.9)*s*0.18, s*0.45,124,125,255,0.08);
    blob(cx+Math.cos(t*0.8+1.7)*s*0.22, cy+Math.sin(t*0.7+0.6)*s*0.20, s*0.40,39,240,176,0.065);
    blob(cx+Math.cos(t*0.6-1.2)*s*0.24, cy+Math.sin(t*0.5-0.4)*s*0.22, s*0.42,98,224,255,0.06);
    ctx.globalCompositeOperation='source-over'; requestAnimationFrame(loop); } loop();
})();

/** Shorthand DOM helpers. */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));

/** Fetch with timeout helper. */
function fetchWithTimeout(url, options={}, ms=15000){
  const c=new AbortController(); const id=setTimeout(()=>c.abort('timeout'), ms);
  return fetch(url,{...options,signal:c.signal}).finally(()=>clearTimeout(id));
}

/** Builds headers for GitHub calls, attaching token when hitting API host. */
function applyHeaders(url, headers={}){
  const h={...headers, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
  try{
    const u=new URL(url);
    if(u.hostname==='api.github.com' && CONFIG.githubToken && CONFIG.githubToken.trim()){
      h['Authorization']=`Bearer ${CONFIG.githubToken.trim()}`;
    }
  }catch{}
  return h;
}


/** Formats ISO date into compact 'time ago'. */
function timeAgo(iso){
  const d=new Date(iso); const s=Math.floor((Date.now()-d)/1000);
  const units=[{k:31536000,n:'yr'},{k:2592000,n:'mo'},{k:604800,n:'w'},{k:86400,n:'d'},{k:3600,n:'h'},{k:60,n:'m'},{k:1,n:'s'}];
  for(const u of units){ const v=Math.floor(s/u.k); if(v>=1) return v+u.n+' ago'; }
  return 'just now';
}

/** Compact number formatter for stars. */
function formatNum(n){ if(n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'')+'M'; if(n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'')+'k'; return String(n); }

/** API CALLS: user + repos list. */
async function fetchUser(username){
  const key=`user:${username}`; try{ const c=JSON.parse(sessionStorage.getItem(key)||'null'); if(c && Date.now()-c.t < CONFIG.cacheTtlMs) return c.v; }catch{}
  const url=`https://api.github.com/users/${username}`;
  const res=await fetchWithTimeout(url,{headers:applyHeaders(url,{})}); if(!res.ok) throw new Error('GitHub '+res.status);
  const v=await res.json(); sessionStorage.setItem(key, JSON.stringify({t:Date.now(), v})); return v;
}
async function fetchRepos(username){
  const key=`repos:${username}`; try{ const c=JSON.parse(sessionStorage.getItem(key)||'null'); if(c && Date.now()-c.t < CONFIG.cacheTtlMs) return c.v; }catch{}
  const url=`https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`;
  const res=await fetchWithTimeout(url,{headers:applyHeaders(url,{})}); if(!res.ok) throw new Error('GitHub '+res.status);
  const repos=await res.json(); repos.sort((a,b)=> b.stargazers_count - a.stargazers_count);
  sessionStorage.setItem(key, JSON.stringify({t:Date.now(), v:repos})); return repos;
}

/** Attempts to fetch README (raw) and returns media url + short excerpt. */
const COMMON_READMES=['README.md','Readme.md','README.MD','README','index.md'];
function normalizeImage(raw, base){
  let u=raw.trim().replace(/^<|>$/g,'');
  if(!/^https?:\/\//i.test(u)) return base + u.replace(/^\.\//,'');
  try{
    const url=new URL(u);
    if(url.hostname==='github.com'){
      if(/\/blob\//.test(url.pathname)){ url.pathname=url.pathname.replace('/blob/','/raw/'); url.search=''; return url.toString(); }
      if(/\/assets\//.test(url.pathname) || /user-attachments\/assets\//.test(url.pathname)){ if(!url.searchParams.has('raw')) url.searchParams.set('raw','1'); return url.toString(); }
    }
    return url.toString();
  }catch{ return u; }
}
function isImageish(u){ return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(u) || /user-attachments\/assets\//i.test(u) || /\/assets\//.test(u) || /user-images\.githubusercontent\.com/i.test(u); }
function isBadge(u){ return /shields\.io|badgen\.net|badge|coveralls|travis|circleci|codecov|sonarcloud/i.test(u); }
/**Attempts to fetch a repo’s README quickly (tries default branch, then master) and returns text + base URL */
async function fetchReadmeFast(username, repo){
  const branch = repo.default_branch || 'main';
  for(const name of COMMON_READMES){
    const raw=`https://raw.githubusercontent.com/${username}/${repo.name}/${branch}/${name}`;
    const res=await fetchWithTimeout(raw,{},10000);
    if(res.ok){ const text=await res.text(); const base=raw.replace(/[^/]+$/, ''); return { text, base }; }
  }
  if(branch!=='master'){
    for(const name of COMMON_READMES){
      const raw=`https://raw.githubusercontent.com/${username}/${repo.name}/master/${name}`;
      const res=await fetchWithTimeout(raw,{},10000);
      if(res.ok){ const text=await res.text(); const base=raw.replace(/[^/]+$/, ''); return { text, base }; }
    }
  }
  return null;
}
/** Checksif a repo matches a spotlight filter (by language, stars, topics, and optional exclusions) */
function matchesFilter(repo, f){
  if(!f) return true;

  const okLang   = !f.language || f.language.includes(repo.language);
  const okStars  = !(f.starsMin >= 0) || (repo.stargazers_count >= f.starsMin);
  const okTopics = !f.topics || (Array.isArray(repo.topics) && repo.topics.some(t => f.topics.includes(t)));

  const notExcluded =
    !f.exclude ||
    (
      !(f.exclude.names && f.exclude.names.includes(repo.name)) &&
      !(f.exclude.topics && Array.isArray(repo.topics) && repo.topics.some(t => f.exclude.topics.includes(t)))
    );

  return okLang && okStars && okTopics && notExcluded;
}
/** Resolves a spotlight spec: merge explicit repos + filtered repos, sorted by last updated */
function resolveSpotlightSpec(s, repos){
  const explicitNames = (Array.isArray(s.repos) ? s.repos : []).filter(Boolean); // strip '', null, etc.
  const hasRepos  = explicitNames.length > 0;
  const hasFilter = !!(s.filter && Object.keys(s.filter).length);

  let combined = [];
  if (hasRepos && hasFilter) {
    const explicitSet = new Set(explicitNames);
    combined = repos.filter(r => explicitSet.has(r.name) || matchesFilter(r, s.filter));
  } else if (hasRepos) {
    const explicitSet = new Set(explicitNames);
    combined = repos.filter(r => explicitSet.has(r.name));
  } else if (hasFilter) {
    combined = repos.filter(r => matchesFilter(r, s.filter));
  } else {
    combined = []; // neither repos nor filter → show nothing
  }

  combined.sort((a,b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  return s.limit ? combined.slice(0, s.limit) : combined;
}

/** Fetches a repo’s README, extracts first valid image + short text excerpt, with session caching */
async function readmeMediaAndExcerpt(username, repo){
  const key=`readme_fast:${username}/${repo.name}`; try{ const c=JSON.parse(sessionStorage.getItem(key)||'null'); if(c && Date.now()-c.t < CONFIG.cacheTtlMs) return c.v; }catch{}
  const fetched = await fetchReadmeFast(username, repo);
  if(!fetched){ const out={img:null, excerpt:''}; sessionStorage.setItem(key, JSON.stringify({t:Date.now(), v:out})); return out; }
  const { text, base } = fetched;
  let img=null, m;
  const mdRe=/!\[[^\]]*\]\(([^)]+)\)/g;
  while((m=mdRe.exec(text))!==null){
    const n=normalizeImage(m[1], base); if(!isBadge(n) && isImageish(n)){ img=n; break; }
  }
  if(!img){
    const htmlRe=/<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>/gi;
    while((m=htmlRe.exec(text))!==null){ const n=normalizeImage(m[1], base); if(!isBadge(n) && isImageish(n)){ img=n; break; } }
  }
  // first meaningful line as excerpt
  let excerpt=pickExcerptFromReadme(text);
  const out={img, excerpt};
  sessionStorage.setItem(key, JSON.stringify({t:Date.now(), v:out})); 
  return out;
}

/** Attaches a smooth, jitter-free glow blob that follows the pointer. */
function attachGlow(elem){
  const blob=document.createElement('span'); blob.className='glow'; elem.appendChild(blob);
  let raf=null, mx=0,my=0, tx=0,ty=0, rect=null, active=false;
  function setPos(x,y){ blob.style.transform=`translate3d(${x-110}px, ${y-55}px, 0)`; }
  function onEnter(e){ rect=elem.getBoundingClientRect(); mx=e.clientX-rect.left; my=e.clientY-rect.top; tx=mx; ty=my; setPos(tx,ty); active=true; }
  function onMove(e){ if(!rect){ rect=elem.getBoundingClientRect(); } mx=e.clientX-rect.left; my=e.clientY-rect.top; if(!raf){ raf=requestAnimationFrame(track);} }
  function track(){ const k=0.22; tx += (mx-tx)*k; ty += (my-ty)*k; setPos(tx,ty); raf=null; if(active){ raf=requestAnimationFrame(track);} }
  function onLeave(){ active=false; rect=null; if(raf){ cancelAnimationFrame(raf); raf=null; } }
  elem.addEventListener('pointerenter', onEnter, {passive:true});
  elem.addEventListener('pointermove', onMove, {passive:true});
  elem.addEventListener('pointerleave', onLeave, {passive:true});
}

/** Grabs tags of repos. */
function extractTagsFromDesc(desc){
  if(!desc) return [];
  const out = [];

  // [tag] style (ignore common non-tags)
  const bad = new Set(['wip','archived','deprecated','beta','alpha']);
  for (const m of desc.matchAll(/\[([^\]]{1,24})\]/g)) {
    const tag = m[1].trim();
    if (!bad.has(tag.toLowerCase()) && /[A-Za-z0-9]/.test(tag)) out.push(tag);
  }

  // #tag style (avoid headings; keep words/numbers/+-.)
  for (const m of desc.matchAll(/(^|\s)#([A-Za-z0-9][A-Za-z0-9+_.-]{0,23})\b/g)) {
    out.push(m[2]);
  }

  return out;
}

function getTags(repo, limit=5){
  const fromTopics = Array.isArray(repo.topics) ? repo.topics.slice(0, limit+5) : [];
  const fromDesc   = extractTagsFromDesc(repo.description);

  // merge + dedupe, keep order preference: description first, then topics
  const seen=new Set(), merged=[];
  for (const t of [...fromDesc, ...fromTopics]) {
    const k=t.toLowerCase();
    if(!seen.has(k)){ seen.add(k); merged.push(t); }
    if(merged.length>=limit) break;
  }
  return merged;
}
/** ignores .md text/image text */
function pickExcerptFromReadme(text){
  // Remove fenced code blocks entirely
  text = text.replace(/```[\s\S]*?```/g, '\n');

  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    let s = raw.trim();
    if (!s) continue;

    if (/^#/.test(s)) continue;                     
    if (/^!\[/.test(s)) continue;                     
    if (/^<(?:img|p|div|center|h\d|br|hr)\b/i.test(s)) continue; 

    s = s.replace(/<img[^>]*>/gi, '');

    s = s.replace(/<[^>]+>/g, '');

    s = s
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')   // images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')// links
      .replace(/`([^`]+)`/g, '$1')            // code ticks
      .replace(/\s+/g, ' ')
      .trim();

    // Skip badge-y stuff if it slipped through
    if (/shields\.io|badgen\.net|badge|travis|circleci|codecov|sonarcloud/i.test(raw)) continue;

    if (s) return s.length > 220 ? s.slice(0, 217) + '…' : s;
  }
  return '';
}

function makeTagsRow(tags){
  if(!tags || !tags.length) return null;
  const row = document.createElement('div');
  row.className = 'tags';
  for(const t of tags){
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.textContent = t;
    row.appendChild(pill);
  }
  return row;
}


/** Creates a featured/special card with optional banner and excerpt. */
function card(repo, imgUrl, excerpt){
  const el=document.createElement('article'); el.className='card';
  if(imgUrl){ const img=document.createElement('img'); img.className='banner'; img.alt=`${repo.name} preview`; img.loading='lazy'; img.src=imgUrl; el.appendChild(img); }
  const body=document.createElement('div'); body.className='card-body'; el.appendChild(body);
  const h=document.createElement('h3'); h.textContent=repo.name; body.appendChild(h);
  const p=document.createElement('p'); p.textContent=(excerpt||repo.description||'No description.'); body.appendChild(p);
  const meta=document.createElement('div'); 
  meta.className='meta';
  const parts=[`★ ${formatNum(repo.stargazers_count)}`];
  if(repo.language) parts.push(repo.language);
  parts.push(`Updated ${timeAgo(repo.pushed_at)}`);
  meta.textContent = parts.join(' · ');
  body.appendChild(meta);
  const tags = getTags(repo);
  const tagsRow = makeTagsRow(tags);
  if(tagsRow) body.appendChild(tagsRow);
  const links=document.createElement('div'); links.className='links';
  const a=document.createElement('a'); a.className='link'; a.href=repo.html_url; a.target='_blank'; a.rel='noopener'; a.innerHTML=`<svg class="inline-icon"><use href="#i-github"/></svg> Repo`; links.appendChild(a);
  if(repo.homepage){ const l=document.createElement('a'); l.className='link'; l.href=repo.homepage; l.target='_blank'; l.rel='noopener'; l.innerHTML=`<svg class="inline-icon"><use href="#i-external"/></svg> Live`; links.appendChild(l); }
  body.appendChild(links);
  attachGlow(el); return el;
}

/** Renders a horizontal rail with a header and cards. */
// async function renderRail(rootEl, title, description, repos){
//   rootEl.innerHTML=''; const head=document.createElement('div'); head.className='section-head'; head.innerHTML=`<h2>${title}</h2><div class="section-desc">${description||''}</div>`; rootEl.appendChild(head);
//   const rail=document.createElement('div'); rail.className='rail'; const scroller=document.createElement('div'); scroller.className='scroller scroller--hero'; rail.appendChild(scroller); rootEl.appendChild(rail);
//   for(const r of repos){ const {img,excerpt}=await readmeMediaAndExcerpt(CONFIG.username,r); scroller.appendChild(card(r,img,excerpt)); }
// }

// optimized renderRail
async function renderRail(rootEl, title, description, repos){
  rootEl.innerHTML='';
  const head=document.createElement('div');
  head.className='section-head';
  head.innerHTML=`<h2>${title}</h2><div class="section-desc">${description||''}</div>`;

  const rail=document.createElement('div');
  rail.className='rail';
  const scroller=document.createElement('div');
  scroller.className='scroller scroller--hero';
  rail.appendChild(scroller);

  rootEl.appendChild(head);
  rootEl.appendChild(rail);

  // create skeletons - fast first paint
  const frag = document.createDocumentFragment();
  const placeholders = repos.map(r => {
    const el = card(r, null, r.description || ''); 
    el.classList.add('skeleton-card');             
    frag.appendChild(el);
    return el;
  });
  scroller.appendChild(frag);
  
  //streaming each card as soon as its README/media is ready
  repos.forEach(async (r, i) => {
    try {
      const { img, excerpt } = await readmeMediaAndExcerpt(CONFIG.username, r);
      const old = placeholders[i];
      const updated = card(r, img, excerpt || (r.description || 'No description.'));
      updated.classList.remove('skeleton-card');
      scroller.replaceChild(updated, old);
    } catch (e) {
      console.error(e);
    }
  });
}

/** Creates a grid item for the all-projects section. */
function gridItem(repo){
  const el=document.createElement('article'); el.className='proj';
  const h=document.createElement('h4'); h.textContent=repo.name; el.appendChild(h);
  const d=document.createElement('p'); d.textContent=repo.description||'No description.'; el.appendChild(d);
  const nums=document.createElement('div'); nums.className='numbers'; const parts=[`★ ${formatNum(repo.stargazers_count)}`]; if(repo.language) parts.push(repo.language); parts.push(`Updated ${timeAgo(repo.pushed_at)}`); nums.textContent=parts.join(' · '); el.appendChild(nums);
  const tags = getTags(repo);
  const tagsRow = makeTagsRow(tags);
  if(tagsRow) el.appendChild(tagsRow);
  const cta=document.createElement('div'); cta.className='cta'; const links=document.createElement('div'); links.className='links';
  const a=document.createElement('a'); a.className='link'; a.href=repo.html_url; a.target='_blank'; a.rel='noopener'; a.innerHTML=`<svg class="inline-icon"><use href="#i-github"/></svg> Repo`; links.appendChild(a);
  if(repo.homepage){ const l=document.createElement('a'); l.className='link'; l.href=repo.homepage; l.target='_blank'; l.rel='noopener'; l.innerHTML=`<svg class="inline-icon"><use href="#i-external"/></svg> Live`; links.appendChild(l); }
  cta.appendChild(links); el.appendChild(cta); attachGlow(el); return el;
}

/** Populates language filter from repo list. */
function populateLangFilter(repos){
  const langs=new Set(); repos.forEach(r=> r.language && langs.add(r.language));
  const sel=$('#lang'); sel.innerHTML='<option value="">All languages</option>'+Array.from(langs).sort().map(l=>`<option>${l}</option>`).join('');
}

/** Applies search / language / sort transforms to repo list. */
function filterAndSort(repos){
  const qEl   = document.querySelector('#q');
  const langEl= document.querySelector('#lang');
  const sortEl= document.querySelector('#sort');

  const q    = (qEl?.value || '').toLowerCase().trim();
  const lang = (langEl?.value || '');
  const sort = (sortEl?.value || 'stars');

  const qTerms = q ? q.split(/\s+/).filter(Boolean) : [];

  let r = repos.filter(x => {
    const name = (x.name || '').toLowerCase();
    const desc = (x.description || '').toLowerCase();
    const langOk = !lang || x.language === lang;
    const qOk = !q || qTerms.every(t => name.includes(t) || desc.includes(t));
    return langOk && qOk;
  });

  const safeDate = d => (d ? new Date(d).getTime() : 0);

  switch (sort) {
    case 'updated':
      r.sort((a,b) =>
        safeDate(b.pushed_at) - safeDate(a.pushed_at) ||
        (b.stargazers_count - a.stargazers_count) ||
        a.name.localeCompare(b.name)
      );
      break;
    case 'name':
      r.sort((a,b) => a.name.localeCompare(b.name));
      break;
    case 'stars':
    default:
      r.sort((a,b) =>
        (b.stargazers_count - a.stargazers_count) ||
        (safeDate(b.pushed_at) - safeDate(a.pushed_at)) ||
        a.name.localeCompare(b.name)
      );
      break;
  }
  return r;
}

/** Paints the all-projects grid. */
function renderGrid(repos){
  const grid=$('#grid'); grid.innerHTML=''; const filtered=filterAndSort(repos);
  if(filtered.length===0){ grid.innerHTML='<div class="section-desc">No projects match your filters.</div>'; return; }
  filtered.forEach(r=> grid.appendChild(gridItem(r)));
}

/** Sets hero branding and contact links from the user object + config. */
function setBrand(user){
  $('#brand-name').textContent = user.name || user.login;
  $('#footer-name').textContent = user.name || user.login;
  $('#gh-link').href = user.html_url;
  const img=$('#avatar'); img.src=`${user.avatar_url}&s=200`; img.classList.remove('skeleton');
  $('#display-name').textContent = user.name || user.login;
  $('#bio').textContent = user.bio || '';
  $('#location-pill').textContent = user.location || '—';
  if(user.blog){ const bp=$('#blog-pill'); try{ bp.textContent = new URL(user.blog).host || user.blog; }catch{ bp.textContent=user.blog } bp.style.display='inline-flex'; }
  $('#since').textContent = `On GitHub since ${new Date(user.created_at).getFullYear()}`;
  // contact
  const gh = CONFIG.contact?.github || user.html_url || `https://github.com/${user.login}`;
  const li = CONFIG.contact?.linkedin || '';
  const mail = CONFIG.contact?.email || '';
  const ghA = document.getElementById('contact-github'); ghA.href = gh;
  const liA = document.getElementById('contact-linkedin'); if(li) liA.href = li; else liA.style.display='none';
  const mA = document.getElementById('contact-mail'); if(mail) mA.href = mail; else mA.style.display='none';
  // about
  if(CONFIG.about?.html){ document.getElementById('about-content').innerHTML = CONFIG.about.html; }
}

/** Main bootstrap: api calls, then build UI. */
async function main(){
  document.getElementById('year').textContent=new Date().getFullYear();
  try{
    const [user, repos] = await Promise.all([
      fetchUser(CONFIG.username),
      fetchRepos(CONFIG.username)
    ]);

    setBrand(user);
    document.getElementById('repo-count').textContent = repos.length;
    const totalStars = repos.reduce((a,r)=>a+r.stargazers_count,0);
    document.getElementById('total-stars').textContent = formatNum(totalStars);

    populateLangFilter(repos);
    renderGrid(repos);

    const qEl   = document.getElementById('q');
    const langEl= document.getElementById('lang');
    const sortEl= document.getElementById('sort');

    let tId=null;
    qEl?.addEventListener('input', () => {
      clearTimeout(tId);
      tId = setTimeout(() => renderGrid(repos), 80);
    });
    langEl?.addEventListener('change', () => renderGrid(repos));
    sortEl?.addEventListener('change', () => renderGrid(repos));

    // --- Featured ---
    const featuredNames = new Set((CONFIG.featured?.repos) || []);
    const featuredRepos = repos.filter(r => featuredNames.has(r.name));

    document.getElementById('featured-title').textContent = CONFIG.featured?.title || 'Featured';
    document.getElementById('featured-desc').textContent  = CONFIG.featured?.description || '';

    const featuredSection = document.getElementById('featured-section');
    // kick off async render; don't await (skeletons show immediately)
    renderRail(
      featuredSection,
      CONFIG.featured?.title || 'Featured',
      CONFIG.featured?.description || '',
      featuredRepos
    ).catch(console.error);

    // --- Spotlights ---
    const spotRoot = document.getElementById('spotlights');
    spotRoot.innerHTML = '';
    for (const s of (CONFIG.spotlights || [])) {
      const list = resolveSpotlightSpec(s, repos);
      if (!list.length) continue;

      const wrap = document.createElement('section');
      // attach first so skeletons can paint right away
      spotRoot.appendChild(wrap);

      // kick off async render; don't await
      renderRail(
        wrap,
        s.title || 'Spotlight',
        s.description || '',
        list
      ).catch(console.error);
    }
  }catch(e){
    console.error(e);
    const grid = document.getElementById('grid');
    if (grid) grid.innerHTML='<div class="section-desc">Failed to load GitHub data.</div>';
  }
}
document.addEventListener('DOMContentLoaded', main);
