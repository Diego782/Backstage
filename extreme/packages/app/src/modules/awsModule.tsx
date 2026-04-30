import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { compatWrapper } from '@backstage/core-compat-api';
import { awsResourcesPlugin } from '../plugins/aws-resources';
import { awsPipelinesPlugin } from '../plugins/aws-pipelines';
import { awsCostsPlugin } from '../plugins/aws-costs';

export const awsModule = createFrontendModule({
  pluginId: 'aws',
  extensions: [
    compatWrapper(awsResourcesPlugin),
    compatWrapper(awsPipelinesPlugin),
    compatWrapper(awsCostsPlugin),
  ],
});
