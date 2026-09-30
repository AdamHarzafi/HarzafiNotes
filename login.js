/* ============================================================
   login.js — Accesso Harzafi Notes con identità Harzafi FSL
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
    } catch (err) { console.error("Email accesso non inviata:", err); }
}

// L'endpoint Apps Script allegato genera questa notifica solo per il modello 2.
const LOGIN_EMAIL_TEMPLATE_ID = 2;

const NOTES_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCogx9XlPxHewLdxcdXKxOaIfakiLT7-0A",
    authDomain: "harzafi-notes.firebaseapp.com",
    projectId: "harzafi-notes",
    messagingSenderId: "35834921638",
    appId: "1:35834921638:web:cb5d8d612b4a2936126a67"
};

const FSL_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBisp324W7J5jGwF_s-nbXabOjEutcwMmc",
    authDomain: "harzafi---fsl.firebaseapp.com",
    projectId: "harzafi---fsl",
    storageBucket: "harzafi---fsl.firebasestorage.app",
    messagingSenderId: "743942918497",
    appId: "1:743942918497:web:6d6e44ba348760ce137520"
};

function waitForFirebase(callback) {
    if (typeof firebase === 'undefined') {
        let attempts = 0;
        const interval = setInterval(() => {
            if (typeof firebase !== 'undefined') { clearInterval(interval); waitForFirebase(callback); }
            else if (++attempts > 50) { clearInterval(interval); console.error("Firebase non disponibile."); }
        }, 100);
        return;
    }

    try {
        const notesApp = firebase.apps.find(app => app.name === '[DEFAULT]') || firebase.initializeApp(NOTES_FIREBASE_CONFIG);
        const fslApp = firebase.apps.find(app => app.name === 'harzafi-fsl-identity') || firebase.initializeApp(FSL_FIREBASE_CONFIG, 'harzafi-fsl-identity');
        const isLocalPreview = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
        let fslAppCheck = null;

        // Le API Auth e Firestore di FSL richiedono App Check. Usa la stessa app web,
        // la stessa chiave reCAPTCHA Enterprise e gli stessi domini di Harzafi FSL.
        if (!isLocalPreview && typeof firebase.appCheck === 'function') {
            try {
                fslAppCheck = firebase.appCheck(fslApp);
                fslAppCheck.activate(
                    new firebase.appCheck.ReCaptchaEnterpriseProvider('6LejpcksAAAAAEQEVz602t2PL78MzHE73T4a608-'),
                    true
                );
            } catch (error) {
                console.error('Protezione App Check non inizializzata:', error.code || 'errore');
            }
        }

        window.notesApp = notesApp;
        window.fslApp = fslApp;
        window.auth = firebase.auth(notesApp);
        window.db = firebase.firestore(notesApp);
        window.identityAuth = firebase.auth(fslApp);
        window.identityDb = firebase.firestore(fslApp);
        window.identityAppCheck = fslAppCheck;
        callback();
    } catch (error) {
        console.error('Inizializzazione Firebase non riuscita:', error);
    }
}

function loginLoadingIndicator(status = "Accesso in corso") {
    return `<span class="login-button-loader"><span class="login-button-spinner" aria-hidden="true"></span><span class="sr-only">${status}</span></span>`;
}

function entraNelPortale(nomeUtente, { email = '', role = 'studente', method = 'hid' } = {}) {
    sessionStorage.setItem('harzafi_user', nomeUtente);
    if (window.auth?.currentUser) sessionStorage.setItem('harzafi_user_uid', window.auth.currentUser.uid);
    sessionStorage.setItem('harzafi_auth_method', method);
    sessionStorage.setItem('harzafi_verified_email', email);
    sessionStorage.setItem('harzafi_role', role);
    if (window.identityAuth?.currentUser) sessionStorage.setItem('harzafi_fsl_uid', window.identityAuth.currentUser.uid);
    window.location.href = 'dashboard.html?v=20260928-notes-auth-key';
}

function mostraErrore(element, text) {
    if (!element) return;
    element.textContent = text;
    element.style.display = 'block';
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = 'shake 0.4s';
}

function nomeProfilo(profile) {
    const name = profile && typeof profile.nome === 'string' ? profile.nome.trim() : '';
    return name || 'Utente';
}

document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    let selectedRole = 'studente';
    let selectedUserEmail = '';
    let selectedUserName = '';
    let pendingCredentials = null;
    let verificationAttempt = 0;

    const submitBtn = document.getElementById('login-submit');
    const passInput = document.getElementById('password-input');
    const errorMsg = document.getElementById('login-error');
    const emailInput = document.getElementById('email-input');
    const emailError = document.getElementById('email-error');
    const emailStep = document.getElementById('login-email-step');
    const passwordStep = document.getElementById('login-password-step');
    const continueBtn = document.getElementById('login-continue');
    const emailField = emailInput.parentElement;
    const selectedEmail = document.getElementById('selected-email-display');
    const subtitle = document.querySelector('.auth-subtitle');
    const originalSubtitle = subtitle?.textContent || '';

    function mostraPassaggioEmail() {
        verificationAttempt++;
        if (!emailStep || submitBtn.disabled) return;
        emailField.prepend(emailInput);
        emailInput.setAttribute('aria-describedby', 'email-error');
        emailStep.hidden = false;
        passwordStep.hidden = true;
        emailStep.classList.add('is-active');
        passwordStep.classList.remove('is-active');
        document.querySelector('.login-panel')?.classList.remove('is-password-step');
        if (subtitle) subtitle.textContent = originalSubtitle;
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continua';
        continueBtn.removeAttribute('aria-busy');
        emailError.style.display = 'none';
        errorMsg.style.display = 'none';
        emailInput.focus();
    }

    async function mostraPassaggioPassword() {
        if (continueBtn.disabled || submitBtn.disabled) return;
        const email = emailInput.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostraErrore(emailError, 'Inserisci un indirizzo email valido.');
            emailInput.focus();
            return;
        }

        const attempt = ++verificationAttempt;
        const role = selectedRole;
        continueBtn.disabled = true;
        continueBtn.innerHTML = loginLoadingIndicator('Verifica account');
        continueBtn.setAttribute('aria-busy', 'true');
        emailError.style.display = 'none';

        try {
            if (!window.identityDb) throw new Error('service-unavailable');
            if (window.identityAppCheck) await window.identityAppCheck.getToken(false);
            const collection = role === 'studente' ? 'studenti' : 'docenti';
            const snapshot = await window.identityDb.collection(collection)
                .where('email', '==', email).limit(1).get();
            if (attempt !== verificationAttempt || emailInput.value.trim().toLowerCase() !== email) return;
            if (snapshot.empty) throw new Error('role-not-enabled');

            const profile = snapshot.docs[0].data();
            selectedUserEmail = email;
            selectedUserName = nomeProfilo(profile);
            emailInput.value = email;
            selectedEmail.appendChild(emailInput);
            emailInput.setAttribute('aria-describedby', 'login-error');
            emailStep.hidden = true;
            passwordStep.hidden = false;
            emailStep.classList.remove('is-active');
            passwordStep.classList.add('is-active');
            document.querySelector('.login-panel')?.classList.add('is-password-step');
            if (subtitle) subtitle.textContent = 'Inserisci la password del tuo Account Harzafi.';
            passInput.focus();
        } catch (error) {
            if (attempt !== verificationAttempt) return;
            const message = error.message === 'role-not-enabled'
                ? 'Questo indirizzo non è abilitato per il ruolo selezionato.'
                : 'Non è possibile verificare l’indirizzo adesso. Riprova tra poco.';
            mostraErrore(emailError, message);
        } finally {
            if (attempt === verificationAttempt) {
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continua';
                continueBtn.removeAttribute('aria-busy');
            }
        }
    }

    continueBtn.addEventListener('click', mostraPassaggioPassword);
    document.getElementById('change-email').addEventListener('click', mostraPassaggioEmail);
    emailInput.addEventListener('input', () => { emailError.style.display = 'none'; });
    emailInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); mostraPassaggioPassword(); } });

    // Selettore del ruolo, identico alla pagina di accesso FSL.
    const roleButtons = document.querySelectorAll('#role-control .seg-btn');
    const roleSlider = document.getElementById('role-slider');
    roleButtons.forEach((button, index) => button.addEventListener('click', event => {
        if (submitBtn.disabled) return;
        roleButtons.forEach(item => { item.classList.remove('active'); item.setAttribute('aria-pressed', 'false'); });
        event.currentTarget.classList.add('active');
        event.currentTarget.setAttribute('aria-pressed', 'true');
        selectedRole = event.currentTarget.dataset.role;
        roleSlider.style.transform = index === 0 ? 'translateX(0)' : 'translateX(100%)';
        mostraPassaggioEmail();
    }));
    const togglePassword = document.getElementById('toggle-password');
    const capsWarning = document.getElementById('caps-lock-warning');
    let capsTimer;
    togglePassword.addEventListener('click', () => {
        const visible = passInput.type === 'password';
        passInput.type = visible ? 'text' : 'password';
        togglePassword.classList.toggle('is-visible', visible);
        togglePassword.setAttribute('aria-label', visible ? 'Nascondi password' : 'Mostra password');
    });
    const updateCapsLock = event => {
        if (!event.getModifierState) return;
        const active = event.getModifierState('CapsLock');
        capsWarning.hidden = !active;
        if (active && event.type === 'keydown' && event.key.length === 1) {
            capsWarning.classList.remove('is-typing');
            void capsWarning.offsetWidth;
            capsWarning.classList.add('is-typing');
            clearTimeout(capsTimer);
            capsTimer = setTimeout(() => capsWarning.classList.remove('is-typing'), 170);
        }
    };
    passInput.addEventListener('keydown', updateCapsLock);
    passInput.addEventListener('keyup', updateCapsLock);
    passInput.addEventListener('blur', () => { capsWarning.hidden = true; capsWarning.classList.remove('is-typing'); });

    function mostraErroreLogin(error) {
        const code = error?.code || '';
        if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
            return 'Credenziali non corrette. Controlla email e password usate su Harzafi FSL.';
        }
        if (code === 'auth/too-many-requests') return 'Troppi tentativi falliti. Riprova più tardi.';
        if (code.startsWith('auth/')) return 'Accesso non riuscito. Riprova con le credenziali di Harzafi FSL.';
        return 'Accesso momentaneamente non disponibile. Riprova tra poco.';
    }

    async function completaAccesso() {
        const credentials = pendingCredentials;
        pendingCredentials = null;
        if (!credentials || !window.identityAuth || !window.auth) throw new Error('auth/unavailable');

        // Verifica la password sullo stesso progetto usato da Harzafi FSL.
        // Notes conserva il proprio archivio e usa una sessione anonima solo per
        // autorizzare la lettura dei materiali condivisi già prevista dal progetto.
        const persistence = firebase.auth.Auth.Persistence.LOCAL;
        await Promise.all([
            window.identityAuth.setPersistence(persistence),
            window.auth.setPersistence(persistence)
        ]);
        await window.identityAuth.signInWithEmailAndPassword(credentials.email, credentials.password);
        if (window.auth.currentUser) await window.auth.signOut();
        await window.auth.signInAnonymously();

        inviaEmail(credentials.email, LOGIN_EMAIL_TEMPLATE_ID, {
            nome_utente: credentials.name,
            email_utente: credentials.email,
            orario_accesso: new Date().toLocaleString('it-IT')
        });
        passInput.value = '';
        sessionStorage.setItem('harzafi_verified_email', credentials.email);
        entraNelPortale(credentials.name, { email: credentials.email, role: credentials.role, method: 'fsl-password' });
    }

    document.getElementById('login-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (submitBtn.disabled) return;
        if (passwordStep.hidden) { await mostraPassaggioPassword(); return; }
        if (!selectedUserEmail || !selectedUserName) {
            mostraErrore(errorMsg, 'Inserisci e verifica il tuo indirizzo email.');
            mostraPassaggioEmail();
            return;
        }
        const password = passInput.value;
        if (!password) { mostraErrore(errorMsg, 'Inserisci la password.'); passInput.focus(); return; }

        pendingCredentials = { email: selectedUserEmail, password, role: selectedRole, name: selectedUserName };
        errorMsg.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.innerHTML = loginLoadingIndicator();
        try {
            await completaAccesso();
        } catch (error) {
            console.error('Accesso Harzafi Notes non riuscito:', error.code || error.message || 'errore');
            await Promise.all([
                window.identityAuth?.currentUser ? window.identityAuth.signOut().catch(() => {}) : Promise.resolve(),
                window.auth?.currentUser ? window.auth.signOut().catch(() => {}) : Promise.resolve()
            ]);
            pendingCredentials = null;
            passInput.value = '';
            mostraErrore(errorMsg, mostraErroreLogin(error));
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.textContent = 'Accedi';
        }
    });

    // ── Accesso Harzafi ID, mantenuto come in FSL ──
    document.getElementById('btn-harzafi-id').addEventListener('click', () => document.getElementById('hid-modal').classList.add('active'));
    document.getElementById('hid-close-btn').addEventListener('click', () => document.getElementById('hid-modal').classList.remove('active'));
    document.getElementById('hid-cancel-btn').addEventListener('click', () => document.getElementById('hid-modal').classList.remove('active'));
    document.getElementById('hid-open-manual').addEventListener('click', event => {
        event.preventDefault();
        document.getElementById('hid-scan-view').style.display = 'none';
        document.getElementById('hid-manual-view').style.display = 'block';
        document.getElementById('hid-input').focus();
    });
    document.getElementById('hid-back-btn').addEventListener('click', () => {
        document.getElementById('hid-manual-view').style.display = 'none';
        document.getElementById('hid-scan-view').style.display = 'block';
        document.getElementById('hid-error').style.display = 'none';
    });

    document.getElementById('hid-submit-btn').addEventListener('click', async () => {
        if (document.activeElement) document.activeElement.blur();
        const error = document.getElementById('hid-error');
        const button = document.getElementById('hid-submit-btn');
        const original = button.innerHTML;
        const hid = document.getElementById('hid-input').value.trim();
        if (!hid) return;
        button.disabled = true;
        button.innerHTML = loginLoadingIndicator('Verifica Harzafi ID');
        error.style.display = 'none';
        try {
            const snapshot = await window.identityDb.collection('studenti').where('HID', '==', hid).limit(1).get();
            if (snapshot.empty) throw new Error('HID non valido');
            const persistence = firebase.auth.Auth.Persistence.LOCAL;
            await Promise.all([
                window.identityAuth.setPersistence(persistence),
                window.auth.setPersistence(persistence)
            ]);
            if (window.identityAuth.currentUser) await window.identityAuth.signOut();
            await window.identityAuth.signInAnonymously();
            if (window.auth.currentUser) await window.auth.signOut();
            await window.auth.signInAnonymously();
            const name = nomeProfilo(snapshot.docs[0].data());
            document.getElementById('hid-modal').classList.remove('active');
            document.getElementById('hid-input').value = '';
            entraNelPortale(name, { role: 'studente', method: 'hid' });
        } catch (err) {
            await Promise.all([
                window.identityAuth?.currentUser ? window.identityAuth.signOut().catch(() => {}) : Promise.resolve(),
                window.auth?.currentUser ? window.auth.signOut().catch(() => {}) : Promise.resolve()
            ]);
            mostraErrore(error, err.code ? 'Servizio Harzafi ID non disponibile. Riprova.' : 'HID non valido. Riprova.');
            button.disabled = false;
            button.innerHTML = original;
        }
    });

    // Il recupero invia il link dal progetto di autenticazione FSL, dove è stata
    // creata la password condivisa.
    const forgotModal = document.getElementById('forgot-sheet-modal');
    const otpStep1 = document.getElementById('otp-step-1');
    const otpStep3 = document.getElementById('otp-step-3');
    const otpEmailInput = document.getElementById('otp-email-input');
    document.getElementById('btn-forgot-pass').addEventListener('click', event => {
        event.preventDefault();
        otpStep1.style.display = 'block';
        otpStep1.style.opacity = '1';
        otpStep3.style.display = 'none';
        otpStep3.style.opacity = '0';
        otpEmailInput.value = selectedUserEmail || '';
        document.getElementById('otp-error-msg').style.display = 'none';
        document.getElementById('otp-role-title').textContent = selectedRole === 'studente' ? 'Area Studenti' : 'Area Docenti';
        forgotModal.classList.add('active');
    });
    document.getElementById('forgot-sheet-close').addEventListener('click', () => forgotModal.classList.remove('active'));
    document.getElementById('btn-otp-back-selection').addEventListener('click', () => forgotModal.classList.remove('active'));
    document.getElementById('btn-send-otp').addEventListener('click', async function () {
        const email = otpEmailInput.value.trim().toLowerCase();
        const error = document.getElementById('otp-error-msg');
        const original = this.innerHTML;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostraErrore(error, 'Inserisci un indirizzo email valido.');
            return;
        }
        error.style.display = 'none';
        this.disabled = true;
        this.innerHTML = loginLoadingIndicator('Invio link di recupero');
        try {
            if (window.identityAppCheck) await window.identityAppCheck.getToken(false);
            const collection = selectedRole === 'studente' ? 'studenti' : 'docenti';
            const profile = await window.identityDb.collection(collection).where('email', '==', email).limit(1).get();
            if (profile.empty) throw new Error('role-not-enabled');
            await window.identityAuth.sendPasswordResetEmail(email);
            otpStep1.style.opacity = '0';
            setTimeout(() => {
                otpStep1.style.display = 'none';
                otpStep3.style.display = 'block';
                setTimeout(() => { otpStep3.style.opacity = '1'; }, 50);
            }, 400);
        } catch (err) {
            mostraErrore(error, err.message === 'role-not-enabled'
                ? 'Questo indirizzo non è abilitato per il ruolo selezionato.'
                : 'Non è possibile inviare il link adesso. Controlla l’indirizzo e riprova.');
        } finally {
            this.innerHTML = original;
            this.disabled = false;
        }
    });
});

waitForFirebase(() => {});
