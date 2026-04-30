import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { createRouteRef } from '@backstage/core-plugin-api';

console.log('🟡 aws-pipelines plugin: Loading');

export const awsPipelinesRouteRef = createRouteRef({
  id: 'aws-pipelines',
});

export const awsPipelinesPlugin = createPlugin({
  id: 'aws-pipelines',
  routes: {
    root: awsPipelinesRouteRef,
  },
  externalRoutes: {},
});

export const AwsPipelinesPage = awsPipelinesPlugin.provide(
  createRoutableExtension({
    name: 'AwsPipelinesPage',
    component: () =>
      import('../components/aws').then(m => {
        console.log('🟢 aws-pipelines: Component loaded', m.AwsPipelinesPage);
        return m.AwsPipelinesPage;
      }),
    mountPoint: awsPipelinesRouteRef,
  }),
);

console.log('🟢 aws-pipelines plugin: Loaded');
