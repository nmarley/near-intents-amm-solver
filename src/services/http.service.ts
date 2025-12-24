import type { Server } from 'bun';
import { LoggerService } from './logger.service';

export class HttpService {
  private server?: Server<undefined>;

  private logger = new LoggerService('http');

  public start() {
    const port = process.env.APP_PORT;

    this.server = Bun.serve({
      port: Number(port),

      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === '/') {
          return new Response(JSON.stringify({ ready: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(null, { status: 404 });
      },

      error(error) {
        throw error;
      },
    });

    this.logger.info(`HTTP server started listening on port ${port}`);
  }

  public stop() {
    this.server?.stop();
  }
}
