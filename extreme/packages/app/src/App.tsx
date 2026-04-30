import React from 'react';
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { 
  createExtension,
  coreExtensionData,
} from '@backstage/frontend-plugin-api';

console.log('🟢 App.tsx: Loading app');

// Create custom page extensions
const awsResourcesPage = createExtension({
  name: 'aws-resources',
  attachTo: { id: 'app/routes', input: 'routes' },
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  factory() {
    console.log('🔵 Creating AWS Resources Page extension');
    const LazyComponent = React.lazy(() => 
      import('./components/aws/AwsResourcesPage').then(m => ({ default: m.AwsResourcesPage }))
    );
    return [
      coreExtensionData.reactElement(<React.Suspense fallback={<div>Loading...</div>}><LazyComponent /></React.Suspense>),
      coreExtensionData.routePath('/aws-resources'),
    ];
  },
});

const awsPipelinesPage = createExtension({
  name: 'aws-pipelines',
  attachTo: { id: 'app/routes', input: 'routes' },
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  factory() {
    console.log('🔵 Creating AWS Pipelines Page extension');
    const LazyComponent = React.lazy(() => 
      import('./components/aws/AwsPipelinesPage').then(m => ({ default: m.AwsPipelinesPage }))
    );
    return [
      coreExtensionData.reactElement(<React.Suspense fallback={<div>Loading...</div>}><LazyComponent /></React.Suspense>),
      coreExtensionData.routePath('/aws-pipelines'),
    ];
  },
});

const awsCostsPage = createExtension({
  name: 'aws-costs',
  attachTo: { id: 'app/routes', input: 'routes' },
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  factory() {
    console.log('🔵 Creating AWS Costs Page extension');
    const LazyComponent = React.lazy(() => 
      import('./components/aws/AwsCostsPage').then(m => ({ default: m.AwsCostsPage }))
    );
    return [
      coreExtensionData.reactElement(<React.Suspense fallback={<div>Loading...</div>}><LazyComponent /></React.Suspense>),
      coreExtensionData.routePath('/aws-costs'),
    ];
  },
});

// Create module with the extensions
const awsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    awsResourcesPage,
    awsPipelinesPage,
    awsCostsPage,
  ],
});

console.log('🟢 AWS Module created');

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    awsModule,
  ],
});
