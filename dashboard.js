/* ============================================================
   dashboard.js — Dashboard Harzafi Notes (PRO Edition w/ Blob PDF & Gemini AI)
   ============================================================ */

const GEMINI_API_KEY = "AQ.Ab8RN6LWwKcNQNo3j5WngHW2NAlTgiGf6B4XYgrYf0Tmx3ByyA";

const firebaseConfig = {
    apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfakiLT7-0A",
    authDomain: "harzafi-notes.firebaseapp.com",
    projectId: "harzafi-notes",
    messagingSenderId: "35834921638",
    appId: "1:35834921638:web:cb5d8d612b4a2936126a67"
};

try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch(e) {}

const auth = firebase.auth();
const db = firebase.firestore();

const CLOUDINARY_CLOUD_NAME = "dxttlpg0g";
const CLOUDINARY_UPLOAD_PRESET = "harzafi_notes";
const ADMIN_EMAIL = "s11205413d@studenti.itisavogadro.it";

let materiaUploadSelezionata = "Informatica";

// ==========================================
// 1. GESTIONE AUTENTICAZIONE E PROFILO
// ==========================================
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        const btnUpload = document.getElementById('btnUploadModal');
        if (user.email === ADMIN_EMAIL && btnUpload) btnUpload.style.display = 'block';
        
        const profilePicEl = document.getElementById('userProfilePic');
        if (profilePicEl) {
            if (user.photoURL) {
                let highResPhoto = user.photoURL;
                if (highResPhoto.includes("=s96-c")) highResPhoto = highResPhoto.replace("=s96-c", "=s150-c");
                profilePicEl.src = highResPhoto;
            } else {
                profilePicEl.src = "IMMAGINI/PROFILO-UTENTE-LOGO.png";
            }
        }
        impostaSalutoDinamico(user);
        caricaAppunti('Tutte');
    }
});

function impostaSalutoDinamico(user) {
    const hour = new Date().getHours();
    let greetText = "Buongiorno"; let greetEmoji = "☀️";
    if (hour >= 5 && hour < 13) { greetText = "Buongiorno"; greetEmoji = "☀️"; }
    else if (hour >= 13 && hour < 18) { greetText = "Buon pomeriggio"; greetEmoji = "☕"; }
    else { greetText = "Buonasera"; greetEmoji = "🌙"; }
    
    let name = "Studente";
    const sessionName = sessionStorage.getItem('harzafi_user');
    if (sessionName && sessionName !== "Utente") name = sessionName.split(" ")[0];
    else if (user && user.displayName) name = user.displayName.split(" ")[0];
    
    const greetingTextEl = document.getElementById('greetingText');
    if(greetingTextEl) greetingTextEl.innerHTML = `<span class="animated-gradient-text">${greetText}</span><span style="font-size: 1.1em; line-height: 1;">${greetEmoji}</span><span class="animated-gradient-text">, ${name}</span>`;
    
    const userNameDisplayEl = document.getElementById('userNameDisplay');
    if(userNameDisplayEl) userNameDisplayEl.textContent = name;
}

const btnEsci = document.getElementById('btnEsci');
if(btnEsci) btnEsci.addEventListener('click', () => { auth.signOut().then(() => window.location.href = "login.html"); });

