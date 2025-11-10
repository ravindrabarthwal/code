import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../config';

export async function runMigrations() {
  console.log('Running database migrations...');

  // Create a new client specifically for migrations
  const migrationClient = postgres(config.databaseUrl, {
    max: 1, // Required for migrations
  });

  try {
    const db = drizzle(migrationClient);

    // Run Drizzle migrations
    await migrate(db, {
      migrationsFolder: './drizzle',
    });

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run migrations on startup in production
if (config.nodeEnv === 'production') {
  runMigrations();
}
