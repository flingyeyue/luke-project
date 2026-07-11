import { workerEventSchema } from '@luke/contracts';

import { ProtocolHandler } from './protocol-handler';

const handler = new ProtocolHandler();

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  void handler.handle(event.data).then((messages) => {
    for (const message of messages) {
      self.postMessage(workerEventSchema.parse(message));
    }
  });
});