// ==========================================
// 2. FUNZIONI UTILI (TOAST, COPIA, PREFERITI)
// ==========================================
function showToast(message, icon = "✅") {
    const toast = document.getElementById('globalToast');
    if(!toast) return;
    toast.innerHTML = `${icon} ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.copiaLink = function(url, ev) {
    if(ev) { ev.preventDefault(); ev.stopPropagation(); }
    navigator.clipboard.writeText(url).then(() => showToast("Link copiato negli appunti!", "🔗")).catch(() => showToast("Errore durante la copia.", "⚠️"));
};

window.togglePreferito = function(docId, ev) {
    if(ev) { ev.preventDefault(); ev.stopPropagation(); }
    let favs = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');
    const btn = ev.currentTarget;
    if (favs.includes(docId)) {
        favs = favs.filter(id => id !== docId);
        btn.classList.remove('fav-active');
        showToast("Rimosso dai preferiti", "❌");
        if (document.getElementById('titoloMateria').textContent === 'I Miei Preferiti') caricaAppunti('Preferiti');
    } else {
        favs.push(docId);
        btn.classList.add('fav-active');
        showToast("Salvato nei preferiti!", "⭐");
    }
    localStorage.setItem('harzafi_favs', JSON.stringify(favs));
};

// ==========================================
// 3. RICERCA E FILTRO
// ==========================================
window.filtraMateria = function(materia, e) {
    const ev = e || window.event;
    document.querySelectorAll('.materia-btn').forEach(btn => btn.classList.remove('active'));
    if(ev && ev.currentTarget) ev.currentTarget.classList.add('active');
    
    const titoloEl = document.getElementById('titoloMateria');
    if(titoloEl) titoloEl.textContent = materia === 'Preferiti' ? 'I Miei Preferiti' : (materia === 'Tutte' ? 'Tutti i file' : materia);
    
    const searchEl = document.getElementById('searchNotes');
    if(searchEl) searchEl.value = "";
    
    const emptyEl = document.getElementById('emptySearchState');
    if(emptyEl) emptyEl.style.display = 'none';
    
    caricaAppunti(materia);
};

const searchNotesEl = document.getElementById('searchNotes');
if(searchNotesEl) {
    searchNotesEl.addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.note-card');
        let hasVisible = false;
        cards.forEach(card => {
            const title = card.querySelector('.note-title').textContent.toLowerCase();
            const meta = card.querySelector('.note-meta').textContent.toLowerCase();
            if (title.includes(term) || meta.includes(term)) { card.style.display = 'flex'; hasVisible = true; } 
            else { card.style.display = 'none'; }
        });
        const emptyState = document.getElementById('emptySearchState');
        if(emptyState) emptyState.style.display = (!hasVisible && cards.length > 0) ? 'block' : 'none';
    });
}

// ==========================================
// 4. RECUPERO APPUNTI DA DATABASE
// ==========================================
function caricaAppunti(materia) {
    const container = document.getElementById('notesContainer');
    if(!container) return;
    container.innerHTML = `<div class="btn-loader" style="justify-content:flex-start; width:100%; grid-column:1/-1;"><div class="btn-spinner"></div><span style="font-weight:800; color:var(--text-gray); font-size:1.1rem; margin-left:10px;">Sincronizzazione archivio...</span></div>`;
    
    let query = db.collection('appunti');
    if (materia !== "Tutte" && materia !== "Preferiti") query = query.where('materia', '==', materia);

    query.get().then(snap => {
        container.innerHTML = '';
        let appuntiArray = [];
        snap.forEach(doc => appuntiArray.push({ id: doc.id, ...doc.data() }));

        if (materia === "Preferiti") {
            const favs = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');
            appuntiArray = appuntiArray.filter(item => favs.includes(item.id));
        }

        if (appuntiArray.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; grid-column: 1 / -1;"><h3 style="font-size: 1.5rem; color: var(--text-dark); font-weight: 800;">Cartella vuota</h3><p style="color: var(--text-gray); font-weight: 500;">Nessun file presente qui.</p></div>`;
            return;
        }

        window.mediaGallery = []; 
        let indexCard = 0; let indexMedia = 0;
        const oraAttuale = Date.now();
        const favsList = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');

        appuntiArray.sort((a, b) => b.data - a.data);

        appuntiArray.forEach(data => {
            const docId = data.id; 
            const fName = (data.nomeFile || "").toLowerCase();
            const isFav = favsList.includes(docId);
            const favClass = isFav ? 'fav-active' : '';
            
            let iconClass = 'icon-doc'; let badgeType = '<span class="badge-type badge-doc">DOC</span>';
            let isImage = false; let isVideo = false; let isDocument = false; let docType = '';
            let icon = '📄';
            
            if (fName.match(/\.pdf$/i)) { icon = '📕'; iconClass = 'icon-pdf'; badgeType = '<span class="badge-type badge-pdf">PDF</span>'; isDocument = true; docType = 'pdf'; }
            else if (fName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) { icon = '🖼️'; iconClass = 'icon-img'; isImage = true; badgeType = '<span class="badge-type badge-img">IMG</span>'; }
            else if (fName.match(/\.(mp4|mov|webm|mkv)$/i)) { icon = '🎥'; iconClass = 'icon-img'; isVideo = true; badgeType = '<span class="badge-type badge-vid">VIDEO</span>'; }
            else if (fName.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i)) { icon = '📘'; iconClass = 'icon-doc'; badgeType = '<span class="badge-type badge-doc">OFFICE</span>'; isDocument = true; docType = 'office'; }
            else if (fName.match(/\.(txt|csv|md|js|html|css|json)$/i)) { icon = '📝'; iconClass = 'icon-doc'; badgeType = '<span class="badge-type badge-doc" style="background:#e2e8f0; color:#0f172a;">TXT / CODE</span>'; isDocument = true; docType = 'text'; }
            else if (fName.match(/\.(zip|rar|7z)$/i)) { icon = '📦'; iconClass = 'icon-zip'; badgeType = '<span class="badge-type badge-zip">ZIP</span>'; }

            const isNew = (oraAttuale - data.data) < 86400000;
            const newBadgeHTML = isNew ? `<span class="badge-new">Nuovo</span>` : '';

            let currentItemMediaIndex = -1;
            if (isImage || isVideo || isDocument) {
                currentItemMediaIndex = indexMedia;
                window.mediaGallery.push({ url: data.urlFile, isVideo, isImage, isDocument, docType, titolo: data.titolo, blobUrl: null });
                indexMedia++;
            }

            let deleteBtnHTML = (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) ? `<button class="btn-delete" onclick="eliminaFile('${docId}', event)">Elimina</button>` : '';

            let visualMedia = `<div class="note-icon ${iconClass}" style="margin-bottom:15px; width:100%; transition:transform 0.2s; font-size:28px;" ${currentItemMediaIndex !== -1 ? `onclick="apriMediaViewer(${currentItemMediaIndex}, event)" style="cursor:pointer;"` : ''}>${icon}</div>`;
            if (isImage) visualMedia = `<img src="${data.urlFile}" class="img-preview" alt="${data.titolo}" onclick="apriMediaViewer(${currentItemMediaIndex}, event)" style="cursor:pointer; transition:transform 0.4s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">`;
            else if (isVideo) visualMedia = `<video src="${data.urlFile}" preload="metadata" class="img-preview" style="cursor:pointer; background:#000; object-fit:cover;" onclick="apriMediaViewer(${currentItemMediaIndex}, event)"></video>`;

            let actionBtn = (isImage || isVideo || isDocument) ? `<button class="btn-download" onclick="apriMediaViewer(${currentItemMediaIndex}, event)" style="width:100%; border:none; cursor:pointer; background: var(--primary-light); color: var(--primary);">Apri e Visualizza</button>` : `<a href="${data.urlFile}" target="_blank" class="btn-download" style="display:block;">Scarica File</a>`;
            const dataFormat = new Date(data.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

            const card = `
                <div class="note-card" style="animation-delay: ${indexCard * 0.05}s">
                    <div style="display:flex; justify-content:space-between; align-items:center; width: 100%; margin-bottom: 12px;">
                        ${badgeType}
                        <div style="display:flex; gap:8px;">
                            <button class="action-icon-btn" onclick="copiaLink('${data.urlFile}', event)" title="Condividi Link">🔗</button>
                            <button class="action-icon-btn ${favClass}" onclick="togglePreferito('${docId}', event)" title="Salva">⭐</button>
                        </div>
                    </div>
                    ${visualMedia}
                    <h3 class="note-title">${data.titolo} ${newBadgeHTML}</h3>
                    <p class="note-meta">${data.materia} • ${dataFormat}</p>
                    ${actionBtn}
                    ${deleteBtnHTML}
                </div>
            `;
            container.innerHTML += card;
            indexCard++;
        });
    }).catch(err => {
        container.innerHTML = `<p style="color:var(--danger); font-weight:700;">Errore: ${err.message}</p>`;
    });
}

