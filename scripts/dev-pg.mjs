import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create();
const port = Number(process.env.DEV_PG_PORT || 5433);
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log(`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.stop(); await db.close(); process.exit(0); });
