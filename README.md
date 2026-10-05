# Focus Solutions · Canal de Ética

Aplicação multiempresa em Next.js, TypeScript e Prisma, com portal público progressivo e área empresarial autenticada. Os dados de demonstração usam nomes e relatos explicitamente fictícios.

## Identidade

O manual da marca e o design system Focus em `Layout/` orientam a interface. A aplicação usa a logo horizontal oficial original e pesos de Source Sans Pro fornecidos no repositório. Os arquivos foram copiados sem modificação para `public/brand` e `public/fonts`.

## Executar localmente

1. Instale Node.js 20.9+ e PostgreSQL 15+.
2. Copie `.env.example` para `.env` e configure `DATABASE_URL` e um `SESSION_SECRET` aleatório com pelo menos 32 caracteres.
3. Instale dependências com `npm install`.
4. Crie as tabelas e dados de demonstração: `npm run db:push` e `npm run db:seed`.
5. Inicie com `npm run dev`.

Contas fictícias: `admin@focus.demo` (superadministrador), `admin@acme-brasil.demo` (admin do cliente), `analista@acme-brasil.demo` (analista). A senha de demonstração é `FocusDemo!2026`. Troque e remova essas contas antes de qualquer implantação.

Canal público: `/denuncia/acme-brasil`, `/denuncia/horizonte-logistica` e `/denuncia/vereda-tecnologia`.

## Estrutura principal

- `src/app/denuncia/[slug]`: apresentação e formulário anônimo progressivo.
- `src/app/login`: autenticação de usuários empresariais.
- `src/app/cliente`: dashboard, listagem e configurações do cliente.
- `src/app/admin`: área separada de administração Focus.
- `src/app/api`: rotas públicas e empresariais, sempre com escopo de tenant no servidor.
- `prisma/schema.prisma`: empresas, RBAC, estrutura organizacional, denúncias, análises, anexos e auditoria.

Anexos são guardados fora de `public/`, com nomes aleatórios, limite de 10 MB e download autenticado por empresa. Em produção, configure armazenamento privado persistente com varredura antimalware e backup. O limitador inicial de tentativas reside em memória do processo; produção precisa de rate limiting compartilhado (Redis ou equivalente) atrás de proxy confiável. Configure HTTPS, backups, monitoramento e política de retenção compatível com LGPD antes de uso real. Este MVP não registra identificação do denunciante nem disponibiliza acompanhamento público.