window.eliminaFile = function(docId, ev) {
    if(ev) { ev.preventDefault(); ev.stopPropagation(); }
    if(confirm("Sei sicuro di voler eliminare questo file? L'azione è irreversibile.")) {
        db.collection('appunti').doc(docId).delete().then(() => {
            showToast("File eliminato con successo", "🗑️");
            const currentMateria = document.getElementById('titoloMateria').textContent;
            caricaAppunti(currentMateria === 'I Miei Preferiti' ? 'Preferiti' : (currentMateria === 'Tutti i file' ? 'Tutte' : currentMateria));
        }).catch(err => {
            showToast("Errore durante l'eliminazione", "❌");
            console.error(err);
        });
    }
};

// ==========================================
// 5. GESTIONE UPLOAD
// ==========================================

const btnUploadModal = document.getElementById('btnUploadModal');
if (btnUploadModal) {
    btnUploadModal.addEventListener('click', () => {
        const uploadModal = document.getElementById('uploadModal');
        if(uploadModal) uploadModal.classList.add('active');
        
        const progContainer = document.getElementById('progressContainer');
        if(progContainer) progContainer.style.display = 'none';
        
        const progBar = document.getElementById('progressBar');
        if(progBar) progBar.style.width = '0%';
        
        const statusEl = document.getElementById('uploadStatus');
        if(statusEl) statusEl.innerText = '';
        
        const fileInp = document.getElementById('upFile');
        if(fileInp) fileInp.value = '';
        
        const titInp = document.getElementById('upTitolo');
        if(titInp) titInp.value = '';
        
        const fnText = document.getElementById('fileNameText');
        if(fnText) fnText.innerText = '📁 Clicca qui per scegliere un file...';
        
        // Reset custom select
        materiaUploadSelezionata = "Informatica";
        const displayEl = document.getElementById('upload-materia-display');
        if(displayEl) displayEl.textContent = materiaUploadSelezionata;
    });
}

