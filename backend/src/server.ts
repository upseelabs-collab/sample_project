import { createApp } from './app.js';
import { env, checkConfigStatus } from './config/env.config.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CreatorConnect Backend Server is running!`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`🌐 Frontend Allowed: ${env.FRONTEND_URL}`);
  console.log(`⚙️  Environment: ${env.NODE_ENV}`);
  console.log(`=======================================================`);
  
  const status = checkConfigStatus();
  if (status.isConfigured) {
    console.log(`✅ Instagram Meta App Configuration: READY`);
  } else {
    console.log(`⚠️  Instagram Configuration Notice:`);
    status.missing.forEach((item) => console.log(`   - ${item}`));
    console.log(`   (Provide these in your .env file or use tester token)`);
  }
  console.log(`=======================================================\n`);
});
