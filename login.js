/* ============================================================
   login.js — Logica Login Avanzata (Harzafi Notes)
   ============================================================ */

async function inviaEmail(emailDestinatario, idModelloBrevo, parametriMail) {
    const WORKER_URL = "https://script.google.com/macros/s/AKfycbygPgpwK_kQVIpIreMy_l-X7cueedH1rle3QByC5Ok6-SAOSBI5_pZnu5Avnd16iHQn/exec";
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ emailDestinatario, idModelloBrevo, parametriMail })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Errore sconosciuto");
    } catch (err) { console.error("❌ Email error:", err); }
}

window.globalTurnstileToken = "";
window.isWaitingForToken    = false;

window.onTurnstileSuccess = function (token) {
    window.globalTurnstileToken = token;
    if (window.isWaitingForToken) {
        window.isWaitingForToken      = false;
        window.turnstileCallbackFired = true;
        if (typeof window.eseguiAccessoServer === 'function') window.eseguiAccessoServer();
    }
};
window.onTurnstileExpired = function () { window.globalTurnstileToken = ""; };
window.onTurnstileError   = function () {
    window.globalTurnstileToken = "";
    if (window.isWaitingForToken) {
        window.isWaitingForToken = false;
        if (typeof window.eseguiAccessoServer === 'function') window.eseguiAccessoServer();
    }
};

function waitForFirebase(callback) {
    if (typeof firebase !== 'undefined') {
        const firebaseConfig = {
            apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfakiLT7-0A",
            authDomain: "adamharzafi.github.io",
            projectId: "harzafi-notes",
            messagingSenderId: "35834921638",
            appId: "1:35834921638:web:cb5d8d612b4a2936126a67"
        };
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        window.auth = firebase.auth();
        window.db   = firebase.firestore();
        callback();
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (typeof firebase !== 'undefined') { clearInterval(interval); waitForFirebase(callback); }
            else if (attempts > 50) { clearInterval(interval); console.error("Firebase non disponibile."); }
        }, 100);
    }
}

window.addEventListener('load', () => {
    waitForFirebase(() => {
        if (typeof populateUserDropdown === 'function') populateUserDropdown('studente');

        // ── GESTIONE RITORNO DA REDIRECT GOOGLE ──
        window.auth.getRedirectResult().then(async result => {
            if (!result || !result.user) return;

            const savedRole   = sessionStorage.getItem('harzafi_pending_role') || 'studente';
            const targetDomain = savedRole === 'studente'
                ? 'studenti.itisavogadro.it'
                : 'itisavogadro.it';

            const email = (result.user.email || "").toLowerCase();

            const isVpn = await checkVPN();
            if (isVpn) {
                await window.auth.signOut();
                const errEl = document.getElementById('google-login-error');
                if (errEl) { errEl.innerText = "Disattivare la VPN per continuare."; errEl.style.display = 'block'; }
                return;
            }

            if (email.endsWith("@" + targetDomain)) {
                inviaEmail(email, 7, {
                    nome_utente:    result.user.displayName,
                    email_utente:   email,
                    orario_accesso: new Date().toLocaleString('it-IT')
                }).catch(e => console.log(e));
                entraNelPortale(result.user.displayName || "Utente");
            } else {
                await window.auth.signOut();
                const errEl = document.getElementById('google-login-error');
                if (errEl) {
                    errEl.innerText = `Usa l'email corretta (@${targetDomain}).`;
                    errEl.style.display = 'block';
                }
            }
        }).catch(err => {
            console.error("Redirect result error:", err);
        });
    });
});

async function checkVPN() {
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 2000);
        const res  = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return false;
        const data = await res.json();
        const org  = (data.org || "").toLowerCase();
        return org.includes('vpn') || org.includes('hosting') || org.includes('cloud') || org.includes('datacenter');
    } catch { return false; }
}

function entraNelPortale(nomeUtente) {
    sessionStorage.setItem('harzafi_user', nomeUtente);
    window.location.href = 'dashboard.html';
}

