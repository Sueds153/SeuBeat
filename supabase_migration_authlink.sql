-- ═══════════════════════════════════════════════════════════════════════════════
-- SeuBeat — Migration #2: Link users table com auth.users
-- ═══════════════════════════════════════════════════════════════════════════════
-- Resolve o warning do Advisor: "users.id should reference auth.users"
-- ═══════════════════════════════════════════════════════════════════════════════

-- Adicionar coluna auth_user_id opcional (para quando houver Supabase Auth)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id);

-- Criar índice para joins futuros
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Atualizar RLS para usar auth_user_id em vez de id (quando disponível)
DROP POLICY IF EXISTS "Utilizadores podem ver o seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Utilizadores podem editar o seu próprio perfil" ON public.users;

CREATE POLICY "Utilizadores podem ver o seu próprio perfil" ON public.users
  FOR SELECT USING (
    auth.uid() = auth_user_id OR auth.uid() = id
  );

CREATE POLICY "Utilizadores podem editar o seu próprio perfil" ON public.users
  FOR UPDATE USING (
    auth.uid() = auth_user_id OR auth.uid() = id
  )
  WITH CHECK (
    auth.uid() = auth_user_id OR auth.uid() = id
  );

-- Atualizar RLS de song_requests para aceitar ambos
DROP POLICY IF EXISTS "Clientes podem ver os seus pedidos" ON public.song_requests;

CREATE POLICY "Clientes podem ver os seus pedidos" ON public.song_requests
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR
    user_id = auth.uid()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
