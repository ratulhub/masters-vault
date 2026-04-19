-- To be executed in Supabase SQL Editor
-- Because this app is custom zero-knowledge without normal Supabase auth,
-- we rely purely on AES-GCM encryption on the client side. The DB acts merely as an encrypted KV store.

CREATE TABLE IF NOT EXISTS public.vault_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id TEXT NOT NULL, -- Deterministic hash of master password to isolate users
    item_type TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist so this script is perfectly idempotent
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable update for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.vault_items;

-- Important: Since we don't have authenticated users via Supabase Auth (auth.uid()),
-- and this is a purely encrypted, zero-knowledge sync store, we allow all basic access
-- However, an attacker cannot read the data without the Argon2/AES key.
-- Note: A fully production ready multi-tenant version SHOULD use Supabase Auth to protect against malicious deletions.
-- Given your SINGLE USER requirement, we keep it simple here.
CREATE POLICY "Enable read access for all users" ON public.vault_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.vault_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.vault_items FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.vault_items FOR DELETE USING (true);
