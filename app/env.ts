export const postgresUser = process.env.POSTGRES_USER;
export const postgresPassword = process.env.POSTGRES_PASSWORD;
export const postgresHost = process.env.POSTGRES_HOST;
export const postgresPort = process.env.POSTGRES_PORT;
export const postgresDB = process.env.POSTGRES_DB;

export const databaseUrl = `postgres://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDB}`;
