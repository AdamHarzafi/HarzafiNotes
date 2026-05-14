// Questo script va SOLO in dashboard.html. Il login usa login.js!

const firebaseConfig = {
    apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfaklT7-0A",
    authDomain: "harzafi-notes.firebaseapp.com",
    projectId: "harzafi-notes",
    messagingSenderId: "35834921638",
    appId: "1:35834921638:web:cb5d8d612b4a2936126a67"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// CLOUDINARY
const CLOUDINARY_CLOUD_NAME = "dxttlpg0g"; 
const CLOUDINARY_UPLOAD_PRESET = "harzafi_notes"; 

// 🚨 ADMIN EMAIL
const ADMIN_EMAIL = "INSERISCI_LA_TUA_EMAIL@studenti.itisavogadro.it";

// Testo Input File
const fileInput = document.getElementById('upFile');
if(fileInput) {
    fileInput.addEventListener('change', (e) => {
        const fileName = e.target.files[0] ? e.target.files[0].name : "📁 Clicca qui per scegliere un file...";
        document.getElementById('fileNameText').innerText = fileName;
    });
}

if(document.getElementById('notesContainer')) {
    
    // Controlla il login
    auth.onAuthStateChanged(user => {
        if (user) {
            // MOSTRA IL PULSANTE DI CARICAMENTO SOLO SE L'EMAIL È ADMIN_EMAIL
            if(user.email === ADMIN_EMAIL) {
                document.getElementById('btnUploadModal').style.display = 'block';
            }
            caricaAppunti("Tutte");
        } else {
            window.location.href = "login.html"; // Redirect se non loggati
        }
    });

    document.getElementById('btnEsci').addEventListener('click', () => { auth.signOut(); });

    // Filtra Materia
    window.filtraMateria = function(materia) {
        document.querySelectorAll('.materia-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
        document.getElementById('titoloMateria').innerText = materia === 'Tutte' ? 'Tutti i file' : materia;
        caricaAppunti(materia);
    }

    function caricaAppunti(materia) {
        const container = document.getElementById('notesContainer');
        container.innerHTML = '<p style="color:var(--text-light); font-weight:700;">Recupero file dal server...</p>';
        
        let query = db.collection('appunti').orderBy('data', 'desc');
        if(materia !== "Tutte") query = query.where('materia', '==', materia);

        query.get().then(snap => {
            container.innerHTML = '';
            if(snap.empty) {
                container.innerHTML = '<p style="color:var(--text-light); font-weight:700;">Nessun file presente per questa materia.</p>';
                return;
            }

            let index = 0;
            snap.forEach(doc => {
                const data = doc.data();
                
                let icon = '📄'; let iconClass = 'icon-doc';
                const fName = (data.nomeFile || "").toLowerCase();
                
                if(fName.includes('.pdf')) { icon = '📕'; iconClass = 'icon-pdf'; }
                else if(fName.includes('.png') || fName.includes('.jpg') || fName.includes('.jpeg')) { icon = '🖼️'; iconClass = 'icon-img'; }
                else if(fName.includes('.zip') || fName.includes('.rar')) { icon = '📦'; iconClass = 'icon-doc'; }

                const card = `
                    <div class="note-card" style="animation-delay: ${index * 0.05}s">
                        <div class="note-icon ${iconClass}">${icon}</div>
                        <h3 class="note-title">${data.titolo}</h3>
                        <p class="note-meta">${data.materia} • ${new Date(data.data).toLocaleDateString('it-IT')}</p>
                        <a href="${data.urlFile}" target="_blank" rel="noopener noreferrer" class="btn-download">↓ Scarica File</a>
                    </div>
                `;
                container.innerHTML += card;
                index++;
            });
        }).catch((err) => {
             console.error(err);
             container.innerHTML = '<p style="color:var(--danger); font-weight:700;">Errore di connessione a Firestore.</p>';
        });
    }

    // UPLOAD CLOUDINARY
    document.getElementById('btnUploadModal').addEventListener('click', () => {
        document.getElementById('uploadModal').classList.add('active');
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('uploadStatus').innerText = '';
    });

    document.getElementById('btnSalva').addEventListener('click', () => {
        const file = document.getElementById('upFile').files[0];
        const titolo = document.getElementById('upTitolo').value.trim();
        const materia = document.getElementById('upMateria').value;
        const status = document.getElementById('uploadStatus');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');

        if(!file || !titolo) { status.innerText = "Inserisci un titolo e seleziona un file!"; return; }

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
}