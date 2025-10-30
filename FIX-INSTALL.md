# FIX para tu servidor

Los scripts tenían 2 bugs que ya arreglé:

## PROBLEMA 1: drizzle-kit not found
**Causa:** `npm install --production` no instala devDependencies (drizzle-kit, typescript, vite)

**Fix:** Cambié `install.sh` para usar `npm install` (sin --production)

## PROBLEMA 2: tsc not found  
**Causa:** TypeScript estaba en devDependencies

**Fix:** Cambié `build-production.sh` para usar `npm run build` (que ya está configurado correctamente)

---

## REINSTALAR EN TU SERVIDOR

```bash
cd /root/wcash

# 1. Limpiar instalación anterior
rm -rf node_modules dist

# 2. Instalar de nuevo (scripts ya arreglados)
./install.sh

# 3. Build de producción
./build-production.sh

# 4. Iniciar
./start-pm2.sh
```

---

## SI AÚN HAY ERRORES

### Error: "drizzle-kit: not found"
```bash
# Verificar que está instalado
npm list drizzle-kit

# Si no aparece, instalar:
npm install
```

### Error: Cannot connect to database
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Probar conexión
psql "postgresql://walgreens:password@localhost:5432/walgreens_scanner" -c "SELECT 1"
```

### Error al hacer push de DB
```bash
# Forzar push
npm run db:push -- --force
```

---

¡Los scripts ya están arreglados en el código!
Solo necesitas hacer git pull o descargar los nuevos archivos.
