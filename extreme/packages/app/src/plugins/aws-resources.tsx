import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { createRouteRef } from '@backstage/core-plugin-api';

console.log('🟡 aws-resources plugin: Loading');

export const awsResourcesRouteRef = createRouteRef({
  id: 'aws-resources',
});

export const awsResourcesPlugin = createPlugin({
  id: 'aws-resources',
  routes: {
    root: awsResourcesRouteRef,
  },
  externalRoutes: {},
});

export const AwsResourcesPage = awsResourcesPlugin.provide(
  createRoutableExtension({
    name: 'AwsResourcesPage',
    component: () =>
      import('../components/aws').then(m => {
        console.log('🟢 aws-resources: Component loaded', m.AwsResourcesPage);
        return m.AwsResourcesPage;
      }),
    mountPoint: awsResourcesRouteRef,
  }),
);

console.log('🟢 aws-resources plugin: Loaded');
