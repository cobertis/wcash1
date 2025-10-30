# 🚀 Instalación en Tu Servidor

## Tu Configuración
```bash
DATABASE_URL="postgresql://walgreens_user:TuNuevaPass1234@localhost:5432/walgreens_offers"
```

---

## ✅ Pasos para Instalar (Copia y Pega)

### 1. Ir a tu directorio
```bash
cd /root/wcash
```

### 2. Crear .env con TU configuración
```bash
cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://walgreens_user:TuNuevaPass1234@localhost:5432/walgreens_offers"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MiPassword123
SESSION_SECRET=$(openssl rand -base64 32 | head -c 32)
NODE_ENV=production
PORT=5000
ENVEOF
```

### 3. Limpiar instalación anterior
```bash
rm -rf node_modules dist
```

### 4. Dar permisos a scripts
```bash
chmod +x *.sh
```

### 5. Ejecutar diagnóstico (opcional pero recomendado)
```bash
./diagnose.sh
```
Esto te dirá si falta algo ANTES de instalar.

### 6. Instalar
```bash
./install.sh
```
**NOTA:** Los scripts ya están arreglados. Si da error "drizzle-kit not found", descarga los archivos nuevos del repo.

### 7. Build de producción
```bash
./build-production.sh
```

### 8. Instalar PM2 (si no lo tienes)
```bash
npm install -g pm2
```

### 9. Iniciar con PM2
```bash
./start-pm2.sh
```

### 10. Verificar que funciona
```bash
# Health check
curl http://localhost:5000/health

# Debe retornar algo como:
# {"status":"ok","timestamp":"2025-10-28T...","uptime":123}
```

### 11. Ver logs
```bash
pm2 logs walgreens-scanner
```

---

## 🌐 Acceder a la Aplicación

### Sin Caddy (solo IP)
```
http://TU-IP:5000
```

### Con Caddy (dominio)
Primero configura Caddy:
```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
# Busca "tu-dominio.com" y cambia por tu dominio real
sudo systemctl reload caddy
```

Luego accede:
```
https://tu-dominio.com
```

---

## 🔑 Login Inicial

1. Abre el navegador
2. Ve a tu IP o dominio
3. Login:
   - **Usuario:** `admin`
   - **Password:** `MiPassword123` (el que pusiste en .env)

---

## ⚙️ Configurar API Keys

1. Una vez dentro, click en tab **"Configuration"**
2. Click **"Add New API Key"**
3. Ingresa:
   - **API Key:** Tu key de Walgreens
   - **Affiliate ID:** Tu affiliate ID
   - **Name:** APP 1 (o el nombre que quieras)
4. Click **"Add API Key"**
5. Repite para tus otras 9 keys (si las tienes)

---

## 🎯 ¡Listo para Usar!

Ahora puedes:
- ✅ Subir archivos .txt/.csv con números
- ✅ Procesar archivos (extrae números)
- ✅ Iniciar scanner (valida cuentas)
- ✅ Ver progreso en tiempo real
- ✅ Export cuentas válidas a CSV

---

## 🐛 Solución de Problemas

### Error: "drizzle-kit: not found"
```bash
# Los nuevos scripts ya lo arreglan
# Si persiste, asegúrate de tener los archivos actualizados
npm install
```

### Error: "Cannot connect to database"
```bash
# Verifica PostgreSQL
sudo systemctl status postgresql

# Prueba conexión manual
psql -U walgreens_user -d walgreens_offers -c "SELECT 1"

# Si falla, verifica que la base de datos existe:
sudo -u postgres psql -c "CREATE DATABASE walgreens_offers OWNER walgreens_user;"
```

### Error: "Port 5000 already in use"
```bash
# Cambiar puerto en .env
echo "PORT=3000" >> .env

# Reiniciar
pm2 restart walgreens-scanner
```

### La app no carga
```bash
# Ver logs detallados
pm2 logs walgreens-scanner --lines 100

# Ver estado
pm2 status

# Reiniciar
pm2 restart walgreens-scanner

# Si nada funciona, reiniciar desde cero:
pm2 delete walgreens-scanner
./start-pm2.sh
```

### WebSocket no funciona (progreso no actualiza)
Si usas Caddy, asegúrate que el Caddyfile tiene:
```caddyfile
reverse_proxy localhost:5000 {
    header_up Connection {>Connection}
    header_up Upgrade {>Upgrade}
}
```

Luego: `sudo systemctl reload caddy`

---

## 📊 Comandos Útiles

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs walgreens-scanner

# Reiniciar
pm2 restart walgreens-scanner

# Detener
pm2 stop walgreens-scanner

# Ver uso de recursos
pm2 monit

# Guardar configuración (auto-inicio)
pm2 save

# Health check
curl http://localhost:5000/health
```

---

## 🔄 Actualizar la App

```bash
cd /root/wcash
pm2 stop walgreens-scanner
git pull  # o copia archivos nuevos
npm install
./build-production.sh
pm2 restart walgreens-scanner
pm2 logs
```

---

## ✅ Checklist de Instalación

- [ ] PostgreSQL corriendo
- [ ] .env configurado con DATABASE_URL correcta
- [ ] `./diagnose.sh` pasa sin errores
- [ ] `./install.sh` completa sin errores
- [ ] `./build-production.sh` completa sin errores
- [ ] PM2 instalado globalmente
- [ ] `./start-pm2.sh` inicia la app
- [ ] `curl http://localhost:5000/health` retorna {"status":"ok"}
- [ ] Puedo acceder desde el navegador
- [ ] Puedo hacer login
- [ ] API Keys configuradas

---

**¿Problemas?** Ejecuta `./diagnose.sh` primero - te dirá exactamente qué falta.
