import { db } from "./db";
import { adminUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * Initialize default admin user if none exists
 * Creates an admin user with credentials from environment variables
 */
export async function initializeAdminUser() {
  try {
    console.log('🔐 Verificando usuario admin...');

    // Check if any admin user exists
    const existingAdmins = await db.select().from(adminUsers).limit(1);

    if (existingAdmins.length > 0) {
      console.log('✅ Usuario admin ya existe en la base de datos');
      return;
    }

    // Get admin credentials from environment or use defaults
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Nilopienses88@.';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@walgreens-manager.local';

    console.log('📝 No se encontró usuario admin. Creando usuario por defecto...');

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    // Create the admin user
    await db.insert(adminUsers).values({
      username: adminUsername,
      passwordHash: passwordHash,
    });

    console.log('✅ Usuario admin creado exitosamente');
    console.log(`   👤 Usuario: ${adminUsername}`);
    console.log(`   📧 Email: ${adminEmail}`);
    console.log(`   🔑 Contraseña: ${adminPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión');
    console.log('');

  } catch (error) {
    console.error('❌ Error al inicializar usuario admin:', error);
    // Don't throw - allow the app to continue even if admin creation fails
  }
}
