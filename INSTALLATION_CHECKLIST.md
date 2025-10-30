# ✅ Lista de Verificación de Instalación

## 🔍 Verificaciones Pre-Instalación

### Sistema Base
- [ ] Ubuntu 20.04+ / CentOS 8+ / Debian 11+ instalado
- [ ] Usuario con permisos sudo configurado
- [ ] Conexión a internet estable
- [ ] Mínimo 2GB RAM disponible
- [ ] Mínimo 10GB espacio libre

### Software Requerido
- [ ] Node.js v18+ instalado (`node --version`)
- [ ] npm v8+ instalado (`npm --version`)
- [ ] PostgreSQL v13+ instalado (`psql --version`)
- [ ] Git instalado (`git --version`)

## 📦 Verificaciones Post-Instalación

### 1. Base de Datos
```bash
# Verificar conexión PostgreSQL
sudo -u postgres psql -c "\l"
```
- [ ] PostgreSQL ejecutándose correctamente
- [ ] Base de datos `walgreens_offers` creada
- [ ] Usuario `walgreens_user` con permisos

### 2. Aplicación
```bash
# Verificar dependencias
npm list --depth=0
```
- [ ] Todas las dependencias instaladas sin errores
- [ ] Archivo `.env` configurado correctamente
- [ ] Build generado exitosamente (`npm run build`)

### 3. APIs y Endpoints
```bash
# Verificar servidor funcionando
curl http://localhost:5000/api/health

# Verificar base de datos
curl "http://localhost:5000/api/member-history?page=1&size=1"

# Verificar funcionalidad marcar como usado
curl -X POST "http://localhost:5000/api/member-history/mark-used" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"TEST_PHONE","refreshedFromAPI":true,"moveToEnd":true}'
```
- [ ] API Health responde correctamente
- [ ] Consultas a base de datos funcionan
- [ ] Funcionalidad mark-as-used operativa

### 4. Frontend
```bash
# Verificar interfaz web
curl -I http://localhost:5000/
```
- [ ] Página principal carga correctamente
- [ ] Recursos estáticos accesibles
- [ ] No errores de consola JavaScript

### 5. Procesos en Segundo Plano
- [ ] Sistema de auto-reset configurado
- [ ] Background jobs funcionando
- [ ] Logs generándose correctamente

## 🚀 Pruebas Funcionales

### Test 1: Lookup de Miembro
1. Abrir http://localhost:5000
2. Ir a "Member Lookup"
3. Ingresar número de teléfono válido
4. Verificar que muestra información del miembro

- [ ] Lookup funciona correctamente

### Test 2: Control Panel
1. Ir a "Control Panel" 
2. Verificar lista de cuentas carga
3. Probar marcar/desmarcar cuenta como "usada"
4. Verificar cambios se reflejan inmediatamente

- [ ] Control panel operativo

### Test 3: Fast Scanner
1. Ir a "Fast Scanner"
2. Subir archivo con números de teléfono
3. Iniciar escaneo
4. Verificar progreso en tiempo real

- [ ] Fast scanner funcional

### Test 4: Auto-Reset System
1. Verificar logs del sistema
2. Confirmar detección de cuentas con actividad hoy
3. Verificar programación de reset nocturno

- [ ] Auto-reset configurado

## 🛡️ Verificaciones de Seguridad

### Variables de Entorno
- [ ] `.env` no está en repositorio git
- [ ] API keys no están hardcodeadas en código
- [ ] Passwords de base de datos seguros

### Permisos
- [ ] Aplicación NO ejecuta como root
- [ ] Archivos tienen permisos correctos (644 archivos, 755 directorios)
- [ ] Base de datos tiene usuario dedicado (no postgres)

### Firewall
- [ ] Solo puertos necesarios abiertos
- [ ] SSH configurado con keys (no passwords)
- [ ] Fail2ban instalado (recomendado)

## 📊 Métricas de Rendimiento

### Carga de Sistema
```bash
# Verificar recursos
htop
df -h
free -h
```
- [ ] CPU < 50% en reposo
- [ ] RAM < 70% utilizada
- [ ] Espacio disco > 20% libre

### Base de Datos
```sql
-- Verificar rendimiento DB
SELECT count(*) FROM member_history;
SELECT count(*) FROM api_key_pool;
```
- [ ] Consultas responden < 1 segundo
- [ ] Índices creados correctamente

### API Response Times
- [ ] Health endpoint: < 50ms
- [ ] Member history: < 500ms
- [ ] Mark as used: < 1000ms

## 🔄 Mantenimiento

### Backups
- [ ] Script de backup automático configurado
- [ ] Backup manual probado y funcional
- [ ] Restauración probada exitosamente

### Logs
- [ ] Rotación de logs configurada
- [ ] Logs archivándose correctamente
- [ ] Monitoreo de errores activo

### Actualizaciones
- [ ] Proceso de actualización documentado
- [ ] Git remote configurado correctamente
- [ ] PM2 ecosystem configurado

## ✅ Sign-Off Final

**Servidor:** _________________ **Fecha:** _____________

**Verificado por:** _____________________________________

### Lista Final de Funcionalidades Operativas:
- [ ] ✅ Sistema de Lookup de Miembros
- [ ] ✅ Gestión de Ofertas (Ver/Clipar)
- [ ] ✅ Fast Scanner con múltiples API keys
- [ ] ✅ Control Panel con mark-as-used
- [ ] ✅ Sistema de Auto-Reset nocturno
- [ ] ✅ Background jobs funcionando
- [ ] ✅ Base de datos PostgreSQL
- [ ] ✅ Frontend responsivo móvil/escritorio
- [ ] ✅ APIs de Walgreens integradas
- [ ] ✅ Sistema de logging detallado
- [ ] ✅ 0 errores LSP/TypeScript
- [ ] ✅ Build de producción optimizado

### Notas Adicionales:
_________________________________________________
_________________________________________________
_________________________________________________

---

**🎉 INSTALACIÓN COMPLETA Y VERIFICADA**

Tu aplicación Walgreens Offers Explorer está lista para producción con todas las funcionalidades operativas al 100%.