const btnChiudiUpload = document.getElementById('btnChiudiUpload');
if(btnChiudiUpload) {
    btnChiudiUpload.addEventListener('click', () => {
        const uploadModal = document.getElementById('uploadModal');
        if(uploadModal) uploadModal.classList.remove('active');
    });
}

const selectTrigger = document.querySelector('#upload-materia-select .custom-select-trigger');
if(selectTrigger) {
    selectTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('upload-materia-select').classList.toggle('open');
    });
}

document.querySelectorAll('#upload-materia-options .custom-option').forEach(opt => {
    opt.addEventListener('click', function(e) {
        e.stopPropagation();
        materiaUploadSelezionata = this.textContent.trim();
        document.getElementById('upload-materia-display').textContent = materiaUploadSelezionata;
        document.getElementById('upload-materia-select').classList.remove('open');
    });
});

document.addEventListener('click', () => {
    const select = document.getElementById('upload-materia-select');
    if(select) select.classList.remove('open');
});

const fileInput = document.getElementById('upFile');
if(fileInput) {
    fileInput.addEventListener('change', (e) => {
        const fileName = e.target.files[0] ? e.target.files[0].name : "📁 Clicca qui per scegliere un file...";
        document.getElementById('fileNameText').innerText = fileName;
    });
}

