const { createIcons, icons } = window.lucide;

let localStore = null;

export function init(callbacks = {}) {
    setupModals(callbacks);
    setupGenerator();
    
    // Inactivity lock (2 minutes)
    let inactivityTimer;
    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => lockVault(), 120000); // 2 minutes
    };
    
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keydown', resetTimer);
    document.addEventListener('click', resetTimer);

    // Visibility lock
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            lockVault();
        }
    });

    document.getElementById('btn-lock').addEventListener('click', lockVault);
    document.getElementById('toggle-master-pw').addEventListener('click', (e) => {
        const inp = document.getElementById('master-password');
        const icon = e.currentTarget.querySelector('i');
        if (inp.type === 'password') {
            inp.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            inp.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
        }
        createIcons({icons});
    });
}

function lockVault() {
    if (localStore) {
        localStore.wipe();
        localStore = null;
    }
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('lock-screen').classList.add('active');
    document.getElementById('vault-items').innerHTML = ''; // Clear DOM memory
}

export function showDashboard(store) {
    localStore = store;
    document.getElementById('lock-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    renderVault();
}

function setupModals(callbacks) {
    const modal = document.getElementById('item-modal');
    const settingsModal = document.getElementById('settings-modal');
    const typeSelect = document.getElementById('item-type');
    const dynamicFields = document.getElementById('dynamic-fields');
    
    // Add Item Modal
    document.getElementById('btn-add-item').addEventListener('click', () => {
        document.getElementById('item-form').reset();
        document.getElementById('modal-title').textContent = 'Add Item';
        document.getElementById('item-id').value = '';
        renderFields(typeSelect.value);
        modal.classList.add('active');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btn-cancel-modal').addEventListener('click', () => modal.classList.remove('active'));

    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
        settingsModal.classList.add('active');
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    if (callbacks.onChangePassword) {
        document.getElementById('btn-do-change-pw').addEventListener('click', async () => {
            const oldP = document.getElementById('set-old-pw').value;
            const newP = document.getElementById('set-new-pw').value;
            if (oldP && newP) {
                await callbacks.onChangePassword(oldP, newP);
            } else {
                showToast("Please enter both passwords.", true);
            }
        });
    }

    if (callbacks.onSetPanic) {
        document.getElementById('btn-set-panic').addEventListener('click', async () => {
            const pPass = document.getElementById('set-panic-pw').value;
            if (pPass) {
                await callbacks.onSetPanic(pPass);
            } else {
                showToast("Please enter a Panic Password.", true);
            }
        });
    }

    typeSelect.addEventListener('change', () => renderFields(typeSelect.value));

    document.getElementById('item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = typeSelect.value;
        const payload = {};
        const inputs = dynamicFields.querySelectorAll('input, textarea');
        inputs.forEach(inp => {
            if (inp.name) payload[inp.name] = inp.value;
        });

        // Add
        try {
            await localStore.addItem(type, payload);
            renderVault();
            modal.classList.remove('active');
            showToast("Item saved securely!");
        } catch (e) {
            console.error(e);
            showToast("Failed to save item. Check connection.", true);
        }
    });
}

function renderFields(type) {
    const df = document.getElementById('dynamic-fields');
    let html = '';
    if (type === 'login') {
        html = `
            <div class="form-group"><label>Site / App</label><input type="text" name="site" required></div>
            <div class="form-group"><label>Username</label><input type="text" name="username" required></div>
            <div class="form-group"><label>Password</label><input type="password" name="password" required></div>
            <div class="form-group"><label>URL</label><input type="text" name="url"></div>
        `;
    } else if (type === 'note') {
        html = `
            <div class="form-group"><label>Title</label><input type="text" name="title" required></div>
            <div class="form-group"><label>Secure Note</label><textarea name="note" rows="5" required></textarea></div>
        `;
    } else if (type === 'crypto') {
        html = `
            <div class="form-group"><label>Wallet Name</label><input type="text" name="wallet" required></div>
            <div class="form-group"><label>Address</label><input type="text" name="address"></div>
            <div class="form-group"><label>Seed Phrase (12/24 words)</label><textarea name="seed" rows="3" placeholder="word1 word2..."></textarea></div>
            <div class="form-group"><label>Private Key</label><input type="password" name="private_key"></div>
            <div class="form-group"><label>Network</label><input type="text" name="network"></div>
        `;
    } else if (type === 'card') {
        html = `
            <div class="form-group"><label>Card Name</label><input type="text" name="name" required></div>
            <div class="form-group"><label>Number</label><input type="text" name="number" required></div>
            <div class="form-group"><label>Expiry (MM/YY)</label><input type="text" name="expiry" required></div>
            <div class="form-group"><label>CVV/Notes</label><input type="password" name="cvv"></div>
        `;
    }
    df.innerHTML = html;
}

function renderVault() {
    const container = document.getElementById('vault-items');
    container.innerHTML = '';
    
    // Stats
    document.getElementById('stat-total').textContent = localStore.items.length;
    let weakCount = 0;

    localStore.items.forEach(item => {
        if (item.type === 'login' && item.data.password && item.data.password.length < 10) weakCount++;

        const card = document.createElement('div');
        card.className = 'vault-card';

        let icon = 'key';
        let title = '';
        let subtitle = '';
        let fieldsHtml = '';

        if (item.type === 'login') {
            icon = 'log-in';
            title = item.data.site || 'Unnamed Login';
            subtitle = item.data.username || '';
            fieldsHtml = `
                <div class="vault-card-field">
                  <span class="text-secondary">Password</span>
                  <div class="vault-card-field-val">
                     <span class="secure-text">${item.data.password || ''}</span>
                     <button class="btn-icon btn-copy" data-val="${item.data.password || ''}"><i data-lucide="copy"></i></button>
                  </div>
                </div>
            `;
        } else if (item.type === 'note') {
            icon = 'file-text';
            title = item.data.title || 'Secure Note';
            fieldsHtml = `
               <div class="vault-card-field">
                  <div class="vault-card-field-val" style="width:100%;">
                    <span class="secure-text" style="width:100%; white-space:pre-wrap; font-family:inherit;">${item.data.note}</span>
                  </div>
               </div>
            `;
        } else if (item.type === 'crypto') {
            icon = 'bitcoin';
            title = item.data.wallet || 'Wallet';
            subtitle = item.data.network || '';
            fieldsHtml = `
               <div class="vault-card-field">
                 <span class="text-secondary">Address</span>
                 <div class="vault-card-field-val">
                    <span style="filter:none">${item.data.address || 'N/A'}</span>
                    <button class="btn-icon btn-copy" data-val="${item.data.address || ''}"><i data-lucide="copy"></i></button>
                 </div>
               </div>
               <div class="vault-card-field">
                 <span class="text-secondary">Seed / Key</span>
                 <div class="vault-card-field-val">
                    <span class="secure-text">********</span>
                    <button class="btn-icon btn-copy" data-val="${item.data.seed || item.data.private_key || ''}"><i data-lucide="copy"></i></button>
                 </div>
               </div>
            `;
        } else if (item.type === 'card') {
            icon = 'credit-card';
            title = item.data.name || 'Card';
            subtitle = item.data.number || '';
            fieldsHtml = `
               <div class="vault-card-field">
                 <span class="text-secondary">Expiry</span>
                 <span>${item.data.expiry}</span>
               </div>
               <div class="vault-card-field">
                 <span class="text-secondary">CVV</span>
                 <div class="vault-card-field-val">
                    <span class="secure-text">${item.data.cvv || ''}</span>
                    <button class="btn-icon btn-copy" data-val="${item.data.cvv || ''}"><i data-lucide="copy"></i></button>
                 </div>
               </div>
            `;
        }

        card.innerHTML = `
            <div class="vault-card-header">
                <div class="vault-card-icon"><i data-lucide="${icon}"></i></div>
                <div>
                   <div class="vault-card-title">${title}</div>
                   <div class="vault-card-subtitle">${subtitle}</div>
                </div>
                <div class="vault-card-actions">
                   <button class="btn-icon btn-delete" data-id="${item.id}"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
            ${fieldsHtml}
        `;
        container.appendChild(card);
    });

    document.getElementById('stat-weak').textContent = weakCount;
    const scoreRow = document.getElementById('stat-score');
    if (weakCount > 0) {
        scoreRow.textContent = 'Warning';
        scoreRow.className = 'stat-value text-warning';
    } else {
        scoreRow.textContent = '100%';
        scoreRow.className = 'stat-value text-success';
    }

    createIcons({icons});

    // Event Listeners
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("Permanently delete this secure item?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await localStore.deleteItem(id);
                renderVault();
            }
        });
    });

    container.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-val');
            navigator.clipboard.writeText(val).then(() => {
                showToast("Copied ✓");
                
                // Auto-clear clipboard after 20 seconds
                setTimeout(() => {
                    navigator.clipboard.readText().then(text => {
                        if (text === val) navigator.clipboard.writeText('');
                    }).catch(err => {});
                }, 20000);
            });
        });
    });
}

export function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle'}" style="color: ${isError ? 'var(--danger-color)' : 'var(--success-color)'}"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(t);
    createIcons({icons});
    setTimeout(() => { t.remove() }, 3000);
}

function setupGenerator() {
    // Add logic here if required (floating gen widget)
}
