/* --------- CONFIG --------- */
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://chatbot-a6k8.onrender.com';


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

// Upload file using XMLHttpRequest so we can track progress
$uploadBtn.addEventListener('click', ()=>{
  const f = $file.files[0];
  if(!f){ alert('Pick a file first'); return; }

  const form = new FormData();
  form.append('file', f);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE}/upload`, true);

  setStatus('Uploading…');
  $progressBar.style.display='block';
  $progressInner.style.width='0%';

  xhr.upload.onprogress = (event)=>{
    if(!event.lengthComputable) return;
    const pct = Math.round((event.loaded / event.total) * 100);
    $progressInner.style.width = pct + '%';
  };

  xhr.onreadystatechange = ()=>{
    if(xhr.readyState !== XMLHttpRequest.DONE) return;

    setTimeout(()=>{
      $progressBar.style.display='none';
      $progressInner.style.width='0%';
    }, 800);

    if(xhr.status >= 200 && xhr.status < 300){
      try{
        const data = JSON.parse(xhr.responseText || '{}');
        $uploadNote.textContent = `Indexed ${data.chunks || '?'} chunks from ${f.name}`;
        setStatus('Last upload OK');
      }catch(err){
        $uploadNote.textContent = 'Upload succeeded but response was invalid';
        setStatus('Upload parse error', false);
      }
    }else{
      $uploadNote.textContent = `Upload failed: ${xhr.status}`;
      setStatus('Upload error', false);
    }
  };

  xhr.onerror = ()=>{
    setTimeout(()=>{
      $progressBar.style.display='none';
      $progressInner.style.width='0%';
    }, 800);
    $uploadNote.textContent = 'Network error during upload';
    setStatus('Upload error', false);
  };

  xhr.send(form);
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