const btnSalva = document.getElementById('btnSalva');
if(btnSalva) {
    btnSalva.addEventListener('click', () => {
        const fileInp = document.getElementById('upFile');
        const titInp = document.getElementById('upTitolo');
        if(!fileInp || !titInp) return;
        
        const file = fileInp.files[0];
        const titolo = titInp.value.trim();
        if (!file || !titolo) {
            showToast("Inserisci titolo e seleziona un file", "⚠️");
            return;
        }

        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('uploadStatus').innerText = "Inizializzazione caricamento...";
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                document.getElementById('progressBar').style.width = percent + '%';
                document.getElementById('uploadStatus').innerText = `Caricamento: ${percent}%`;
            }
        };
        xhr.onload = () => {
            if (xhr.status === 200) {
                document.getElementById('uploadStatus').innerText = "Salvataggio nel database...";
                const downloadURL = JSON.parse(xhr.responseText).secure_url;
                db.collection('appunti').add({ 
                    titolo, 
                    materia: materiaUploadSelezionata, 
                    nomeFile: file.name, 
                    urlFile: downloadURL, 
                    data: Date.now() 
                })
                .then(() => {
                    document.getElementById('uploadModal').classList.remove('active');
                    showToast("File caricato con successo!", "☁️");
                    const currentMateria = document.getElementById('titoloMateria').textContent;
                    caricaAppunti(currentMateria === 'I Miei Preferiti' ? 'Preferiti' : (currentMateria === 'Tutti i file' ? 'Tutte' : currentMateria));
                }).catch(err => {
                    document.getElementById('uploadStatus').innerText = "Errore database.";
                    console.error(err);
                });
            } else {
                document.getElementById('uploadStatus').innerText = "Errore caricamento Cloudinary.";
            }
        };
        xhr.onerror = () => {
            document.getElementById('uploadStatus').innerText = "Errore di rete durante il caricamento.";
        };
        xhr.send(formData);
    });
}

// ==========================================
// 6. ANTEPRIMA MEDIA & BYPASS PDF NATIVO
// ==========================================
let currentMediaIndex = -1;

// Funzione Sicura per Bypass CORS e Formattazione File (MimeType)
async function fetchSafeBlob(url, mimeType = null) {
    try {
        let res = await fetch(url);
        if(!res.ok) throw new Error("Fetch failed");
        let blob = await res.blob();
        return mimeType ? new Blob([blob], { type: mimeType }) : blob;
    } catch(e) {
        let proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
        let res = await fetch(proxyUrl);
        let blob = await res.blob();
        return mimeType ? new Blob([blob], { type: mimeType }) : blob;
    }
}

window.apriMediaViewer = function(index, ev) {
    if(ev) { ev.preventDefault(); ev.stopPropagation(); }
    currentMediaIndex = index;
    aggiornaMediaViewer();
    document.getElementById('mediaViewerModal').classList.add('active');
};

