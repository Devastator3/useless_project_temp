const fs = require('fs').promises;
const path = require('path');

async function setupProject() {
  console.log('🚌 Setting up Bus Bell Detection Backend...\n');

  try {
    // Create required directories
    const directories = [
      'uploads',
      'uploads/audio',
      'data',
      'data/sessions',
      'data/exports',
      'logs',
      'public',
      'tests'
    ];

    console.log('📁 Creating directories...');
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`   ✓ Created ${dir}/`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.log(`   ❌ Failed to create ${dir}/: ${error.message}`);
        } else {
          console.log(`   ✓ ${dir}/ already exists`);
        }
      }
    }

    // Create .env file from example if it doesn't exist
    console.log('\n🔧 Setting up environment configuration...');
    try {
      await fs.access('.env');
      console.log('   ✓ .env file already exists');
    } catch {
      try {
        const envExample = await fs.readFile('.env.example', 'utf8');
        await fs.writeFile('.env', envExample);
        console.log('   ✓ Created .env file from template');
      } catch (error) {
        console.log('   ⚠️  Could not create .env file. Please create it manually.');
      }
    }

    // Create gitignore file
    console.log('\n📝 Creating .gitignore...');
    const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Uploads and data
uploads/
data/sessions/
data/exports/
logs/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Temporary folders
tmp/
temp/

# Build outputs
dist/
build/
`;

    try {
      await fs.writeFile('.gitignore', gitignoreContent);
      console.log('   ✓ Created .gitignore');
    } catch (error) {
      console.log('   ❌ Failed to create .gitignore');
    }

    // Create README file
    console.log('\n📖 Creating README.md...');
    const readmeContent = `# Bus Bell Detection Backend

🚌 AI-powered backend system for detecting bus bells in real-time audio streams.

## Features

- **Real-time Audio Processing**: WebSocket-based live audio analysis
- **AI Bell Detection**: Smart detection of single and double bell patterns
- **Session Management**: Track multiple concurrent detection sessions
- **REST API**: Complete API for data access and management
- **File Upload**: Support for audio file processing
- **Data Export**: JSON export of detection data
- **Statistics**: Real-time statistics and analytics

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Setup the project:**
   \`\`\`bash
   npm run setup
   \`\`\`

3. **Configure environment:**
   - Copy \`.env.example\` to \`.env\`
   - Update configuration values as needed

4. **Start the server:**
   \`\`\`bash
   npm start
   \`\`\`

   For development with auto-reload:
   \`\`\`bash
   npm run dev
   \`\`\`

## API Endpoints

### Session Management
- \`GET /api/stats\` - Get global statistics
- \`GET /api/session/:id\` - Get session data
- \`GET /api/session/:id/export\` - Export session data

### Audio Processing
- \`POST /api/session/:id/upload-audio\` - Upload and process audio file

### Historical Data
- \`GET /api/history\` - Get historical detection data with filtering

### Health Check
- \`GET /health\` - Server health status

## WebSocket Events

### Client → Server
- \`startRecording\` - Start audio detection session
- \`stopRecording\` - Stop audio detection session
- \`audioData\` - Send real-time audio chunks

### Server → Client
- \`sessionCreated\` - New session created
- \`recordingStarted\` - Recording session started
- \`recordingStopped\` - Recording session stopped
- \`bellDetected\` - Bell detection result

## Project Structure

\`\`\`
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration
├── setup.js              # Project setup script
├── uploads/              # Audio file uploads
├── data/                 # Session and export data
├── logs/                 # Server logs
└── public/               # Static files
\`\`\`

## Development

- \`npm run dev\` - Start with nodemon for auto-reload
- \`npm test\` - Run tests
- \`npm run lint\` - Run ESLint
- \`npm run clean\` - Clean upload and data directories

## Environment Variables

See \`.env.example\` for all available configuration options.

## License

MIT License - see LICENSE file for details.
`;

    try {
      await fs.writeFile('README.md', readmeContent);
      console.log('   ✓ Created README.md');
    } catch (error) {
      console.log('   ❌ Failed to create README.md');
    }

    // Create a simple test file
    console.log('\n🧪 Creating test files...');
    const testContent = `const request = require('supertest');
// Test file would be implemented here
// const app = require('../server');

describe('Bus Bell Detection API', () => {
  test('Health check endpoint', async () => {
    // Test implementation
    expect(true).toBe(true);
  });

  test('Statistics endpoint', async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
`;

    try {
      await fs.writeFile('tests/api.test.js', testContent);
      console.log('   ✓ Created test/api.test.js');
    } catch (error) {
      console.log('   ❌ Failed to create test files');
    }

    // Success message
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm install');
    console.log('2. Configure your .env file');
    console.log('3. Run: npm start');
    console.log('\n🚌 Your Bus Bell Detection Backend will be ready!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupProject();
}

module.exports = setupProject;