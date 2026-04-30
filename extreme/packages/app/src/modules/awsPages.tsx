import React from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { convertLegacyRouteRefs } from '@backstage/core-compat-api';
import { 
  awsResourcesPlugin, 
  awsResourcesRouteRef 
} from '../plugins/aws-resources';
import { 
  awsPipelinesPlugin, 
  awsPipelinesRouteRef 
} from '../plugins/aws-pipelines';
import { 
  awsCostsPlugin, 
  awsCostsRouteRef 
} from '../plugins/aws-costs';

console.log('🔵 AWS Module: Loading plugins...');

export const awsModule = createFrontendModule({
  pluginId: 'aws',
  extensions: [
    convertLegacyRouteRefs({
      'aws-resources': awsResourcesRouteRef,
      'aws-pipelines': awsPipelinesRouteRef,
      'aws-costs': awsCostsRouteRef,
    }),
  ],
});

console.log('🔵 AWS Module: Loaded');
