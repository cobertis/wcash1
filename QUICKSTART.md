# 🚀 Instalación Rápida - Walgreens Scanner

## Requisitos
- **Node.js 18+** - [Descargar aquí](https://nodejs.org)
- **PostgreSQL 14+** - Base de datos

## Instalación en 3 Pasos

### 1️⃣ Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar configuración
nano .env
```

**Edita solo estas 3 variables:**

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/walgreens_scanner
ADMIN_PASSWORD=tu_contraseña_segura
SESSION_SECRET=un_string_random_muy_largo_abc123xyz
```

### 2️⃣ Instalar

```bash
./install.sh
```

Esto instala dependencias y crea la base de datos automáticamente.

### 3️⃣ Iniciar

```bash
./start.sh
```

O con PM2 para producción:

```bash
npm install -g pm2
./start-pm2.sh
```

---

## 🎯 Acceder

1. Abre tu navegador: `http://localhost:5000`
2. Login:
   - Usuario: `admin`
   - Contraseña: la que pusiste en `.env`

## ⚙️ Configurar API Keys

1. Una vez dentro, ve a la pestaña **"Configuration"**
2. Click **"Add New API Key"**
3. Agrega tus API keys de Walgreens:
   - API Key
   - Affiliate ID
   - Nombre (ej: "APP 1", "APP 2")

Necesitas al menos **1 API key** para funcionar.  
Para máximo rendimiento, agrega **10 API keys** (2,000 req/min total).

---

## 🔧 Obtener API Keys de Walgreens

1. Visita: https://developer.walgreens.com
2. Crea cuenta de desarrollador
3. Solicita acceso a estas APIs:
   - Member API
   - Offers API
   - Store Locator API
4. Obtendrás:
   - **API Key** (ej: `uu6AyeO7XC...`)
   - **Affiliate ID** (ej: `AAAAAAAAAA`)

---

## 📁 Estructura de Archivos

```
walgreens-scanner/
├── .env              ← Tu configuración (NO compartir)
├── .env.example      ← Plantilla de configuración
├── install.sh        ← Script de instalación
├── start.sh          ← Iniciar servidor
├── start-pm2.sh      ← Iniciar con PM2
├── server/           ← Código backend
├── client/           ← Código frontend
└── shared/           ← Código compartido
```

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to database"
```bash
# Verifica que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verifica DATABASE_URL en .env
```

### Error: "Port 5000 already in use"
```bash
# Cambia el puerto en .env
PORT=3000
```

### Ver logs con PM2
```bash
pm2 logs walgreens-scanner
```

---

## 🔄 Actualizar la App

```bash
git pull
npm install
npm run db:push --force
pm2 restart all
```

---

## 🎉 ¡Listo!

Ya tienes tu scanner funcionando. El sistema:

✅ Soporta archivos con **1M+ números** de teléfono  
✅ **Procesa en background** sin timeouts  
✅ **Rotación automática** de 10 API keys  
✅ **Rate limiting** inteligente (200 req/min por key)  
✅ **Progreso en tiempo real** con WebSockets  
✅ **Auto-recovery** si se crashea  
✅ **Export a CSV** de cuentas válidas  

---

## 📞 Soporte

¿Problemas? Revisa los logs:
```bash
pm2 logs
```

Para preguntas técnicas, revisa la documentación completa en `INSTALL.md`.
