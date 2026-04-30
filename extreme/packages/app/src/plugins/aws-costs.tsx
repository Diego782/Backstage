import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { createRouteRef } from '@backstage/core-plugin-api';

console.log('🟡 aws-costs plugin: Loading');

export const awsCostsRouteRef = createRouteRef({
  id: 'aws-costs',
});

export const awsCostsPlugin = createPlugin({
  id: 'aws-costs',
  routes: {
    root: awsCostsRouteRef,
  },
  externalRoutes: {},
});

export const AwsCostsPage = awsCostsPlugin.provide(
  createRoutableExtension({
    name: 'AwsCostsPage',
    component: () =>
      import('../components/aws').then(m => {
        console.log('🟢 aws-costs: Component loaded', m.AwsCostsPage);
        return m.AwsCostsPage;
      }),
    mountPoint: awsCostsRouteRef,
  }),
);

console.log('🟢 aws-costs plugin: Loaded');
