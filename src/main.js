const { createIcons, icons } = window.lucide;
import { setupCrypto, deriveKey, encryptPayload, decryptPayload } from './crypto.js';
import { Storage, checkSetupStatus, deleteRemoteVault } from './store.js';
import * as UI from './ui.js';

// Anti Clickjacking
if (window.self !== window.top) {
    document.body.innerHTML = '<h1>Security Error: Iframe not allowed</h1>';
    throw new Error("Clickjacking protection enabled");
}

let store;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    createIcons({ icons });
    
    // UI Init with Callbacks
    UI.init({
        onChangePassword: async (oldP, newP) => {
            try {
                document.getElementById('btn-do-change-pw').disabled = true;
                const oldDerived = await deriveKey(oldP);
                if (oldDerived.ownerId !== store.ownerId) {
                    UI.showToast("Current password incorrect.", true);
                    document.getElementById('btn-do-change-pw').disabled = false;
                    return;
                }
                
                UI.showToast("Migrating vault. Please wait...");
                const newDerived = await deriveKey(newP);
                await store.migrateVault(newDerived.ownerId, newDerived.key);
                
                // Update local storage reference for real owner if panic mode is enabled
                if (localStorage.getItem('real_owner_hash')) {
                    localStorage.setItem('real_owner_hash', newDerived.ownerId);
                }
                
                UI.showToast("Master Password Changed!");
                setTimeout(() => location.reload(), 1500);

            } catch(e) {
                console.error(e);
                UI.showToast("Failed to change password.", true);
                document.getElementById('btn-do-change-pw').disabled = false;
            }
        },
        onSetPanic: async (panicP) => {
            const derived = await deriveKey(panicP);
            localStorage.setItem('panic_hash', derived.ownerId);
            if (store && store.ownerId) {
                localStorage.setItem('real_owner_hash', store.ownerId);
            }
            UI.showToast("Panic Mode Enabled!");
            document.getElementById('set-panic-pw').value = '';
        }
    });
    
    // Attempt Crypto setup
    await setupCrypto();

    let isSetupMode = false;
    let setupError = null;
    try {
        const status = await checkSetupStatus();
        isSetupMode = status.isSetup;
        setupError = status.dbError;
        
        if (isSetupMode) {
            document.querySelector('.lock-container h1').textContent = "Set Master Password";
            document.querySelector('.subtitle').textContent = setupError 
                ? "⚠️ " + setupError 
                : "Create your impenetrable vault. Do not forget this.";
            
            if (setupError) document.querySelector('.subtitle').style.color = "var(--warning-color)";

            document.getElementById('master-password').placeholder = "Create Master Password...";
            document.querySelector('#btn-unlock .btn-text').textContent = "Initialize Vault";
        }
    } catch (e) {
        console.warn("Could not check setup status");
    }

    // Setup Lock Screen Handlers
    const unlockForm = document.getElementById('unlock-form');
    const masterPwInput = document.getElementById('master-password');
    const errorMsg = document.getElementById('unlock-error');
    
    let wrongAttempts = 0;
    
    unlockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = masterPwInput.value;
        if (!pwd) return;

        try {
            // UI Feedback
            const btn = document.getElementById('btn-unlock');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Unlocking...';
            createIcons({icons});
            btn.disabled = true;

            // Artificial delay if wrong attempts
            if (wrongAttempts > 0) {
               await new Promise(r => setTimeout(r, wrongAttempts * 1000));
            }

            // Derive key using Argon2
            const { key, ownerId } = await deriveKey(pwd);
            
            // Check Panic
            if (localStorage.getItem('panic_hash') === ownerId) {
                const realOwner = localStorage.getItem('real_owner_hash');
                if (realOwner) {
                     // Destroy REAL vault entirely
                     await deleteRemoteVault(realOwner);
                     localStorage.removeItem('real_owner_hash');
                }
                
                // Create decoy empty vault instance
                store = new Storage(ownerId, key);
                UI.showDashboard(store);
                masterPwInput.value = '';
                wrongAttempts = 0;
                errorMsg.style.display = 'none';
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                createIcons({icons});
                return;
            }
            
            // Standard store init
            store = new Storage(ownerId, key);
            
            // Log the active owner hash just in case panic mode is enabled later
            if (localStorage.getItem('panic_hash')) {
                 localStorage.setItem('real_owner_hash', ownerId);
            }
            
            // Decrypt vault data
            try {
                await store.sync();
                
                // V2 Zero-Knowledge Validation: 
                // If there ARE items in the database globally (isSetupMode = false), 
                // but this specific derived password yielded 0 items, it MUST be the wrong password!
                // (Unless it's a fresh decoy vault, but even so, we want to reject random typoes)
                if (!isSetupMode && store.items.length === 0) {
                     // Wait, what if they legitimately just deleted all their items but didn't trigger panic?
                     // Then checkSetupStatus() would have returned true on page load! 
                     throw new Error("Invalid decryption key");
                }
                
                UI.showDashboard(store);
                masterPwInput.value = ''; // clear from DOM immediately
                wrongAttempts = 0;
                errorMsg.style.display = 'none';

                if (isSetupMode) {
                    UI.showToast("Vault initialized perfectly!");
                    isSetupMode = false;
                }

            } catch (err) {
                console.error(err);
                wrongAttempts++;
                errorMsg.textContent = "Incorrect password or corrupted vault.";
                errorMsg.style.display = 'block';
                // Wiping key from memory simulation (JavaScript GC reliance)
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
            createIcons({icons});

        } catch (err) {
            console.error("Argon2 / Crypto Error:", err);
            errorMsg.textContent = "Crypto error occurred.";
            errorMsg.style.display = 'block';
        }
    });
});
