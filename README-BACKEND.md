# BeeTrace app — ruta a backend real (pendiente)

La app de `/app` funciona hoy con **almacenamiento local** (`src/lib/store.ts`:
localStorage + sessionStorage, `demo: true` en los datos de ejemplo, banner
«Modo local · sin servidor» en todas las pantallas). Eso cubre la UI y los flujos,
**pero no es autenticación ni permisos reales**.

Para producción hace falta un backend. Ruta recomendada (encaja con Vercel):

1. **Base de datos**: proyecto Supabase (Postgres) o Vercel Postgres/Neon.
   Tablas: `orgs`, `memberships(user_id, org_id, role)`, `lots`, `drums`,
   `receptions`, `blends`, `analyses`, `movements`. La lógica pura de
   `src/lib/trace.ts` (cálculos de mezcla, validaciones, formato QR) se reutiliza
   tal cual en el servidor.
2. **Auth**: Supabase Auth o Auth.js con el proveedor que uses. Sesión en cookie
   httpOnly; el perfil local de sessionStorage desaparece.
3. **Permisos en servidor**: cada endpoint comprueba `memberships` —
   un usuario solo lee/escribe lotes de su `org_id` o lotes compartidos por
   operación autorizada (recepción de la destinataria). Portar las reglas que hoy
   aplica el store en cliente (duplicados, stock, idempotencia por `idemKey`
   con constraint único en BD).
4. **Astro en modo servidor**: `output: 'server'` + `@astrojs/vercel`, o endpoints
   `src/pages/api/*.ts`. Sin esto no hay comprobación en servidor posible.
5. **Variables en Vercel**: `PUBLIC_` solo para lo público; conexión a BD y
   secretos solo en el servidor. Proyecto → Settings → Environment Variables.
6. **Escáner**: ya exige HTTPS y valida `BT1:<ID>` / URLs propias sin abrir
   enlaces externos — mantener esa regla en el servidor al resolver fichas
   públicas.

Nada de la UI necesita reescribirse: los formularios llaman a `store.ts`;
al migrar, `store.ts` pasa a llamar a `/api/*` y el resto sigue igual.