document.addEventListener("DOMContentLoaded", function () {
    if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
    window.scrollTo(0, 0);

    let selectedRole       = 'studente';
    let selectedUserValue  = "";
    let selectedUserEmail  = "";

    const submitBtn           = document.getElementById('login-submit');
    const passInput           = document.getElementById('password-input');
    const errorMsg            = document.getElementById('login-error');
    const hiddenUsernameInput = document.getElementById('hidden-username');
    const usernameSelect      = document.getElementById('username-select');

    window.populateUserDropdown = function (role) {
        const optionsContainer = document.getElementById('username-options');
        optionsContainer.innerHTML = '<div class="custom-option" style="color:var(--text-light);text-align:center;">Caricamento utenti...</div>';
        const collectionName = role === 'studente' ? 'studenti' : 'docenti';

        if (typeof window.db !== 'undefined') {
            window.db.collection(collectionName).orderBy("nome", "asc").get()
                .then(snapshot => {
                    optionsContainer.innerHTML = '';
                    snapshot.forEach(doc => creaOpzioneDropdown(doc.data().nome, doc.data().email || "email_mancante@scuola.it", optionsContainer));
                })
                .catch(() => {
                    optionsContainer.innerHTML = '<div class="custom-option" style="color:var(--danger);">Errore di connessione al server</div>';
                });
        } else {
            optionsContainer.innerHTML = '<div class="custom-option" style="color:var(--text-light);text-align:center;">In attesa di connessione...</div>';
        }
        resetDropdownDisplay();
    };

    function creaOpzioneDropdown(nome, email, container) {
        const option = document.createElement('div');
        option.className  = 'custom-option';
        option.textContent = nome;
        option.addEventListener('click', function (e) {
            e.stopPropagation();
            document.getElementById('username-display').textContent = nome;
            document.getElementById('username-display').parentElement.classList.add('selected');
            selectedUserValue = nome;
            selectedUserEmail = email;
            hiddenUsernameInput.value = nome;
            usernameSelect.classList.remove('open');
            errorMsg.style.display = 'none';
        });
        container.appendChild(option);
    }

    function resetDropdownDisplay() {
        document.getElementById('username-display').textContent = 'Seleziona Utente';
        document.getElementById('username-display').parentElement.classList.remove('selected');
        selectedUserValue = ""; selectedUserEmail = ""; hiddenUsernameInput.value = "";
    }

    document.querySelectorAll('.custom-select-trigger').forEach(trigger => {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const parent = this.parentElement;
            const isOpen = parent.classList.contains('open');
            document.querySelectorAll('.custom-select').forEach(s => { if (s !== parent) s.classList.remove('open'); });
            parent.classList.toggle('open');
            this.setAttribute('aria-expanded', parent.classList.contains('open'));
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select').forEach(sel => {
            sel.classList.remove('open');
            sel.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
        });
    });

    const segBtns   = document.querySelectorAll('#role-control .seg-btn');
    const segSlider = document.getElementById('role-slider');
    const loginView = document.getElementById('login-view');
    const rulesView = document.getElementById('rules-view');

    segBtns.forEach((btn, index) => btn.addEventListener('click', e => {
        segBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedRole = e.target.dataset.role;
        segSlider.style.transform = index === 0 ? 'translateX(0)' : 'translateX(100%)';
        if (typeof window.populateUserDropdown === 'function') window.populateUserDropdown(selectedRole);
        document.getElementById('google-login-error').style.display = 'none';
    }));

    document.getElementById('btn-rules-banner').addEventListener('click', () => {
        loginView.style.display = 'none'; rulesView.style.display = 'block';
    });
    document.querySelectorAll('.btn-back-login').forEach(btn => {
        btn.addEventListener('click', () => { rulesView.style.display = 'none'; loginView.style.display = 'block'; });
    });

    const togglePasswordBtn = document.getElementById('toggle-password');
    const eyeIcon           = document.getElementById('eye-icon');
    const eyeSlashIcon      = document.getElementById('eye-slash-icon');

    togglePasswordBtn.addEventListener('click', () => {
        if (passInput.type === 'password') {
            passInput.type = 'text';
            passInput.style.fontFamily  = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
            passInput.style.letterSpacing = "normal";
            eyeIcon.style.display = 'none';
            eyeSlashIcon.style.display = 'block';
        } else {
            passInput.type = 'password';
            passInput.style.fontFamily  = "Verdana, sans-serif";
            passInput.style.letterSpacing = "2px";
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';
        }
    });

    passInput.addEventListener('copy',  e => { e.preventDefault(); errorMsg.innerText = 'Operazione negata.'; errorMsg.style.display = 'block'; });
    passInput.addEventListener('paste', e => { e.preventDefault(); errorMsg.innerText = 'Operazione negata.'; errorMsg.style.display = 'block'; });

    window.eseguiAccessoServer = function () {
        const pass  = passInput.value.trim();
        const uName = hiddenUsernameInput.value.trim();
        submitBtn.innerText = "VERIFICA IN CORSO...";

        if (typeof window.auth !== 'undefined') {
            window.auth.signInWithEmailAndPassword(selectedUserEmail, pass)
                .then(async () => {
                    inviaEmail(selectedUserEmail, 7, {
                        nome_utente:    uName,
                        email_utente:   selectedUserEmail,
                        orario_accesso: new Date().toLocaleString('it-IT')
                    }).catch(e => console.log(e));
                    submitBtn.innerText = "ENTRA";
                    submitBtn.disabled  = false;
                    entraNelPortale(uName);
                })
                .catch((error) => {
                    submitBtn.innerText = "ENTRA";
                    submitBtn.disabled  = false;
                    passInput.value = '';
                    window.globalTurnstileToken = "";
                    if (typeof turnstile !== 'undefined') { try { turnstile.reset(); } catch (e) {} }
                    if (error.code === 'auth/too-many-requests') errorMsg.innerText = "Troppi tentativi falliti. Riprova più tardi.";
                    else errorMsg.innerText = "Credenziali errate. Riprova.";
                    errorMsg.style.display = 'block';
                    errorMsg.style.animation = 'none';
                    void errorMsg.offsetWidth;
                    errorMsg.style.animation = 'shake 0.4s';
                });
        } else {
            errorMsg.innerText = "Servizio temporaneamente offline.";
            errorMsg.style.display = 'block';
            submitBtn.innerText = "ENTRA";
            submitBtn.disabled  = false;
        }
    };

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (document.activeElement) document.activeElement.blur();
        const pass  = passInput.value.trim();
        const uName = hiddenUsernameInput.value.trim();

        if (typeof window.auth === 'undefined') { errorMsg.innerText = "Database offline."; errorMsg.style.display = 'block'; return; }
        if (!uName || !selectedUserEmail)       { errorMsg.innerText = "Seleziona prima un utente dalla lista."; errorMsg.style.display = 'block'; return; }
        if (!pass)                              { errorMsg.innerText = "Il campo password è obbligatorio."; errorMsg.style.display = 'block'; return; }

        errorMsg.style.display = 'none';
        submitBtn.innerText = "VERIFICA SICUREZZA...";
        submitBtn.disabled  = true;

        const isVpn = await checkVPN();
        if (isVpn) {
            errorMsg.innerText = "Disattivare la VPN per continuare.";
            errorMsg.style.display = 'block';
            submitBtn.innerText = "ENTRA";
            submitBtn.disabled  = false;
            return;
        }

        if (window.globalTurnstileToken) {
            window.eseguiAccessoServer();
        } else {
            window.isWaitingForToken      = true;
            window.turnstileCallbackFired = false;
            if (typeof turnstile !== 'undefined') { try { turnstile.execute(); } catch (e) {} }
            setTimeout(() => {
                if (window.isWaitingForToken && !window.turnstileCallbackFired) {
                    window.isWaitingForToken = false;
                    window.eseguiAccessoServer();
                }
            }, 2500);
        }
    });

    // ── LOGIN GOOGLE CON REDIRECT (fix COOP) ──
    const googleBtn      = document.getElementById('custom-google-btn');
    const googleErrorMsg = document.getElementById('google-login-error');

    googleBtn.addEventListener('click', async () => {
        if (document.activeElement) document.activeElement.blur();
        googleErrorMsg.style.display = 'none';

        if (typeof window.auth === 'undefined') {
            googleErrorMsg.innerText = "Servizio offline.";
            googleErrorMsg.style.display = 'block';
            return;
        }

        const isVpn = await checkVPN();
        if (isVpn) {
            googleErrorMsg.innerText = "Disattivare la VPN per continuare.";
            googleErrorMsg.style.display = 'block';
            return;
        }

        // Salva il ruolo selezionato così lo ritroviamo dopo il redirect
        sessionStorage.setItem('harzafi_pending_role', selectedRole);

        const provider     = new firebase.auth.GoogleAuthProvider();
        const targetDomain = selectedRole === 'studente'
            ? 'studenti.itisavogadro.it'
            : 'itisavogadro.it';
        provider.setCustomParameters({ hd: targetDomain });

        googleBtn.innerHTML = `<div class="btn-loader"><div class="btn-spinner"></div><span class="btn-text-main" style="margin-left:5px;">REINDIRIZZO...</span></div>`;
        googleBtn.disabled  = true;

        try {
            await window.auth.signInWithRedirect(provider);
        } catch (err) {
            console.error("Redirect error:", err);
            googleErrorMsg.innerText = "Errore durante il reindirizzamento.";
            googleErrorMsg.style.display = 'block';
            googleBtn.disabled  = false;
            googleBtn.innerHTML = `<img src="IMMAGINI/GOOGLE-LOGO.png" loading="lazy" alt="Google" style="width: 24px; position: absolute; left: 24px; height: auto;"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.2;"><span class="btn-text-main" style="font-weight: 800; color: #374151; font-size: 0.95rem;">ACCEDI CON GOOGLE</span><span class="btn-text-sub" style="font-weight: 600; color: #9ca3af; font-size: 0.75rem; text-transform: none;">Tramite account istituzionale</span></div>`;
        }
    });

    // ── HARZAFI ID ──
    document.getElementById('btn-harzafi-id').addEventListener('click', () => { document.getElementById('hid-modal').classList.add('active'); });
    document.getElementById('hid-close-btn').addEventListener('click',  () => document.getElementById('hid-modal').classList.remove('active'));
    document.getElementById('hid-cancel-btn').addEventListener('click', () => document.getElementById('hid-modal').classList.remove('active'));
    document.getElementById('hid-open-manual').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('hid-scan-view').style.display   = 'none';
        document.getElementById('hid-manual-view').style.display = 'block';
        document.getElementById('hid-input').focus();
    });
    document.getElementById('hid-back-btn').addEventListener('click', () => {
        document.getElementById('hid-manual-view').style.display = 'none';
        document.getElementById('hid-scan-view').style.display   = 'block';
        document.getElementById('hid-error').style.display       = 'none';
    });

    document.getElementById('hid-submit-btn').addEventListener('click', async () => {
        if (document.activeElement) document.activeElement.blur();
        const hidErrorEl   = document.getElementById('hid-error');
        const hidSubmitBtn = document.getElementById('hid-submit-btn');
        const origText     = hidSubmitBtn.innerHTML;
        const inputVal     = document.getElementById('hid-input').value.trim();

        const isVpn = await checkVPN();
        if (isVpn) { hidErrorEl.innerText = "Disattivare la VPN per continuare."; hidErrorEl.style.display = 'block'; return; }
        if (!inputVal.length) return;

        hidSubmitBtn.innerHTML = "VERIFICA IN CORSO...";
        hidSubmitBtn.disabled  = true;
        hidErrorEl.style.display = 'none';

        if (typeof window.db !== 'undefined') {
            window.db.collection("studenti").where("HID", "==", inputVal).get().then(async snap => {
                if (!snap.empty) {
                    try { await window.auth.signInAnonymously(); } catch (err) {}
                    document.getElementById('hid-modal').classList.remove('active');
                    hidSubmitBtn.innerHTML = origText;
                    hidSubmitBtn.disabled  = false;
                    document.getElementById('hid-input').value = "";
                    entraNelPortale(snap.docs[0].data().nome);
                } else { throw new Error("HID non valido"); }
            }).catch(() => {
                hidErrorEl.innerText = "HID non valido. Riprova.";
                hidErrorEl.style.display = 'block';
                hidErrorEl.style.animation = 'none';
                void hidErrorEl.offsetWidth;
                hidErrorEl.style.animation = 'shake 0.4s';
                hidSubmitBtn.innerHTML = origText;
                hidSubmitBtn.disabled  = false;
            });
        } else {
            hidErrorEl.innerText = "Database offline.";
            hidErrorEl.style.display = 'block';
            hidSubmitBtn.innerHTML = origText;
            hidSubmitBtn.disabled  = false;
        }
    });

    // ── RECUPERO PASSWORD ──
    let targetCollectionOTP = 'studenti';
    const forgotModal   = document.getElementById('forgot-sheet-modal');
    const otpStep1      = document.getElementById('otp-step-1');
    const otpStep3      = document.getElementById('otp-step-3');
    const otpEmailInput = document.getElementById('otp-email-input');

    document.getElementById('btn-forgot-pass').addEventListener('click', e => {
        e.preventDefault();
        otpStep1.style.display  = 'block';
        otpStep1.style.opacity  = '1';
        otpStep3.style.display  = 'none';
        otpStep3.style.opacity  = '0';
        otpEmailInput.value     = '';
        document.getElementById('otp-error-msg').style.display = 'none';
        targetCollectionOTP = selectedRole === 'studente' ? 'studenti' : 'docenti';
        document.getElementById('otp-role-title').innerText = selectedRole === 'studente' ? 'Area Studenti' : 'Area Docenti';
        forgotModal.classList.add('active');
    });

    document.getElementById('forgot-sheet-close').addEventListener('click', () => forgotModal.classList.remove('active'));
    document.getElementById('btn-otp-back-selection').addEventListener('click', () => forgotModal.classList.remove('active'));

    document.getElementById('btn-send-otp').addEventListener('click', async function () {
        const emailVal   = otpEmailInput.value.trim().toLowerCase();
        const errorDiv   = document.getElementById('otp-error-msg');
        const origBtnTxt = this.innerHTML;

        if (!emailVal || !emailVal.includes('@')) {
            errorDiv.innerText = "Inserisci un'email valida.";
            errorDiv.style.display = 'block';
            return;
        }
        errorDiv.style.display = 'none';
        this.innerHTML = '<div class="btn-loader"><div class="btn-spinner"></div><span>Invio in corso...</span></div>';
        this.disabled  = true;

        try {
            const snapshot = await window.db.collection(targetCollectionOTP).where('email', '==', emailVal).get();
            if (snapshot.empty) throw new Error("Email non trovata.");
            await window.auth.sendPasswordResetEmail(emailVal);
            otpStep1.style.opacity = '0';
            setTimeout(() => {
                otpStep1.style.display = 'none';
                otpStep3.style.display = 'block';
                setTimeout(() => { otpStep3.style.opacity = '1'; }, 50);
            }, 400);
        } catch (err) {
            errorDiv.innerText = "Errore di connessione. Riprova.";
            errorDiv.style.display = 'block';
            errorDiv.style.animation = 'none';
            void errorDiv.offsetWidth;
            errorDiv.style.animation = 'shake 0.4s';
        } finally {
            this.innerHTML = origBtnTxt;
            this.disabled  = false;
        }
    });
});
