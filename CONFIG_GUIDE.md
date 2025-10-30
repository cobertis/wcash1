# 🔧 Guía de Configuración de API Keys

## 📋 Configuración Completa del Archivo .env

Crea un archivo llamado `.env` en la raíz de tu aplicación con esta configuración:

```env
# Database Configuration - Cambia estos valores por los de tu servidor
DATABASE_URL=postgresql://tu_usuario:tu_password@localhost:5432/walgreens_offers

# API Key Principal - Pon tu API key principal aquí
WALGREENS_API_KEY=TU_API_KEY_PRINCIPAL_AQUI
WALGREENS_AFF_ID=AAAAAAAAAA

# Las 4 API Keys para Fast Scanner - Sustituye con tus 4 keys reales
WALGREENS_API_KEY_CLAUDIO=TU_KEY_CLAUDIO_AQUI
WALGREENS_API_KEY_ESTRELLA=TU_KEY_ESTRELLA_AQUI
WALGREENS_API_KEY_RICHARD=TU_KEY_RICHARD_AQUI
WALGREENS_API_KEY_XAVI=TU_KEY_XAVI_AQUI
WALGREENS_AFF_ID_ALL=AAAAAAAAAA

# Base URLs - NO CAMBIAR ESTOS VALORES
WALGREENS_API_BASE_URL=https://services.walgreens.com

# Server Configuration
PORT=5000
NODE_ENV=production
```

## 🔑 Cómo Configurar tus 4 API Keys

### Ejemplo de Configuración Real:

```env
# Si tienes estas 4 API keys (ejemplo):
# Key 1: abc123def456
# Key 2: xyz789ghi012  
# Key 3: mno345pqr678
# Key 4: stu901vwx234

WALGREENS_API_KEY=abc123def456
WALGREENS_API_KEY_CLAUDIO=abc123def456
WALGREENS_API_KEY_ESTRELLA=xyz789ghi012
WALGREENS_API_KEY_RICHARD=mno345pqr678
WALGREENS_API_KEY_XAVI=stu901vwx234
```

## 📊 ¿Cómo Funciona el Sistema de 4 Keys?

### Capacidad Máxima:
- **1 API Key**: 300 requests/minuto
- **4 API Keys**: 1,200 requests/minuto (4x más rápido)

### Funcionamiento Automático:
- La aplicación **rota automáticamente** entre las 4 keys
- Si una key falla, usa las otras automáticamente
- **Fast Scanner** usa todas las keys en paralelo
- Sistema de **rate limiting** inteligente

## 🗄️ Configuración de Base de Datos

### PostgreSQL Local:
```env
DATABASE_URL=postgresql://walgreens_user:tu_password_seguro@localhost:5432/walgreens_offers
```

### PostgreSQL Remoto (ejemplo):
```env
DATABASE_URL=postgresql://usuario:password@tu-servidor.com:5432/walgreens_offers
```

## ⚙️ Configuración del Servidor

### Producción:
```env
NODE_ENV=production
PORT=5000
```

### Desarrollo (para testing):
```env
NODE_ENV=development
PORT=3000
```

## 🔍 Verificar Configuración

Después de configurar el `.env`, verifica que funciona:

```bash
# Iniciar la aplicación
npm start

# En otra terminal, probar API
curl http://localhost:5000/api/health

# Verificar que las 4 keys se cargaron
# Busca en los logs: "Found 4 API keys in database"
```

## ⚠️ Importante - Seguridad

### ✅ Hacer:
- Mantener el archivo `.env` **privado**
- **NO subir** `.env` a GitHub
- Usar passwords de DB **seguros**
- Cambiar el puerto si es necesario

### ❌ NO hacer:
- NO compartir las API keys
- NO poner las keys en el código
- NO usar el mismo password para todo

## 🚨 Solución de Problemas

### Error: "API keys not found"
- Verifica que el archivo `.env` está en la raíz del proyecto
- Asegúrate de que las variables tienen los nombres exactos
- Reinicia la aplicación después de cambiar `.env`

### Error: "Database connection failed"
- Verifica que PostgreSQL está corriendo
- Confirma usuario/password/nombre de DB
- Verifica que el puerto 5432 está abierto

### Error: "Rate limit exceeded"
- Es normal, la aplicación rotará a la siguiente key automáticamente
- Con 4 keys tienes 1200 requests/minuto total

## 📝 Plantilla Lista para Copiar

Copia esto en tu archivo `.env` y sustituye los valores:

```env
DATABASE_URL=postgresql://TU_USUARIO_DB:TU_PASSWORD_DB@localhost:5432/walgreens_offers
WALGREENS_API_KEY=TU_KEY_PRINCIPAL
WALGREENS_AFF_ID=AAAAAAAAAA
WALGREENS_API_KEY_CLAUDIO=TU_KEY_1
WALGREENS_API_KEY_ESTRELLA=TU_KEY_2
WALGREENS_API_KEY_RICHARD=TU_KEY_3
WALGREENS_API_KEY_XAVI=TU_KEY_4
WALGREENS_AFF_ID_ALL=AAAAAAAAAA
WALGREENS_API_BASE_URL=https://services.walgreens.com
PORT=5000
NODE_ENV=production
```

Con esta configuración tendrás tu aplicación corriendo al máximo rendimiento con las 4 API keys funcionando en paralelo.