-- ============================================================
-- SCHEMA: Sistema de Apostas de Ciclismo
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: perfis (ligada ao auth.users do Supabase)
-- ============================================================
CREATE TABLE IF NOT EXISTS perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: provas
-- ============================================================
CREATE TABLE IF NOT EXISTS provas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT CHECK (status IN ('aberta', 'fechada', 'finalizada')) DEFAULT 'aberta',
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: apostas
-- ============================================================
CREATE TABLE IF NOT EXISTS apostas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  prova_id UUID REFERENCES provas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES perfis(id) ON DELETE CASCADE NOT NULL,
  -- Top 20 ciclistas apostados (posição 1-20)
  -- Array de 20 elementos: apostas_top20[0] = 1º lugar, apostas_top20[19] = 20º lugar
  apostas_top20 TEXT[] NOT NULL CHECK (array_length(apostas_top20, 1) = 20),
  -- Camisolas especiais
  camisola_sprint TEXT,       -- Vencedor pontos
  camisola_montanha TEXT,     -- Vencedor montanha
  camisola_juventude TEXT,    -- Melhor jovem
  -- Pontuação calculada automaticamente
  pontos_total INTEGER DEFAULT 0,
  pontos_top10 INTEGER DEFAULT 0,
  pontos_top20 INTEGER DEFAULT 0,
  pontos_camisolas INTEGER DEFAULT 0,
  -- Critérios de desempate
  acertos_exatos INTEGER DEFAULT 0,        -- posições exatas totais
  acertos_exatos_top10 INTEGER DEFAULT 0,  -- posições exatas no top10
  acertos_exatos_top20 INTEGER DEFAULT 0,  -- posições exatas no top20
  acertos_camisolas INTEGER DEFAULT 0,     -- camisolas certas
  -- Metadata
  calculada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prova_id, user_id)
);

-- ============================================================
-- TABELA: resultados_reais
-- ============================================================
CREATE TABLE IF NOT EXISTS resultados_reais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  prova_id UUID REFERENCES provas(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Top 20 resultado real
  resultado_top20 TEXT[] NOT NULL CHECK (array_length(resultado_top20, 1) = 20),
  -- Camisolas reais
  camisola_sprint TEXT,
  camisola_montanha TEXT,
  camisola_juventude TEXT,
  -- Admin que inseriu
  inserido_por UUID REFERENCES perfis(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_apostas_prova ON apostas(prova_id);
CREATE INDEX IF NOT EXISTS idx_apostas_user ON apostas(user_id);
CREATE INDEX IF NOT EXISTS idx_apostas_pontos ON apostas(pontos_total DESC);
CREATE INDEX IF NOT EXISTS idx_provas_status ON provas(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE apostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_reais ENABLE ROW LEVEL SECURITY;

-- Perfis: cada um vê o seu, admins vêem todos
CREATE POLICY "perfis_select_own" ON perfis FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfis_update_own" ON perfis FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "perfis_select_all" ON perfis FOR SELECT USING (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Provas: todos lêem, só admins escrevem
CREATE POLICY "provas_select" ON provas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "provas_admin_write" ON provas FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Apostas: cada um gere a sua
CREATE POLICY "apostas_select_own" ON apostas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "apostas_insert_own" ON apostas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "apostas_update_own" ON apostas FOR UPDATE USING (auth.uid() = user_id);
-- Admin pode ver/editar tudo
CREATE POLICY "apostas_admin_all" ON apostas FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Resultados: todos lêem, só admins escrevem
CREATE POLICY "resultados_select" ON resultados_reais FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "resultados_admin_write" ON resultados_reais FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ============================================================
-- FUNÇÃO: criar perfil automático após signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- DADOS DE EXEMPLO
-- ============================================================
INSERT INTO provas (nome, data_inicio, data_fim, status, descricao) VALUES
  ('Tour de France 2025', '2025-07-05', '2025-07-27', 'aberta', 'A Grande Boucle - 112ª edição'),
  ('Giro d''Italia 2025', '2025-05-09', '2025-06-01', 'finalizada', 'Corsa Rosa 2025'),
  ('Vuelta a España 2025', '2025-08-16', '2025-09-07', 'aberta', 'La Vuelta 2025')
ON CONFLICT DO NOTHING;
