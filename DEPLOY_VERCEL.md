# Deploy do AgenteCobrador na Vercel

O projeto foi devidamente preparado para a infraestrutura Serverless da Vercel (onde o banco SQLite não funciona e o build requer o Prisma Client gerado previamente).

## 1. Banco de Dados PostgreSQL (Obrigatório)

O Vercel destrói instâncias do App em cada requisição (Serverless). Por causa disso, arquivos `.db` como o SQLite são perdidos. Seu projeto agora já usa `postgresql` no Prisma `schema`. 
Você precisará de uma URL do PostgreSQL real (Exemplos grátis: **Neon.tech** ou **Supabase**). 

1. Crie uma conta no Neon banco de dados.
2. Copie a `DATABASE_URL` (algo como `postgresql://usuario:senha@neon.tech/nomedobanco...`).

## 2. Deploy Passo-a-Passo

1. Acesse o [Vercel](https://vercel.com/) e faça login usando o GitHub.
2. Clique no botão **"Add New..." -> "Project"**.
3. Importe o repositório **`PARA-AGI0T-KKKKK`**.
4. Em **"Root Directory"**, clique em **Edit** e selecione a pasta `frontend`.
5. Abra a sessão **Environment Variables (Variáveis de Ambiente)** e adicione todas as 4 chaves abaixo preenchidas:
   - `DATABASE_URL` ➡️ Cole aqui a URL do seu Banco Postgres (ex: Neon.tech).
   - `NEXTAUTH_SECRET` ➡️ Crie uma chave de segurança aleatória (Pode ser qualquer texto grande ou UUID).
   - `NEXTAUTH_URL` ➡️ Ao final do deploy, será sua URL na vercel (ex: `https://meu-projeto.vercel.app`).
   - `EVOLUTION_API_URL` ➡️ `https://evolutionapi-evolution-api.g8hvc9.easypanel.host`
   - `EVOLUTION_API_KEY` ➡️ `HX32784759LF2NPPO8PM`
6. Clique em **Deploy**.

O processo de *Build* já está configurado no `package.json` para rodar `prisma generate` e conectar-se à Evolution API automaticamente. Seu SaaS em Next.js já está pronto para o mundo sem travamentos online!
