# FORGE Fitness — AV2 (versão ampliada)

Projeto com site público, autenticação por e-mail, painel administrativo e CRUD completo para `trainings`, `coaches`, `schedules` e `locations`.

## Estrutura
- `frontend/`: site público, login/cadastro e painel administrativo.
- `backend/`: API serverless Vercel com GET/POST/PUT/DELETE.
- `supabase.sql`: tabelas, autenticação, perfis e políticas RLS.

## 1. Configurar o Supabase
1. Abra o SQL Editor do projeto Supabase.
2. Execute o arquivo `supabase.sql` (faça backup se já houver dados importantes).
3. Em Project Settings > API, copie a Project URL e a chave pública `anon`/`publishable`.
4. Abra `frontend/js/config.js` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
5. Em Authentication > URL Configuration, configure o Site URL e Redirect URLs para o domínio do frontend. Para testes locais, inclua `http://localhost:5500` ou a URL que usar.

O cadastro envia um e-mail de confirmação quando a confirmação de e-mail estiver habilitada no Supabase. O usuário só conseguirá entrar após confirmar o endereço, conforme a configuração do projeto.

## 2. Tornar sua conta administradora
Por segurança, novos cadastros começam como usuários comuns. Depois de criar sua conta e confirmar o e-mail:
1. No Supabase, abra Table Editor > `profiles`.
2. Localize seu usuário pelo `email`.
3. Altere `is_admin` para `true`.
4. Saia e entre novamente no site.

Somente administradores podem criar, editar e excluir modalidades, professores, horários e unidades. Não torne usuários comuns administradores.

## 3. Publicar o backend na Vercel
1. Importe o repositório GitHub como um projeto Vercel.
2. Configure Root Directory como `backend`.
3. Cadastre as variáveis:
   - `SUPABASE_URL`: Project URL do Supabase.
   - `SUPABASE_ANON_KEY`: chave pública anon/publishable.
   - `ALLOWED_ORIGIN`: URL exata do frontend publicado (ex.: `https://forge-fitness.vercel.app`).
4. Faça o deploy.

## 4. Publicar o frontend na Vercel
1. Importe o mesmo repositório como outro projeto Vercel.
2. Configure Root Directory como `frontend`.
3. Em `frontend/js/config.js`, preencha `API_BASE_URL` com a URL do backend, sem barra no final.
4. Faça o deploy.

## 5. Testes para apresentação
- Crie uma conta e confirme o e-mail.
- Entre com a conta comum e confira que ela não vê o painel administrativo.
- Promova sua conta para administradora conforme a etapa 2.
- Teste cadastrar, listar, editar e excluir pelo painel em cada uma das quatro áreas.
- Confira o site público em janela anônima.

## Segurança
- Nunca coloque `service_role` ou secret key no frontend, GitHub ou variáveis públicas.
- A chave pública anon/publishable pode estar no frontend; a segurança depende das políticas RLS.
- O backend exige token de usuário válido e verifica `profiles.is_admin` antes de qualquer escrita.
- O banco também restringe INSERT/UPDATE/DELETE a administradores por RLS.
- Não compartilhe arquivos `.env` reais, senhas ou tokens.