async function aggiornaMediaViewer() {
    const container = document.getElementById('mediaContainer');
    const item = window.mediaGallery[currentMediaIndex];
    
    container.innerHTML = '<div class="btn-loader" style="color:white; z-index:1000;"><div class="btn-spinner" style="border-top-color:#fff;"></div><span style="font-weight:bold; margin-left:10px;">Caricamento file...</span></div>'; 
    
    const geminiBtn = document.getElementById('btnGemini');
    if (geminiBtn) {
        if (item.isImage || item.docType === 'pdf' || item.docType === 'text') {
            geminiBtn.style.display = 'flex';
            geminiBtn.onclick = () => chiediAGeminiAI(item);
        } else {
            geminiBtn.style.display = 'none';
        }
    }
    const geminiResContainer = document.getElementById('geminiResultContainer');
    if(geminiResContainer) geminiResContainer.style.display = 'none';

    if (item.isVideo) {
        container.innerHTML = `<video src="${item.url}" controls autoplay class="viewer-media-item" style="box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 16px; pointer-events:auto; max-width:900px; width:100%;"></video>`;
    } else if (item.isImage) {
        container.innerHTML = `<img src="${item.url}" class="viewer-media-item" alt="${item.titolo}" style="pointer-events:auto; box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 16px; max-height:85vh; max-width:90vw; object-fit:contain;">`;
    } else if (item.isDocument) {
        if (item.docType === 'pdf') {
            try {
                let blobUrl = item.blobUrl;
                if(!blobUrl) {
                    const blob = await fetchSafeBlob(item.url, 'application/pdf'); // BLINDATO PER IL TIPO PDF (Previene download forzati)
                    blobUrl = URL.createObjectURL(blob);
                    window.mediaGallery[currentMediaIndex].blobUrl = blobUrl;
                }
                container.innerHTML = `<iframe src="${blobUrl}#view=FitH" style="width: 100%; height: 85vh; max-width: 1200px; background: white; border: none; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); pointer-events:auto;"></iframe>`;
            } catch(e) {
                container.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(item.url)}&embedded=true" style="width: 100%; height: 85vh; max-width: 1200px; background: white; border: none; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); pointer-events:auto;"></iframe>`;
            }
        } else if (item.docType === 'office') {
            container.innerHTML = `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.url)}" style="width: 100%; height: 85vh; max-width: 1200px; background: white; border: none; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); pointer-events:auto;"></iframe>`;
        } else if (item.docType === 'text') {
            try {
                const b = await fetchSafeBlob(item.url);
                const txt = await b.text();
                const safeTxt = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                container.innerHTML = `<div style="width: 100%; height: 85vh; max-width: 1000px; background: #1e293b; border-radius: 16px; padding: 25px; overflow-y: auto; text-align: left; box-sizing: border-box; box-shadow: 0 30px 60px rgba(0,0,0,0.5); pointer-events:auto;"><pre style="white-space: pre-wrap; font-family: monospace; color: #f8fafc; font-size: 1rem; line-height: 1.5; margin: 0;">${safeTxt}</pre></div>`;
            } catch(e) {
                container.innerHTML = `<div style="color:white;">Errore nel caricamento del file di testo.</div>`;
            }
        }
    }

    const mostraFrecce = window.mediaGallery.length > 1 ? 'flex' : 'none';
    const btnPrev = document.getElementById('btnPrevMedia');
    const btnNext = document.getElementById('btnNextMedia');
    if(btnPrev) btnPrev.style.display = mostraFrecce;
    if(btnNext) btnNext.style.display = mostraFrecce;
}

