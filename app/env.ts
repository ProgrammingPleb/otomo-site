const postgresUser = process.env.POSTGRES_USER;
const postgresPassword = process.env.POSTGRES_PASSWORD;
const postgresDB = process.env.POSTGRES_DB;

if (!postgresUser || !postgresPassword || !postgresDB) {
    throw new Error("DB: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB were not set!")
}

export const databaseUrl = `postgres://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDB}`;
