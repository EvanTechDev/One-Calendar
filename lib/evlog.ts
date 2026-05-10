import { createEvlog } from 'evlog';
import { createFsDrain } from 'evlog/adapters/fs';
import { signed } from 'evlog/adapters/signed';

export const evlog = createEvlog({
  service: 'one-calendar',
  enrich: (event) => {
    return {
      ...event,
      timestamp: new Date().toISOString(),
    };
  },
  drain: [
    signed(createFsDrain({ dir: '.audit' }), {
      strategy: 'hash-chain',
      await: true,
    }),
  ],
});

export const { withEvlog, useLogger, createError } = evlog;
