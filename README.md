# Focus Solutions · Canal de Ética

Aplicação multiempresa em Next.js, TypeScript e Prisma, com portal público progressivo e área empresarial autenticada.

## Identidade

O manual da marca e o design system Focus orientam a interface. A aplicação usa a logo horizontal oficial original e pesos de Source Sans Pro, copiados sem modificação para `public/brand` e `public/fonts`. Os arquivos-fonte do design system (`Layout/`) não fazem parte deste repositório: são material de origem, não são usados em runtime.

## Executar localmente

1. Instale Node.js 20.9+ e PostgreSQL 15+.
2. Copie `.env.example` para `.env` e configure `DATABASE_URL` e um `SESSION_SECRET` aleatório com pelo menos 32 caracteres.
3. Instale dependências com `npm install`.
4. Crie as tabelas: `npm run db:push`.
5. Inicie com `npm run dev`.

### Dados de demonstração (apenas desenvolvimento)

`npm run db:seed` popula três empresas fictícias, usuários de teste e denúncias de exemplo, com canais em `/denuncia/acme-brasil`, `/denuncia/horizonte-logistica` e `/denuncia/vereda-tecnologia`. As credenciais ficam no próprio `prisma/seed.ts`.

**Nunca rode o seed contra um banco de produção.** Ele cria contas com senha conhecida e publicada no código.

### Primeiro acesso em um ambiente limpo

Sem seed, o banco não tem nenhum usuário e ninguém consegue entrar. Crie o primeiro superadministrador diretamente no banco, com `passwordHash` no formato `salt:hash` (scrypt, 64 bytes — veja `src/app/api/auth/login/route.ts`). Usuários criados pela interface nascem com `mustChangePassword`, e são obrigados a definir a própria senha em `/primeiro-acesso` antes de usar o sistema.

## Estrutura principal

- `src/middleware.ts`: guarda de rotas por papel. **Precisa ficar em `src/`** — na raiz do projeto o Next não o carrega e a proteção deixa de existir silenciosamente.
- `src/app/denuncia/[slug]`: apresentação e formulário anônimo progressivo.
- `src/app/login` e `src/app/primeiro-acesso`: autenticação e troca de senha obrigatória.
- `src/app/cliente`: visão geral, denúncias e configurações do cliente.
- `src/app/admin`: área separada de administração Focus.
- `src/app/api`: rotas públicas e empresariais, sempre com escopo de tenant no servidor.
- `prisma/schema.prisma`: empresas, RBAC, estrutura organizacional, denúncias, análises, anexos e auditoria.

## Privacidade e produção

O portal público não coleta nenhum dado de identificação: não há campo de nome, e-mail ou telefone, e nem IP nem identificador é gravado junto do relato. O único risco de identificação é o próprio denunciante escrever seus dados no texto livre, e o formulário avisa sobre isso.

O dashboard aplica um limiar de agregação (`threshold`, em `src/app/api/client/dashboard/route.ts`) para que recortes com poucos relatos não permitam deduzir quem denunciou. **Baixar esse valor reduz a proteção contra deanonimização por cruzamento de unidade, setor, categoria e período.** Trate qualquer alteração ali como decisão de privacidade.

Pendências conhecidas antes de uso real com volume:

- Anexos são gravados em `private-uploads/`, no disco do processo. Em plataformas com sistema de arquivos efêmero eles se perdem a cada deploy — é preciso volume persistente ou storage externo.
- O rate limiting é em memória do processo: só vale com uma réplica. Produção multi-instância precisa de store compartilhado (Redis ou equivalente) atrás de proxy confiável.
- O schema é aplicado com `prisma db push`, sem histórico de migrações.
- Não há recuperação de senha por e-mail: quem perder a senha depende de acesso ao banco.

Configure HTTPS, backups, monitoramento e política de retenção compatível com LGPD antes de uso real. Este MVP não disponibiliza acompanhamento público do relato por protocolo.
