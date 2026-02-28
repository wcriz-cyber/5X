# 5X Trading App — ETF Leverage DCA

App de trading para ETFs apalancados de Gate.io (3L, 5L, 3S, 5S).  
Estrategia DCA secuencial con 12 niveles, TP1 automático, trailing stop y rebuy ×3.

---

## 📁 ESTRUCTURA DEL REPOSITORIO

```
/
├── index.html                          ← App completa (SPA single-file)
├── manifest.json                       ← PWA manifest
├── sw.js                               ← Service Worker (offline)
├── icon.png                            ← Icono de la app (192×192)
├── supabase/
│   └── functions/
│       └── gate-proxy/
│           └── index.ts                ← Edge Function HMAC proxy Gate.io
├── supabase_schema.sql                 ← Tablas Supabase (ejecutar en SQL Editor)
├── .gitignore
└── README.md
```

---

## 🚀 PARTE 1 — GITHUB (repositorio privado)

### 1.1 Crear el repositorio

1. Ve a [github.com/new](https://github.com/new)
2. **Repository name:** `5x-trading` (o el que prefieras)
3. **Visibility:** ✅ **Private**
4. **No** inicialices con README (ya tienes uno)
5. Clic en **Create repository**

### 1.2 Subir los archivos

```bash
# En tu computadora, desde la carpeta con los archivos:
git init
git add .
git commit -m "5X v25.32 — rebuy 3x, manual buys in auto, clean roi legacy"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/5x-trading.git
git push -u origin main
```

### 1.3 GitHub Pages (hosting gratuito)

1. En GitHub → tu repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Guardar — en 1-2 minutos la app estará en:  
   `https://TU_USUARIO.github.io/5x-trading/`

> **Alternativa más rápida:** Arrastra los archivos al repo desde la UI web de GitHub.

---

## 🗄️ PARTE 2 — SUPABASE

### 2.1 Crear proyecto Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. **Name:** `5x-trading`
3. **Database Password:** guárdala en un lugar seguro
4. **Region:** elige la más cercana (ej: `South America (São Paulo)`)
5. Clic en **Create new project** (tarda ~2 min)

### 2.2 Crear las tablas (SQL)

1. En tu proyecto Supabase → **SQL Editor** → **New query**
2. Pega el contenido completo de `supabase_schema.sql`
3. Clic en **Run** (▶️)
4. Verifica en **Table Editor** que aparecen: `kv_store`, `whitelist`, `support_messages`, `trade_history`

### 2.3 Crear el Storage Bucket

1. Supabase → **Storage** → **New bucket**
2. **Name:** `support-files`
3. **Public bucket:** ✅ activar
4. Clic en **Create bucket**

### 2.4 Obtener las credenciales

1. Supabase → **Project Settings** → **API**
2. Copia:
   - **Project URL** → `https://XXXX.supabase.co`
   - **anon public key** → `eyJhbGci...`

### 2.5 Configurar la app

1. Abre la app en el navegador
2. Ve a **Ajustes** → sección **SUPABASE** (visible en modo Admin)
3. Ingresa:
   - **URL:** tu Project URL
   - **Anon Key:** tu anon public key
4. Toca **CONECTAR** — debería mostrar ✅ Conectado

---

## ⚡ PARTE 3 — EDGE FUNCTION (Proxy Gate.io)

La Edge Function firma los requests a Gate.io con HMAC-SHA512 desde el servidor,
evitando exponer las API keys en el cliente.

### 3.1 Instalar Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop install supabase

# Linux
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

### 3.2 Login y link del proyecto

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
# TU_PROJECT_REF está en: Supabase → Project Settings → General → Reference ID
```

### 3.3 Configurar variables de entorno

```bash
# Configurar los secrets de la Edge Function
supabase secrets set GATE_API_KEY=tu_api_key_de_gateio
supabase secrets set GATE_API_SECRET=tu_api_secret_de_gateio
```

### 3.4 Deploy de la Edge Function

```bash
supabase functions deploy gate-proxy
```

La URL de la función quedará en:  
`https://TU_PROJECT_REF.supabase.co/functions/v1/gate-proxy`

### 3.5 Configurar la URL del proxy en la app

1. En la app → **Ajustes** → sección **SUPABASE EDGE FUNCTION**
2. Ingresa la URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/gate-proxy`
3. Guardar

> **Nota:** En modo demo (sin API keys), la app funciona completamente sin la Edge Function.
> Solo es necesaria para ejecutar órdenes reales en Gate.io.

---

## 🔐 SEGURIDAD

| Elemento | Protección |
|----------|------------|
| Repo GitHub | Privado — solo tú tienes acceso |
| Supabase Anon Key | OK en cliente — las políticas RLS limitan el acceso |
| Gate.io API Keys | Guardadas en Supabase Edge Function secrets (no en el cliente) |
| PIN de la app | Cifrado con CryptoJS — nunca viaja en texto plano |
| API Keys del usuario | Cifradas localmente con PIN antes de enviarse a Supabase |

---

## 📱 INSTALAR COMO PWA

### Android (Chrome)
1. Abre la URL de GitHub Pages en Chrome
2. Menú (⋮) → **Añadir a pantalla de inicio**

### iPhone (Safari)
1. Abre la URL en Safari
2. Botón compartir (□↑) → **Añadir a inicio**

---

## 🔄 ACTUALIZAR LA APP

```bash
# Después de modificar index.html:
git add index.html
git commit -m "fix: descripción del cambio"
git push

# GitHub Pages se actualiza automáticamente en ~1 min
```

---

## 📋 TABLAS SUPABASE — REFERENCIA RÁPIDA

| Tabla | Uso |
|-------|-----|
| `kv_store` | Todo el estado de la app (slots, config, historial) |
| `whitelist` | Lista de usuarios autorizados |
| `support_messages` | Chat soporte admin ↔ usuario |
| `trade_history` | Historial global de operaciones |
| Storage: `support-files` | Archivos adjuntos del chat |

---

## ⚙️ VERSIÓN

**5X V25.32** — 10 slots · Rebuy ×3 · Manual buys in AUTO · Legacy roi removed
