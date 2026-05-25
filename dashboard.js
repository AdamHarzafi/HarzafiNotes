/* ============================================================
   dashboard.js — Dashboard Harzafi Notes
   ============================================================ */

// CREDENZIALI CORRETTE (IDENTICHE AL LOGIN.JS)
const firebaseConfig = {
    apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfakiLT7-0A",
    authDomain: "adamharzafi.github.io",
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

auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('btnUploadModal').style.display = 'block';
        }
        caricaAppunti('Tutte');
    }
});

document.getElementById('btnEsci').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
});

window.filtraMateria = function(materia) {
    document.querySelectorAll('.materia-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('titoloMateria').textContent = materia === 'Tutte' ? 'Tutti i file' : materia;
    caricaAppunti(materia);
};

function caricaAppunti(materia) {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '<div class="btn-loader" style="justify-content:flex-start; margin-top:20px;"><div class="btn-spinner"></div><span style="font-weight:700; color:var(--text-gray);">Sincronizzazione file...</span></div>';
    
    let query = db.collection('appunti').orderBy('data', 'desc');
    if (materia !== "Tutte") query = query.where('materia', '==', materia);

    query.get().then(snap => {
        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = '<p style="color:var(--text-light); font-weight:700;">Nessun file presente per questa materia.</p>';
            return;
        }

        window.mediaGallery = []; 
        let indexCard = 0;
        let indexMedia = 0;

        snap.forEach(doc => {
            const data = doc.data();
            const docId = doc.id; 
            const fName = (data.nomeFile || "").toLowerCase();
            
            const iconPDF = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
            const iconIMG = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
            const iconZIP = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-4v4h-2v-4H9v-2h4V8h2v4h4v2z"/></svg>`;
            const iconDOC = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
            const iconVID = `<svg viewBox="0 0 24 24" fill="currentColor" width="28"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;

            let icon = iconDOC; let iconClass = 'icon-doc';
            let isImage = false; let isVideo = false;
            
            if (fName.includes('.pdf')) { icon = iconPDF; iconClass = 'icon-pdf'; }
            else if (fName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) { icon = iconIMG; iconClass = 'icon-img'; isImage = true; }
            else if (fName.match(/\.(mp4|mov|webm|mkv)$/i)) { icon = iconVID; iconClass = 'icon-img'; isVideo = true; }
            else if (fName.match(/\.(zip|rar|7z)$/i)) { icon = iconZIP; iconClass = 'icon-zip'; }

            let currentItemMediaIndex = -1;
            if (isImage || isVideo) {
                currentItemMediaIndex = indexMedia;
                window.mediaGallery.push({ url: data.urlFile, isVideo: isVideo, titolo: data.titolo });
                indexMedia++;
            }

            let deleteBtnHTML = '';
            if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
                deleteBtnHTML = `<button class="btn-delete" onclick="eliminaFile('${docId}')">Elimina Appunto</button>`;
            }

            let visualMedia = '';
            if (isImage) {
                visualMedia = `<img src="${data.urlFile}" class="img-preview" alt="${data.titolo}" onclick="apriMediaViewer(${currentItemMediaIndex})" style="cursor:pointer; transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">`;
            } else if (isVideo) {
                visualMedia = `<video src="${data.urlFile}" preload="metadata" class="img-preview" style="cursor:pointer; background:#000; object-fit:cover;" onclick="apriMediaViewer(${currentItemMediaIndex})"></video>`;
            } else {
                visualMedia = `<div class="note-icon ${iconClass}">${icon}</div>`;
            }

            let actionBtn = '';
            if (isImage || isVideo) {
                actionBtn = `<button class="btn-download" onclick="apriMediaViewer(${currentItemMediaIndex})" style="width:100%; border:none; cursor:pointer; background: var(--primary-light); color: var(--primary);">Apri</button>`;
            } else {
                actionBtn = `<a href="${data.urlFile}" target="_blank" rel="noopener noreferrer" class="btn-download" style="display:block;">↓ Scarica File</a>`;
            }

            const card = `
                <div class="note-card" style="animation-delay: ${indexCard * 0.05}s">
                    ${visualMedia}
                    <h3 class="note-title">${data.titolo}</h3>
                    <p class="note-meta">${data.materia} • ${new Date(data.data).toLocaleDateString('it-IT')}</p>
                    ${actionBtn}
                    ${deleteBtnHTML}
                </div>
            `;
            container.innerHTML += card;
            indexCard++;
        });
    }).catch(err => {
        container.innerHTML = '<p style="color:var(--danger); font-weight:700;">Errore di connessione a Firestore.</p>';
    });
}

window.eliminaFile = function(docId) {
    if(confirm("Sei sicuro di voler eliminare questo appunto per tutta la classe?")) {
        db.collection('appunti').doc(docId).delete().then(() => {
            const materiaAttuale = document.getElementById('titoloMateria').innerText === 'Tutti i file' ? 'Tutte' : document.getElementById('titoloMateria').innerText;
            caricaAppunti(materiaAttuale);
        }).catch(err => alert("Errore durante l'eliminazione"));
    }
};

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
    const materia = materiaUploadSelezionata; // PRENDE LA TENDINA BELLA
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
// LETTORE MULTIMEDIALE & GALLERIA 
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
    
    container.innerHTML = ''; 
    
    setTimeout(() => {
        if (item.isVideo) {
            container.innerHTML = `<video src="${item.url}" controls autoplay class="viewer-media-item viewer-video"></video>`;
        } else {
            container.innerHTML = `<img src="${item.url}" class="viewer-media-item" alt="${item.titolo}">`;
        }
    }, 10);

    const mostraFrecce = window.mediaGallery.length > 1 ? 'flex' : 'none';
    document.getElementById('btnPrevMedia').style.display = mostraFrecce;
    document.getElementById('btnNextMedia').style.display = mostraFrecce;
}

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
});
