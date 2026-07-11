import { workerEventSchema } from '@luke/contracts';

import { ProtocolHandler } from './protocol-handler';

const handler = new ProtocolHandler();

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  for (const message of handler.handle(event.data)) {
    self.postMessage(workerEventSchema.parse(message));
  }
});
