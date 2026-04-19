const { createClient } = window.supabase;
import { encryptPayload, decryptPayload } from './crypto.js';

// IMPORTANT: Replace these with your actual Supabase Project URL and Anon Key.
const SUPABASE_URL = 'https://e....i.supabase.co';
const SUPABASE_ANON_KEY = 'eZSI6ImFub24iLCJpYXQiOjE3...WcmqzAMfq8DPU';

export async function checkSetupStatus() {
    if (SUPABASE_URL.includes('YOUR_PROJECT_REF')) return { isSetup: false, dbError: null };
    try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { error, count } = await client.from('vault_items').select('*', { count: 'exact', head: true });
        if (error) {
            console.warn("Supabase Error during checkSetupStatus:", error.message || error);
            return { isSetup: true, dbError: "Database table 'vault_items' not found. Please run the SQL setup script." };
        }
        return { isSetup: count === 0, dbError: null };
    } catch(e) {
        console.error("Fetch Exception during checkSetupStatus:", e);
        return { isSetup: true, dbError: "Network or database connection error." };
    }
}

export async function deleteRemoteVault(ownerId) {
    if (SUPABASE_URL.includes('YOUR_PROJECT_REF')) return;
    try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await client.from('vault_items').delete().eq('owner_id', ownerId);
    } catch(e) {}
}

export class Storage {
    constructor(ownerId, cryptoKey) {
        this.ownerId = ownerId;
        this.cryptoKey = cryptoKey;
        this.items = []; // Local unencrypted cache within variable memory
        
        if (SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
            this.client = null;
            console.warn("Running in MOCK mode. Please insert real Supabase strings.");
        } else {
            try {
                this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            } catch(e) {
                console.warn("Supabase client init failed. Make sure valid keys are added.");
                this.client = null;
            }
        }
    }

    // Sync from remote db -> decrypt -> populate memory
    async sync() {
        if (!this.client) {
            console.log("Mock Sync - No Supabase configured");
            return;
        }

        const { data, error } = await this.client
            .from('vault_items')
            .select('*')
            .eq('owner_id', this.ownerId);

        if (error) {
            console.error("Error fetching vault items", error);
            throw new Error("Sync failed");
        }

        this.items = [];
        for (let row of data) {
            try {
                const decrypted = await decryptPayload(row.encrypted_data, row.iv, this.cryptoKey);
                this.items.push({
                    id: row.id,
                    type: row.item_type,
                    data: decrypted,
                    created_at: row.created_at
                });
            } catch (err) {
                 console.error(`Failed to decrypt item ${row.id}`, err);
                 // If one fails, we skip it (could be panic mode decoy)
            }
        }
        
        // Sort descending
        this.items.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async addItem(type, payloadData) {
        const { encrypted, iv } = await encryptPayload(payloadData, this.cryptoKey);
        
        const row = {
            owner_id: this.ownerId,
            item_type: type,
            encrypted_data: encrypted,
            iv: iv,
            salt: 'NA' // Included natively if multiple salts needed, currently global setup.
        };

        if (this.client) {
            const { data, error } = await this.client
                .from('vault_items')
                .insert([row])
                .select();
                
            if (error) throw error;
            
            // Add to local state
            const id = data[0].id;
            this.items.unshift({ id, type, data: payloadData, created_at: data[0].created_at });
        } else {
            // Mock mode
            this.items.unshift({ id: crypto.randomUUID(), type, data: payloadData, created_at: new Date().toISOString() });
        }
    }

    async deleteItem(id) {
        if (this.client) {
            const { error } = await this.client
                .from('vault_items')
                .delete()
                .eq('id', id)
                .eq('owner_id', this.ownerId);
            if (error) throw error;
        }
        
        this.items = this.items.filter(i => i.id !== id);
    }

    async migrateVault(newOwnerId, newCryptoKey) {
        if (!this.client) throw new Error("Mock DB cannot migrate natively.");

        const newRows = [];
        for (const item of this.items) {
             const { encrypted, iv } = await encryptPayload(item.data, newCryptoKey);
             newRows.push({
                 owner_id: newOwnerId,
                 item_type: item.type,
                 encrypted_data: encrypted,
                 iv: iv,
                 salt: 'NA' 
             });
        }
        
        // Upload new keys
        if (newRows.length > 0) {
            const { error: insertErr } = await this.client.from('vault_items').insert(newRows);
            if (insertErr) throw insertErr;
        }

        // Delete old payload
        const { error: wipeErr } = await this.client.from('vault_items').delete().eq('owner_id', this.ownerId);
        if (wipeErr) console.warn("Failed to wipe old data", wipeErr);
        
        this.ownerId = newOwnerId;
        this.cryptoKey = newCryptoKey;
    }
    
    wipe() {
        this.items = [];
        this.cryptoKey = null;
        this.ownerId = null;
    }
}
