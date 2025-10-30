# 🏪 Walgreens Scanner - Sistema de Validación de Cuentas

Sistema profesional para validar cuentas de Walgreens en masa, con soporte para archivos de **1M+ números** de teléfono.

---

## 🚀 Instalación Rápida

```bash
# 1. Configurar
cp .env.example .env
nano .env  # Editar solo: DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET

# 2. Instalar
./install.sh

# 3. Iniciar
./start.sh
```

**[📖 Ver Guía Completa →](QUICKSTART.md)**

---

## ✨ Características

### 🎯 Scanner de Alto Rendimiento
- **Archivos Masivos**: Soporta 1M+ números por archivo (.txt/.csv)
- **Upload Instantáneo**: < 1 segundo para guardar archivos
- **Procesamiento Asíncrono**: Sin timeouts HTTP (proceso en background)
- **10 API Keys Paralelas**: 2,000 requests/minuto total
- **Rate Limiting Inteligente**: 200 req/min por key con sliding window
- **Progreso en Tiempo Real**: WebSocket updates cada 50k números
- **Auto-Recovery**: Continúa después de crashes/reinicios

### 📊 Panel de Administración
- **Dashboard Completo**: Estadísticas en tiempo real
- **Gestión de Cuentas**: Browse, search, filter por balance
- **API Keys Manager**: Configuración visual de todas las API keys
- **Export CSV**: Exporta cuentas válidas encontradas
- **Historial**: Tracking completo de actividad

### 🛡️ Deduplicación y Validación
- **Evita Duplicados**: No rescanea números ya procesados
- **Detección de Válidos**: Identifica cuentas con balance
- **Auto-Save**: Guarda automáticamente a `member_history`
- **Clasificación**: $100+, $50+, $20+, $10+, $5+

### 🔧 Dual Database Support
- **Neon Database**: Auto-detectado para Replit
- **PostgreSQL**: Auto-detectado para servidores propios
- **Zero Config**: Funciona en ambos automáticamente

---

## 📦 Tecnologías

**Backend:**
- Node.js + TypeScript + Express
- PostgreSQL + Drizzle ORM
- WebSocket (real-time updates)
- Rate Limiting avanzado

**Frontend:**
- React 18 + TypeScript
- TailwindCSS + Shadcn UI
- TanStack Query (state management)
- Wouter (routing)

---

## 🔑 API Keys de Walgreens

### Obtener API Keys

1. Visita: https://developer.walgreens.com
2. Crea cuenta developer
3. Solicita acceso:
   - Member API
   - Offers API  
   - Store Locator API
4. Recibirás:
   - API Key (ej: `uu6AyeO7XC...`)
   - Affiliate ID (ej: `AAAAAAAAAA`)

### Configurar en la App

1. Login → `/admin/settings`
2. Click "Add New API Key"
3. Ingresa API Key + Affiliate ID
4. Repite para las 10 keys

**Throughput:**
- 1 key = 200 req/min
- 10 keys = 2,000 req/min
- Procesar 1M números ≈ 8-10 horas

---

## 📱 Cómo Usar

### 1. Subir Archivos

- Click "Scanner" en sidebar
- Upload archivos .txt o .csv con números
- **Formato aceptado:**
  ```
  7866302522
  3055551234
  (786) 630-2522
  786-630-2522
  ```
- Soporta múltiples archivos simultáneamente

### 2. Procesar Archivos

- Click "Process Files" (extrae números)
- Espera que Status → "queued"
- Los números se guardan en cola

### 3. Iniciar Scanner

- Click "Start Scanner"
- El sistema:
  1. Consulta API de Walgreens
  2. Valida cada número
  3. Guarda cuentas válidas
  4. Actualiza progreso en vivo

### 4. Ver Resultados

