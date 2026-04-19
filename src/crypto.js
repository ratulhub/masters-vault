// Removed ESM import for argon2-browser to avoid WASM bundler crashes.
// Using window.argon2 loaded via CDN in index.html

// Fixed salt for deriving the owner ID only. 
// Do NOT use this for the AES-GCM encryption key derivation; each vault get its own salt there.
const STATIC_OWNER_SALT = "MASTERS_VAULT_STATIC_SALT_v1";
const GLOBAL_SALT = "MASTERS_VAULT_GLOBAL_SALT";

let argon2Loaded = false;

export async function setupCrypto() {
    // Make sure argon2 is ready (WASM init)
    if (!argon2Loaded) {
        // usually argon2-browser doesn't need explicit init but we preload just in case
        argon2Loaded = window.argon2 !== undefined;
    }
}

// Convert string to ArrayBuffer
function str2ab(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

// Convert ArrayBuffer to Base64
function ab2b64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Convert Base64 to ArrayBuffer
function b642ab(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Derives a key and ownerId from the master password using Argon2
 */
export async function deriveKey(password) {
    try {
        // 1. Derive AES-GCM Key
        // Memory cost high, 2 iterations. 
        // In browser, keep memory cost reasonable otherwise mobile crashes. 
        // Using ~64MB (65536)
        const hash = await argon2.hash({
            pass: password,
            salt: GLOBAL_SALT,
            time: 2,
            mem: 1024 * 64, 
            hashLen: 32, // 256 bits for AES-256
            type: argon2.ArgonType.Argon2id
        });
        
        let keyBuffer = hash.hash; 

        // Import the derived bit array into WebCrypto API
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyBuffer,
            "AES-GCM",
            false,
            ["encrypt", "decrypt"]
        );

        // 2. Derive deterministic Owner ID to fetch appropriate rows from Supabase
        const ownerHash = await window.crypto.subtle.digest('SHA-256', str2ab(password + STATIC_OWNER_SALT));
        const ownerId = ab2b64(ownerHash);

        return { key: cryptoKey, ownerId };

    } catch (e) {
        console.error("Argon2 Hash Error", e);
        throw e;
    }
}

export async function encryptPayload(dataObj, key) {
    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encoded = str2ab(JSON.stringify(dataObj));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoded
    );

    return {
        encrypted: ab2b64(encryptedBuffer),
        iv: ab2b64(iv.buffer)
    };
}

export async function decryptPayload(encryptedStr, ivStr, key) {
    try {
        const encryptedBuffer = b642ab(encryptedStr);
        const ivBuffer = b642ab(ivStr);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
            key,
            encryptedBuffer
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (err) {
        console.error("Decryption failed", err);
        throw new Error("Bad Master Password or corrupted data");
    }
}
