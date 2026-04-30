import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from '../services/aws-resources';

export default createBackendPlugin({
  pluginId: 'aws-resources',
  register(env) {
    env.registerInit({
      deps: {
        http: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
      },
      async init({ http, logger, config, httpAuth }) {
        const router = await createRouter({
          logger,
          config,
        });
        http.use(router);
        http.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        http.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });
        logger.info('AWS Resources plugin initialized');
      },
    });
  },
});
