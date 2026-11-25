import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

export function cors(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function client(token) {
  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_ANON_KEY.");
  }
  return createClient(url, key, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function friendlyDbError(err, table) {
  if (err?.code === "23505" && table === "schedules") {
    return "Já existe um horário cadastrado para este dia da semana. Edite o registro existente.";
  }
  if (err?.code === "23502") {
    return "Preencha todos os campos obrigatórios antes de salvar.";
  }
  if (err?.code === "22P02") {
    return "Formato de dado inválido para um dos campos.";
  }
  return err?.message || "Erro interno da API.";
}

export async function handler(req, res, table, orderBy) {
  if (cors(req, res)) return;
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const sb = client(token);

    if (req.method === "GET") {
      const { data, error } = await sb.from(table).select("*").order(orderBy, { ascending: true });
      if (error) return res.status(400).json({ error: friendlyDbError(error, table) });
      return res.status(200).json(data);
    }

    if (!token) return res.status(401).json({ error: "Faça login para continuar." });

    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Sessão inválida. Entre novamente." });

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return res.status(403).json({ error: "Apenas administradores podem alterar os cadastros." });
    }

    if (req.method === "POST") {
      const { data, error } = await sb.from(table).insert(req.body || {}).select().single();
      if (error) return res.status(400).json({ error: friendlyDbError(error, table) });
      return res.status(201).json(data);
    }

    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "Informe o ID do registro." });

    if (req.method === "PUT") {
      const { id: ignored, ...payload } = req.body || {};
      const { data, error } = await sb.from(table).update(payload).eq("id", id).select().single();
      if (error) return res.status(400).json({ error: friendlyDbError(error, table) });
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) return res.status(400).json({ error: friendlyDbError(error, table) });
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE, OPTIONS");
    return res.status(405).json({ error: "Método não permitido." });
  } catch (e) {
    console.error(`API ${table}:`, e.message);
    return res.status(500).json({ error: e.message || "Erro interno da API." });
  }
}
