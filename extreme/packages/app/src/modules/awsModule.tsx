import { createFrontendModule } from '@backstage/frontend-plugin-api';

// This module is kept for reference but the AWS extensions are now
// registered directly in App.tsx using createExtension.
export const awsModule = createFrontendModule({
  pluginId: 'aws',
  extensions: [],
});