- **Durante Scan**: Progress bar en tiempo real
- **Sidebar**: Badges se actualizan automáticamente
- **Member History**: Cuentas válidas aparecen aquí
- **Export**: Download CSV con todas las cuentas

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────┐
│   Upload    │ → Guarda archivo completo en DB
│   (.txt)    │    Status: pending (instantáneo)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Process   │ → Extrae números del archivo
│   Files     │    Status: processing → queued
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ scan_queue  │ → Cola de números únicos
│ (dedupe)    │    Evita duplicados
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Scanner    │ → Valida con API Walgreens
│  Service    │    10 keys en paralelo
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  scan_results  (válidos)    │
│  member_history (histórico) │
└─────────────────────────────┘
```

---

## 🔧 Scripts Útiles

```bash
# Desarrollo
npm run dev              # Iniciar en modo desarrollo

# Producción
./start.sh               # Iniciar servidor simple
./start-pm2.sh           # Iniciar con PM2 (daemon)
pm2 logs                 # Ver logs en tiempo real
pm2 restart all          # Reiniciar app

# Base de datos
npm run db:push          # Sincronizar schema
npm run db:push --force  # Forzar sync (data loss warning)
npm run db:studio        # UI visual de la DB

# Build
npm run build            # Compilar TypeScript
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Verifica PostgreSQL
sudo systemctl status postgresql

# Verifica DATABASE_URL en .env
echo $DATABASE_URL
```

### "Rate limit exceeded"
- Normal con 1 API key (200 req/min)
- Agrega más API keys para aumentar throughput
- El sistema auto-detecta todas las keys disponibles

### "Port 5000 already in use"
```bash
# Cambia puerto en .env
PORT=3000
```

### Scanner no progresa
```bash
# Ver logs
pm2 logs walgreens-scanner

# Reiniciar scanner
# En UI: Click "Stop Scanner" → "Start Scanner"
```

---

## 📚 Documentación

- **[QUICKSTART.md](QUICKSTART.md)** - Instalación rápida (recomendado)
- **[INSTALL.md](INSTALL.md)** - Guía completa detallada
- **[replit.md](replit.md)** - Arquitectura técnica

---

## 🔐 Seguridad

### En Producción

1. **Usa HTTPS** (Nginx + Let's Encrypt)
2. **Firewall PostgreSQL** (solo localhost)
3. **Cambia credenciales**:
   ```env
   ADMIN_PASSWORD=super_secure_password_xyz
   SESSION_SECRET=very_long_random_string_abc123
   ```
4. **Rate Limiting** (Nginx nivel web)
5. **Backups automáticos** de PostgreSQL
6. **Nunca commitees** el archivo `.env`

### API Keys

- Las API keys se almacenan **encriptadas** en PostgreSQL
- Solo accesibles via panel admin autenticado
- Nunca se logean en archivos de texto
- Se rotan automáticamente entre requests

---

## 📊 Rendimiento Esperado

| API Keys | Throughput    | 1M números |
|----------|---------------|------------|
| 1 key    | 200 req/min   | ~83 horas  |
| 4 keys   | 800 req/min   | ~21 horas  |
| 10 keys  | 2,000 req/min | ~8 horas   |

*Asume 100% valid numbers. Números inválidos procesan más rápido.*

---

## 🎯 Casos de Uso

1. **Validación Masiva**: Verificar bases de datos de clientes
2. **Limpieza de Datos**: Filtrar números válidos de listas
3. **Lead Generation**: Identificar cuentas activas con balance
4. **Market Research**: Analizar distribución de balances

---

## 🤝 Contribuir

Este es un proyecto privado. Para sugerencias o reportar bugs, contacta al administrador.

---

## 📜 Licencia

Uso privado únicamente. Todos los derechos reservados.

---

## 🚀 Status del Proyecto

- ✅ **Producción-ready**
- ✅ **Auto-recovery funcional**
- ✅ **WebSocket real-time**
- ✅ **Dual database support**
- ✅ **Rate limiting optimizado**

**Última actualización:** Octubre 2025

---

**¿Listo para comenzar?** → [QUICKSTART.md](QUICKSTART.md)