// ==========================================
// 7. VERA INTEGRAZIONE CHAT GEMINI AI
// ==========================================
window.chiediAGeminiAI = async function(item) {
    const geminiBtn = document.getElementById('btnGemini');
    const resContainer = document.getElementById('geminiResultContainer');
    const resText = document.getElementById('geminiResultText');
    
    if (GEMINI_API_KEY === "INSERISCI_QUI_LA_TUA_CHIAVE" || !GEMINI_API_KEY) {
        resText.innerHTML = "⚠️ <strong>CHIAVE API GEMINI MANCANTE</strong><br><br>Per far funzionare l'Intelligenza Artificiale devi inserire la tua chiave gratuita nel file <code>dashboard.js</code> alla riga 6.<br><br><a href='https://aistudio.google.com/app/apikey' target='_blank' style='color:#8b5cf6; text-decoration:underline;'>Clicca qui per ottenerne una gratis da Google.</a>";
        resContainer.style.display = 'block';
        return;
    }

    const origHtml = geminiBtn.innerHTML;
    geminiBtn.innerHTML = '<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:#8b5cf6; margin-right:8px;"></div> Lettura Testo...';
    geminiBtn.disabled = true;

    try {
        let extractedText = "";

        if (item.isImage) {
            const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(item.url);
            const result = await Tesseract.recognize(proxyUrl, 'ita+eng', { logger: m => { if (m.status === 'recognizing text') geminiBtn.innerHTML = `<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:#8b5cf6; margin-right:8px;"></div> Scansione Foto ${Math.round(m.progress * 100)}%`; }});
            extractedText = result.data.text;
        } else if (item.docType === 'pdf') {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            const pdfUrlToUse = item.blobUrl || "https://api.allorigins.win/raw?url=" + encodeURIComponent(item.url);
            const pdf = await pdfjsLib.getDocument(pdfUrlToUse).promise;
            for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { 
                geminiBtn.innerHTML = `<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:#8b5cf6; margin-right:8px;"></div> Lettura PDF Pag. ${i}/${pdf.numPages}`;
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                extractedText += content.items.map(t => t.str).join(' ') + '\n\n';
            }
        } else if (item.docType === 'text') {
            const b = await fetchSafeBlob(item.url);
            extractedText = await b.text();
        }

        if (!extractedText || extractedText.trim() === '') throw new Error("Testo vuoto o illeggibile.");

        geminiBtn.innerHTML = '<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:#8b5cf6; margin-right:8px;"></div> Gemini sta scrivendo...';
        
        const promptPersonale = "Sei un tutor avanzato per studenti dell'ITIS Amedeo Avogadro. Di seguito ti fornisco un testo estratto dai miei appunti scolastici. Analizzalo attentamente, fanne un riassunto chiaro, spiegami i concetti principali in modo facile da capire e usa grassetti e liste puntate per formattare la tua risposta. Ecco gli appunti:\n\n" + extractedText;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptPersonale }] }] })
        });

        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let aiText = data.candidates[0].content.parts[0].text;
        
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        aiText = aiText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        aiText = aiText.replace(/\n/g, '<br>');

        resText.innerHTML = aiText;
        resContainer.style.display = 'block';

    } catch (err) {
        console.error("Errore AI:", err);
        showToast("Errore di comunicazione con l'IA o file illeggibile.", "⚠️");
    } finally {
        geminiBtn.innerHTML = origHtml;
        geminiBtn.disabled = false;
    }
}

window.copiaRispostaGemini = function() {
    const text = document.getElementById('geminiResultText').innerText;
    navigator.clipboard.writeText(text).then(() => showToast("Risposta copiata negli appunti!", "✨"));
};

// ==========================================
// CONTROLLI UI MODALE E FRECCE
// ==========================================
window.cambiaMedia = function(direzione) {
    if (direzione === 'next') currentMediaIndex = (currentMediaIndex + 1) % window.mediaGallery.length;
    else currentMediaIndex = (currentMediaIndex - 1 + window.mediaGallery.length) % window.mediaGallery.length;
    aggiornaMediaViewer();
};

const btnNextMedia = document.getElementById('btnNextMedia');
if(btnNextMedia) btnNextMedia.addEventListener('click', () => cambiaMedia('next'));

const btnPrevMedia = document.getElementById('btnPrevMedia');
if(btnPrevMedia) btnPrevMedia.addEventListener('click', () => cambiaMedia('prev'));

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('mediaViewerModal');
    if (modal && modal.classList.contains('active')) {
        if (e.key === 'ArrowRight' && window.mediaGallery.length > 1) cambiaMedia('next');
        if (e.key === 'ArrowLeft' && window.mediaGallery.length > 1) cambiaMedia('prev');
        if (e.key === 'Escape') {
            const btnChiudi = document.getElementById('btnChiudiViewer');
            if(btnChiudi) btnChiudi.click();
        }
    }
});

const btnChiudiViewer = document.getElementById('btnChiudiViewer');
if(btnChiudiViewer) {
    btnChiudiViewer.addEventListener('click', () => {
        document.getElementById('mediaContainer').innerHTML = ''; 
        document.getElementById('mediaViewerModal').classList.remove('active');
        document.getElementById('geminiResultContainer').style.display = 'none';
    });
}
