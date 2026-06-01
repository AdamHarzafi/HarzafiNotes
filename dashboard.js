/* ============================================================
   dashboard.js — Dashboard Harzafi Notes (PRO Edition with OCR & PDF Fix)
   ============================================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfakiLT7-0A",
    authDomain: "harzafi-notes.firebaseapp.com",
    projectId: "harzafi-notes",
    messagingSenderId: "35834921638",
    appId: "1:35834921638:web:cb5d8d612b4a2936126a67"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
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
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('btnUploadModal').style.display = 'block';
        }
        
        const profilePicEl = document.getElementById('userProfilePic');
        if (profilePicEl) {
            if (user.photoURL) {
                let highResPhoto = user.photoURL;
                if (highResPhoto.includes("=s96-c")) highResPhoto = highResPhoto.replace("=s96-c", "=s150-c");
                profilePicEl.src = highResPhoto;
            } else {
                profilePicEl.src = "IMMAGINI/PROFILO-UTENTE-LOGO.png";
            }
            profilePicEl.onerror = function() { this.src = "IMMAGINI/PROFILO-UTENTE-LOGO.png"; };
        }

        impostaSalutoDinamico(user);
        caricaAppunti('Tutte');
    }
});

function impostaSalutoDinamico(user) {
    const hour = new Date().getHours();
    let greetText = "Buongiorno";
    let greetEmoji = "☀️";
    
    if (hour >= 5 && hour < 13) { greetText = "Buongiorno"; greetEmoji = "☀️"; }
    else if (hour >= 13 && hour < 18) { greetText = "Buon pomeriggio"; greetEmoji = "☕"; }
    else { greetText = "Buonasera"; greetEmoji = "🌙"; }
    
    let name = "Studente";
    const sessionName = sessionStorage.getItem('harzafi_user');
    if (sessionName && sessionName !== "Utente") name = sessionName.split(" ")[0];
    else if (user && user.displayName) name = user.displayName.split(" ")[0];
    
    document.getElementById('greetingText').innerHTML = `
        <span class="animated-gradient-text">${greetText}</span>
        <span style="font-size: 1.1em; line-height: 1;">${greetEmoji}</span>
        <span class="animated-gradient-text">, ${name}</span>
    `;
    
    document.getElementById('userNameDisplay').textContent = name;
}

document.getElementById('btnEsci').addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = "login.html");
});

// ==========================================
// 2. FUNZIONI UTILI (TOAST, COPIA, PREFERITI)
// ==========================================
function showToast(message, icon = "✅") {
    const toast = document.getElementById('globalToast');
    toast.innerHTML = `${icon} ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.copiaLink = function(url, ev) {
    ev.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        showToast("Link copiato negli appunti!", "🔗");
    }).catch(() => {
        showToast("Errore durante la copia.", "⚠️");
    });
};

window.togglePreferito = function(docId, ev) {
    ev.stopPropagation();
    let favs = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');
    const btn = ev.currentTarget;
    
    if (favs.includes(docId)) {
        favs = favs.filter(id => id !== docId);
        btn.classList.remove('fav-active');
        showToast("Rimosso dai preferiti", "❌");
        if (document.getElementById('titoloMateria').textContent === 'I Miei Preferiti') {
            caricaAppunti('Preferiti');
        }
    } else {
        favs.push(docId);
        btn.classList.add('fav-active');
        showToast("Salvato nei preferiti!", "⭐");
    }
    
    localStorage.setItem('harzafi_favs', JSON.stringify(favs));
};

// ==========================================
// 3. FUNZIONE RICERCA E FILTRO MATERIA
// ==========================================
window.filtraMateria = function(materia) {
    document.querySelectorAll('.materia-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    document.getElementById('titoloMateria').textContent = materia === 'Preferiti' ? 'I Miei Preferiti' : (materia === 'Tutte' ? 'Tutti i file' : materia);
    
    document.getElementById('searchNotes').value = "";
    document.getElementById('emptySearchState').style.display = 'none';
    
    caricaAppunti(materia);
};

document.getElementById('searchNotes').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.note-card');
    let hasVisible = false;

    cards.forEach(card => {
        const title = card.querySelector('.note-title').textContent.toLowerCase();
        const meta = card.querySelector('.note-meta').textContent.toLowerCase();
        
        if (title.includes(term) || meta.includes(term)) {
            card.style.display = 'flex';
            hasVisible = true;
        } else {
            card.style.display = 'none';
        }
    });

    document.getElementById('emptySearchState').style.display = (!hasVisible && cards.length > 0) ? 'block' : 'none';
});

// ==========================================
// 4. RECUPERO E RENDER APPUNTI
// ==========================================
function caricaAppunti(materia) {
    const container = document.getElementById('notesContainer');
    container.innerHTML = `<div class="btn-loader" style="justify-content:flex-start; width:100%; grid-column:1/-1;"><div class="btn-spinner"></div><span style="font-weight:800; color:var(--text-gray); font-size:1.1rem; margin-left:10px;">Sincronizzazione archivio...</span></div>`;
    
    let query = db.collection('appunti');
    
    if (materia !== "Tutte" && materia !== "Preferiti") {
        query = query.where('materia', '==', materia);
    }

    query.get().then(snap => {
        container.innerHTML = '';
        
        let appuntiArray = [];
        snap.forEach(doc => appuntiArray.push({ id: doc.id, ...doc.data() }));

        if (materia === "Preferiti") {
            const favs = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');
            appuntiArray = appuntiArray.filter(item => favs.includes(item.id));
        }

        if (appuntiArray.length === 0) {
            const emptyMsg = materia === "Preferiti" ? "Non hai ancora salvato nessun appunto tra i preferiti." : "Nessun file presente per questa materia.";
            container.innerHTML = `<div style="text-align:center; padding: 40px; grid-column: 1 / -1;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="1.5" style="width: 80px; margin-bottom: 20px;"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"></path></svg><h3 style="font-size: 1.5rem; color: var(--text-dark); font-weight: 800;">Cartella vuota</h3><p style="color: var(--text-gray); font-weight: 500;">${emptyMsg}</p></div>`;
            return;
        }

        window.mediaGallery = []; 
        let indexCard = 0;
        let indexMedia = 0;
        const oraAttuale = Date.now();
        const favsList = JSON.parse(localStorage.getItem('harzafi_favs') || '[]');

        appuntiArray.sort((a, b) => b.data - a.data);

        appuntiArray.forEach(data => {
            const docId = data.id; 
            const fName = (data.nomeFile || "").toLowerCase();
            const isFav = favsList.includes(docId);
            const favClass = isFav ? 'fav-active' : '';
            
            const iconPDF = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
            const iconIMG = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
            const iconZIP = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-4v4h-2v-4H9v-2h4V8h2v4h4v2z"/></svg>`;
            const iconDOC = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
            const iconVID = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;

            let icon = iconDOC; let iconClass = 'icon-doc'; let badgeType = '<span class="badge-type badge-doc">DOC</span>';
            let isImage = false; let isVideo = false; let isDocument = false; let docType = '';
            
            if (fName.includes('.pdf')) { icon = iconPDF; iconClass = 'icon-pdf'; badgeType = '<span class="badge-type badge-pdf">PDF</span>'; isDocument = true; docType = 'pdf'; }
            else if (fName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) { icon = iconIMG; iconClass = 'icon-img'; isImage = true; badgeType = '<span class="badge-type badge-img">IMG</span>'; }
            else if (fName.match(/\.(mp4|mov|webm|mkv)$/i)) { icon = iconVID; iconClass = 'icon-img'; isVideo = true; badgeType = '<span class="badge-type badge-vid">VIDEO</span>'; }
            else if (fName.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i)) { icon = iconDOC; iconClass = 'icon-doc'; badgeType = '<span class="badge-type badge-doc">OFFICE</span>'; isDocument = true; docType = 'office'; }
            else if (fName.match(/\.(txt|csv|md|js|html|css|json)$/i)) { icon = iconDOC; iconClass = 'icon-doc'; badgeType = '<span class="badge-type badge-doc" style="background:#e2e8f0; color:#0f172a;">TXT / CODE</span>'; isDocument = true; docType = 'text'; }
            else if (fName.match(/\.(zip|rar|7z)$/i)) { icon = iconZIP; iconClass = 'icon-zip'; badgeType = '<span class="badge-type badge-zip">ZIP</span>'; }

            const isNew = (oraAttuale - data.data) < 86400000;
            const newBadgeHTML = isNew ? `<span class="badge-new">Nuovo</span>` : '';

            let currentItemMediaIndex = -1;
            if (isImage || isVideo || isDocument) {
                currentItemMediaIndex = indexMedia;
                window.mediaGallery.push({ url: data.urlFile, isVideo: isVideo, isImage: isImage, isDocument: isDocument, docType: docType, titolo: data.titolo });
                indexMedia++;
            }

            let deleteBtnHTML = '';
            if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
                deleteBtnHTML = `<button class="btn-delete" onclick="eliminaFile('${docId}')">Elimina Appunto</button>`;
            }

            let visualMedia = '';
            if (isImage) {
                visualMedia = `<img src="${data.urlFile}" class="img-preview" alt="${data.titolo}" onclick="apriMediaViewer(${currentItemMediaIndex})" style="cursor:pointer; transition:transform 0.4s var(--apple-ease);" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">`;
            } else if (isVideo) {
                visualMedia = `<video src="${data.urlFile}" preload="metadata" class="img-preview" style="cursor:pointer; background:#000; object-fit:cover;" onclick="apriMediaViewer(${currentItemMediaIndex})"></video>`;
            } else {
                const clickable = currentItemMediaIndex !== -1 ? `onclick="apriMediaViewer(${currentItemMediaIndex})" style="cursor:pointer;"` : '';
                visualMedia = `<div class="note-icon ${iconClass}" style="margin-bottom:15px; width:100%; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" ${clickable}>${icon}</div>`;
            }

            let actionBtn = (isImage || isVideo || isDocument) 
                ? `<button class="btn-download" onclick="apriMediaViewer(${currentItemMediaIndex})" style="width:100%; border:none; cursor:pointer; background: var(--primary-light); color: var(--primary);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; margin-right:6px; vertical-align:text-bottom;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Apri e Visualizza</button>` 
                : `<a href="${data.urlFile}" target="_blank" rel="noopener noreferrer" class="btn-download" style="display:block;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; margin-right:6px; vertical-align:text-bottom;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Scarica File</a>`;

            const dataFormat = new Date(data.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

            const card = `
                <div class="note-card" style="animation-delay: ${indexCard * 0.05}s">
                    <div style="display:flex; justify-content:space-between; align-items:center; width: 100%; margin-bottom: 12px;">
                        ${badgeType}
                        <div style="display:flex; gap:8px;">
                            <button class="action-icon-btn" onclick="copiaLink('${data.urlFile}', event)" title="Condividi Link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                                    <polyline points="16 6 12 2 8 6"/>
                                    <line x1="12" y1="2" x2="12" y2="15"/>
                                </svg>
                            </button>
                            <button class="action-icon-btn ${favClass}" onclick="togglePreferito('${docId}', event)" title="Salva nei preferiti">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="18"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                            </button>
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
        console.error("ERRORE FIRESTORE:", err);
        container.innerHTML = `<p style="color:var(--danger); font-weight:700;">Errore di sistema: ${err.message}</p>`;
    });
}

window.eliminaFile = function(docId) {
    if(confirm("Sei sicuro di voler eliminare questo file dall'archivio dell'intera classe?")) {
        db.collection('appunti').doc(docId).delete().then(() => {
            const materiaAttuale = document.getElementById('titoloMateria').innerText === 'Tutti i file' ? 'Tutte' : document.getElementById('titoloMateria').innerText;
            caricaAppunti(materiaAttuale);
        }).catch(err => alert("Errore durante l'eliminazione"));
    }
};

// ==========================================
// 5. GESTIONE UPLOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.querySelector('#upload-materia-select .custom-select-trigger');
    const options = document.querySelectorAll('#upload-materia-options .custom-option');
    const display = document.getElementById('upload-materia-display');
    const customSelect = document.getElementById('upload-materia-select');

    if(trigger) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
        });

        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                display.innerText = opt.innerText;
                materiaUploadSelezionata = opt.innerText; 
                customSelect.classList.remove('open');
            });
        });

        document.addEventListener('click', () => customSelect.classList.remove('open'));
    }
});

document.getElementById('btnUploadModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('active');
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('uploadStatus').innerText = '';
});

document.getElementById('btnChiudiUpload').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.remove('active');
});

const fileInput = document.getElementById('upFile');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const fileName = e.target.files[0] ? e.target.files[0].name : "📁 Clicca qui per scegliere un file...";
        document.getElementById('fileNameText').innerText = fileName;
    });
}

document.getElementById('btnSalva').addEventListener('click', () => {
    const file = document.getElementById('upFile').files[0];
    const titolo = document.getElementById('upTitolo').value.trim();
    const materia = materiaUploadSelezionata; 
    const status = document.getElementById('uploadStatus');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    if (!file || !titolo) {
        status.innerText = "Inserisci un titolo e seleziona un file!";
        return;
    }

    progressContainer.style.display = 'block';
    status.innerText = "Connessione al Cloud...";
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            status.innerText = `Caricamento: ${percent}%`;
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            const downloadURL = response.secure_url;
            
            status.innerText = "Salvataggio in corso nel Database...";

            db.collection('appunti').add({
                titolo: titolo,
                materia: materia,
                nomeFile: file.name,
                urlFile: downloadURL,
                data: Date.now()
            }).then(() => {
                document.getElementById('uploadModal').classList.remove('active');
                document.getElementById('upTitolo').value = '';
                document.getElementById('upFile').value = '';
                document.getElementById('fileNameText').innerText = "📁 Clicca qui per scegliere un file...";
                
                showToast("File caricato con successo!", "☁️");
                caricaAppunti('Tutte');
            }).catch((error) => {
                console.error("Firestore error:", error);
                status.innerText = "Errore database.";
            });
        } else {
            console.error("Cloudinary error:", xhr.responseText);
            status.innerText = "Errore upload.";
            progressContainer.style.display = 'none';
        }
    };

    xhr.send(formData);
});

// ==========================================
// 6. ANTEPRIMA MULTIMEDIALE, DOCUMENTI & OCR
// ==========================================
let currentMediaIndex = -1;

window.apriMediaViewer = function(index) {
    currentMediaIndex = index;
    aggiornaMediaViewer();
    document.getElementById('mediaViewerModal').classList.add('active');
};

function aggiornaMediaViewer() {
    const container = document.getElementById('mediaContainer');
    const item = window.mediaGallery[currentMediaIndex];
    
    container.innerHTML = '<div class="btn-loader" style="color:white;"><div class="btn-spinner" style="border-top-color:#fff;"></div></div>'; 
    
    // Gestione Pulsante Estrazione Testo
    const ocrBtn = document.getElementById('btnEstraiTesto');
    if (item.isImage || item.docType === 'pdf' || item.docType === 'text' || item.docType === 'office') {
        ocrBtn.style.display = 'flex';
        ocrBtn.onclick = () => eseguiEstrazioneTesto(item.url, item.isImage, item.isDocument, item.docType);
    } else {
        ocrBtn.style.display = 'none';
    }
    
    document.getElementById('ocrResultContainer').style.display = 'none';

    setTimeout(() => {
        if (item.isVideo) {
            container.innerHTML = `<video src="${item.url}" controls autoplay class="viewer-media-item viewer-video" style="box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 16px;"></video>`;
        } else if (item.isImage) {
            container.innerHTML = `<img src="${item.url}" class="viewer-media-item" alt="${item.titolo}" crossorigin="anonymous">`;
        } else if (item.isDocument) {
            if (item.docType === 'pdf') {
                // FIX: Utilizzo di Google Docs Viewer per bypassare il blocco iFrame di Chrome
                container.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(item.url)}&embedded=true" class="viewer-media-item" style="width: 100%; height: 85vh; max-width: 1200px; background: white; border: none; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5);"></iframe>`;
            } else if (item.docType === 'office') {
                // Utilizzo di Office Live Viewer per documenti Office
                container.innerHTML = `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.url)}" class="viewer-media-item" style="width: 100%; height: 85vh; max-width: 1200px; background: white; border: none; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5);"></iframe>`;
            } else if (item.docType === 'text') {
                fetch(item.url).then(res => res.text()).then(txt => {
                    const safeTxt = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    container.innerHTML = `<div class="viewer-media-item" style="width: 100%; height: 85vh; max-width: 1000px; background: #1e293b; border-radius: 16px; padding: 25px; overflow-y: auto; text-align: left; box-sizing: border-box; box-shadow: 0 30px 60px rgba(0,0,0,0.5);"><pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; color: #f8fafc; font-size: 1rem; line-height: 1.5; margin: 0;">${safeTxt}</pre></div>`;
                }).catch(err => {
                    container.innerHTML = `<div style="color: white; font-weight: 800;">Errore nel caricamento del file di testo.</div>`;
                });
            }
        }
    }, 100);

    const mostraFrecce = window.mediaGallery.length > 1 ? 'flex' : 'none';
    document.getElementById('btnPrevMedia').style.display = mostraFrecce;
    document.getElementById('btnNextMedia').style.display = mostraFrecce;
}

// LOGICA ESTRAZIONE TESTO (AI E OCR)
window.eseguiEstrazioneTesto = async function(url, isImage, isDocument, docType) {
    const ocrBtn = document.getElementById('btnEstraiTesto');
    const origHtml = ocrBtn.innerHTML;
    ocrBtn.innerHTML = '<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></div> Analisi AI in corso...';
    ocrBtn.disabled = true;

    try {
        let extractedText = "";

        if (isImage) {
            const result = await Tesseract.recognize(url, 'ita+eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        ocrBtn.innerHTML = `<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></div> ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            extractedText = result.data.text;
        } else if (isDocument && docType === 'pdf') {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument(url).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                ocrBtn.innerHTML = `<div class="btn-spinner" style="width:18px; height:18px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></div> Pagina ${i}/${pdf.numPages}`;
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                extractedText += content.items.map(item => item.str).join(' ') + '\n\n';
            }
        } else if (isDocument && docType === 'text') {
            const res = await fetch(url);
            extractedText = await res.text();
        } else if (isDocument && docType === 'office') {
            alert("Per i file di Word, Excel o PowerPoint, usa il cursore per selezionare tutto il testo che desideri direttamente dal visualizzatore che vedi a schermo, quindi premi Tasto Destro -> Copia (o Ctrl+C).");
            ocrBtn.innerHTML = origHtml;
            ocrBtn.disabled = false;
            return;
        }

        if (!extractedText || extractedText.trim() === '') {
            extractedText = "Nessun testo rilevato nel documento dall'AI.";
        }

        document.getElementById('ocrResultText').value = extractedText;
        document.getElementById('ocrResultContainer').style.display = 'block';

    } catch (err) {
        console.error("Errore estrazione:", err);
        showToast("Errore durante l'estrazione del testo", "⚠️");
    } finally {
        ocrBtn.innerHTML = origHtml;
        ocrBtn.disabled = false;
    }
}

window.copiaTestoOCR = function() {
    const text = document.getElementById('ocrResultText').value;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Testo copiato con successo!", "📋");
        document.getElementById('ocrResultContainer').style.display = 'none';
    }).catch(() => {
        showToast("Impossibile copiare il testo", "⚠️");
    });
};

window.cambiaMedia = function(direzione) {
    const container = document.getElementById('mediaContainer');
    const elemento = container.querySelector('.viewer-media-item');
    
    if(elemento) elemento.classList.add('media-switching');

    setTimeout(() => {
        if (direzione === 'next') {
            currentMediaIndex = (currentMediaIndex + 1) % window.mediaGallery.length;
        } else {
            currentMediaIndex = (currentMediaIndex - 1 + window.mediaGallery.length) % window.mediaGallery.length;
        }
        aggiornaMediaViewer();
    }, 250); 
};

document.getElementById('btnNextMedia').addEventListener('click', () => cambiaMedia('next'));
document.getElementById('btnPrevMedia').addEventListener('click', () => cambiaMedia('prev'));

document.addEventListener('keydown', (e) => {
    if (document.getElementById('mediaViewerModal').classList.contains('active')) {
        if (e.key === 'ArrowRight' && window.mediaGallery.length > 1) cambiaMedia('next');
        if (e.key === 'ArrowLeft' && window.mediaGallery.length > 1) cambiaMedia('prev');
        if (e.key === 'Escape') document.getElementById('btnChiudiViewer').click();
    }
});

document.getElementById('btnChiudiViewer').addEventListener('click', () => {
    document.getElementById('mediaContainer').innerHTML = ''; 
    document.getElementById('mediaViewerModal').classList.remove('active');
    document.getElementById('ocrResultContainer').style.display = 'none';
});
