/* --------- CONFIG --------- */
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://your-production-backend.com';
/* -------------------------- */

const $messages = document.getElementById('messages');
const $form = document.getElementById('form');
const $prompt = document.getElementById('prompt');
const $send = document.getElementById('send');
const $clear = document.getElementById('clear');
const $file = document.getElementById('file');
const $uploadBtn = document.getElementById('uploadBtn');
const $status = document.getElementById('status');
const $progressBar = document.getElementById('progressBar');
const $progressInner = $progressBar.querySelector('i');
const $uploadNote = document.getElementById('uploadNote');

let isSending = false;

function setStatus(text, ok=true){
  $status.textContent = text;
  $status.style.color = ok ? '' : 'crimson';
}

function addMessage(text, who='bot', meta=null){
  const div = document.createElement('div');
  div.className = 'bubble ' + (who==='user' ? 'user' : 'bot');
  div.innerHTML = `<div>${escapeHtml(text)}</div>`;
  if(meta){
    const m = document.createElement('div'); m.className='meta'; m.innerHTML = meta;
    div.appendChild(m);
  }
  $messages.appendChild(div);
  $messages.scrollTop = $messages.scrollHeight;
  return div;
}

function escapeHtml(str){ 
  if(!str) return ''; 
  return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); 
}

function showTyping(){
  const t = document.createElement('div'); t.className='bubble bot'; t.id='typing';
  t.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
  $messages.appendChild(t);
  $messages.scrollTop = $messages.scrollHeight;
}
function hideTyping(){ 
  const t = document.getElementById('typing'); 
  if(t) t.remove(); 
}

// Chat submission
$form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(isSending) return;
  const q = $prompt.value.trim();
  if(!q) return;
  addMessage(q,'user');
  $prompt.value='';
  isSending = true; $send.disabled = true; setStatus('Sending…');
  showTyping();
  try{
    const res = await fetch(`${API_BASE}/chat`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({question:q, top_k:5})
    });
    if(!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    hideTyping();
    if(data.answer) addMessage(data.answer, 'bot');
    else addMessage('(no answer)', 'bot');

    if(data.sources && Array.isArray(data.sources) && data.sources.length){
      const src = document.createElement('div'); src.className='sources';
      src.innerHTML = `<details><summary>Sources (${data.sources.length})</summary>` +
        data.sources.map((s,i)=>{
          const text = s.text || s.payload || '';
          const shortText = escapeHtml(text.slice(0,300));
          const fullText = escapeHtml(text);
          const viewFull = text.length > 300 ? `<a href="#" onclick="this.parentNode.querySelector('.full').style.display='block'; this.style.display='none'; return false;">View full text</a><div class="full" style="display:none; margin-top:4px">${fullText}</div>` : '';
          return `<div style="margin-top:8px"><strong>#${i+1}</strong> — ${shortText} ${s.score ? `<span class='small'>(${Number(s.score).toFixed(3)})</span>` : ''} ${viewFull}</div>`;
        }).join('') +
      `</details>`;
      $messages.appendChild(src);
      $messages.scrollTop = $messages.scrollHeight;
    }
    setStatus('Connected');
  }catch(err){
    hideTyping();
    addMessage('Error: ' + err.message, 'bot');
    setStatus('Error', false);
  }finally{
    isSending = false; $send.disabled = false;
  }
});

// Upload file using fetch + ReadableStream
$uploadBtn.addEventListener('click', async ()=>{
  const f = $file.files[0];
  if(!f){ alert('Pick a file first'); return; }

  const chunkSize = 64*1024; // 64KB per chunk
  let uploaded = 0;

  const stream = new ReadableStream({
    async start(controller){
      const reader = f.stream().getReader();
      while(true){
        const {done, value} = await reader.read();
        if(done) break;
        uploaded += value.length;
        const pct = Math.round(uploaded / f.size * 100);
        $progressBar.style.display='block';
        $progressInner.style.width = pct+'%';
        controller.enqueue(value);
      }
      controller.close();
    }
  });

  try{
    const res = await fetch(`${API_BASE}/upload`, {
      method:'POST',
      body: new Blob([stream], { type: f.type })
    });
    if(!res.ok) throw new Error('Upload failed: ' + res.status);
    const data = await res.json();
    $uploadNote.textContent = `Indexed ${data.chunks || '?'} chunks from ${f.name}`;
    setStatus('Last upload OK');
  }catch(err){
    $uploadNote.textContent = err.message;
    setStatus('Upload error', false);
  }finally{
    setTimeout(()=>{ $progressBar.style.display='none'; $progressInner.style.width='0%'; }, 1200);
  }
});

// Clear chat
$clear.addEventListener('click', ()=>{ $messages.innerHTML=''; setStatus('Cleared'); });

// Keyboard UX
$prompt.addEventListener('keydown', (e)=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); $form.requestSubmit(); }
});

// Initial health check
(async ()=>{
  try{
    const r = await fetch(`${API_BASE}/health`);
    if(r.ok){ setStatus('Connected'); }
    else setStatus('No backend', false);
  }catch(e){ setStatus('No backend', false); }
})();
