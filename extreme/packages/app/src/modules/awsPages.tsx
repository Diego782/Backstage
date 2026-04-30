import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  awsResourcesRouteRef,
} from '../plugins/aws-resources';
import {
  awsPipelinesRouteRef,
} from '../plugins/aws-pipelines';
import {
  awsCostsRouteRef,
} from '../plugins/aws-costs';

console.log('🔵 AWS Module: Loading plugins...');

// Route refs are kept available for external route binding.
// The actual page extensions are registered in App.tsx.
export const awsRouteRefs = {
  'aws-resources': awsResourcesRouteRef,
  'aws-pipelines': awsPipelinesRouteRef,
  'aws-costs': awsCostsRouteRef,
};

export const awsModule = createFrontendModule({
  pluginId: 'aws',
  extensions: [],
});

console.log('🔵 AWS Module: Loaded');
