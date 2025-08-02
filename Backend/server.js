const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads (audio files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/audio/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory data store (in production, use a proper database)
let sessions = new Map();
let globalStats = {
  totalSessions: 0,
  totalBellsDetected: 0,
  totalStops: 0,
  activeUsers: 0
};

// Bell detection logic and utilities
class BellDetectionService {
  constructor() {
    this.bellPatterns = {
      single: { frequency: [800, 1200], duration: [100, 500] },
      double: { interval: [50, 300], maxGap: 1500 }
    };
  }

  // Simulate AI bell detection (replace with actual ML model)
  async detectBells(audioBuffer, sessionId) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock detection logic - replace with actual audio analysis
    const mockDetection = Math.random();
    
    if (mockDetection > 0.7) {
      const session = sessions.get(sessionId);
      const currentTime = Date.now();
      const lastBell = session?.lastBellTime || 0;
      const timeSinceLastBell = currentTime - lastBell;
      
      let detectionResult = {
        type: 'single',
        confidence: 0.85 + Math.random() * 0.15,
        timestamp: currentTime,
        frequency: 900 + Math.random() * 300,
        duration: 200 + Math.random() * 200
      };

      // Check for double bell pattern
      if (timeSinceLastBell < this.bellPatterns.double.maxGap && timeSinceLastBell > 50) {
        detectionResult.type = 'double';
        detectionResult.confidence += 0.1;
      }

      return detectionResult;
    }
    
    return null;
  }

  // Process bell detection and update session
  async processBellDetection(detection, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const bellEvent = {
      id: uuidv4(),
      type: detection.type,
      timestamp: detection.timestamp,
      confidence: detection.confidence,
      frequency: detection.frequency,
      duration: detection.duration,
      time: new Date(detection.timestamp).toLocaleTimeString()
    };

    // Update session data
    session.bellHistory.unshift(bellEvent);
    session.lastBellTime = detection.timestamp;
    session.lastActivity = detection.timestamp;

    if (detection.type === 'single') {
      session.singleBells++;
      session.busStatus = 'stopping';
      session.statusChanged = detection.timestamp;
    } else if (detection.type === 'double') {
      session.doubleBells++;
      session.totalStops++;
      session.busStatus = 'starting';
      session.statusChanged = detection.timestamp;
      
      // Adjust single bell count if this completes a cycle
      if (session.bellHistory.length > 1 && 
          session.bellHistory[1].type === 'single') {
        session.singleBells--;
      }
    }

    // Add timeline event
    const timelineEvent = {
      id: uuidv4(),
      type: detection.type === 'single' ? 'stopping' : 'starting',
      text: detection.type === 'single' ? 'Bus is stopping' : 'Bus is starting',
      timestamp: detection.timestamp,
      time: bellEvent.time,
      confidence: detection.confidence
    };

    session.timeline.unshift(timelineEvent);
    
    // Keep only last 10 timeline events
    if (session.timeline.length > 10) {
      session.timeline = session.timeline.slice(0, 10);
    }

    // Reset bus status to idle after 10 seconds
    setTimeout(() => {
      if (session.statusChanged === detection.timestamp) {
        session.busStatus = 'idle';
      }
    }, 10000);

    // Update global stats
    globalStats.totalBellsDetected++;
    if (detection.type === 'double') {
      globalStats.totalStops++;
    }

    return {
      bellEvent,
      timelineEvent,
      sessionStats: {
        singleBells: session.singleBells,
        doubleBells: session.doubleBells,
        totalStops: session.totalStops,
        busStatus: session.busStatus
      }
    };
  }
}

const bellDetectionService = new BellDetectionService();

// Session management
function createSession(socketId) {
  const session = {
    id: uuidv4(),
    socketId,
    startTime: Date.now(),
    isRecording: false,
    singleBells: 0,
    doubleBells: 0,
    totalStops: 0,
    bellHistory: [],
    timeline: [],
    busStatus: 'idle',
    lastBellTime: null,
    lastActivity: Date.now(),
    statusChanged: null
  };

  sessions.set(session.id, session);
  globalStats.totalSessions++;
  globalStats.activeUsers++;
  
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    sessions.delete(sessionId);
    globalStats.activeUsers = Math.max(0, globalStats.activeUsers - 1);
  }
}

// Create required directories
async function initializeDirectories() {
  const dirs = ['uploads/audio', 'data/sessions', 'data/exports'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

// REST API Routes

// Get global statistics
app.get('/api/stats', (req, res) => {
  res.json({
    ...globalStats,
    activeSessions: sessions.size,
    timestamp: Date.now()
  });
});

// Get session data
app.get('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    id: session.id,
    startTime: session.startTime,
    isRecording: session.isRecording,
    stats: {
      singleBells: session.singleBells,
      doubleBells: session.doubleBells,
      totalStops: session.totalStops,
      busStatus: session.busStatus
    },
    bellHistory: session.bellHistory.slice(0, 50), // Last 50 bells
    timeline: session.timeline.slice(0, 20), // Last 20 events
    lastActivity: session.lastActivity
  });
});

// Export session data
app.get('/api/session/:sessionId/export', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const exportData = {
    sessionId: session.id,
    startTime: session.startTime,
    exportTime: Date.now(),
    duration: Date.now() - session.startTime,
    statistics: {
      singleBells: session.singleBells,
      doubleBells: session.doubleBells,
      totalStops: session.totalStops
    },
    bellHistory: session.bellHistory,
    timeline: session.timeline,
    metadata: {
      version: '1.0',
      format: 'JSON'
    }
  };

  // Save to file
  const filename = `session-${session.id}-${Date.now()}.json`;
  const filepath = path.join('data/exports', filename);
  
  try {
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Upload and process audio file
app.post('/api/session/:sessionId/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Read audio file
    const audioBuffer = await fs.readFile(req.file.path);
    
    // Detect bells in audio
    const detection = await bellDetectionService.detectBells(audioBuffer, req.params.sessionId);
    
    if (detection) {
      const result = await bellDetectionService.processBellDetection(detection, req.params.sessionId);
      
      // Emit real-time update to client
      io.to(session.socketId).emit('bellDetected', result);
      
      res.json({
        success: true,
        detection: result.bellEvent,
        sessionStats: result.sessionStats
      });
    } else {
      res.json({
        success: true,
        detection: null,
        message: 'No bells detected in audio'
      });
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path);
    
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

// Get historical data with filtering
app.get('/api/history', async (req, res) => {
  const { startDate, endDate, type } = req.query;
  
  try {
    const allSessions = Array.from(sessions.values());
    let filteredData = [];

    allSessions.forEach(session => {
      session.bellHistory.forEach(bell => {
        if (startDate && bell.timestamp < new Date(startDate).getTime()) return;
        if (endDate && bell.timestamp > new Date(endDate).getTime()) return;
        if (type && bell.type !== type) return;
        
        filteredData.push({
          ...bell,
          sessionId: session.id
        });
      });
    });

    // Sort by timestamp (newest first)
    filteredData.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      data: filteredData.slice(0, 100), // Limit to 100 results
      total: filteredData.length,
      filters: { startDate, endDate, type }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Create new session for client
  const session = createSession(socket.id);
  
  // Send session ID to client
  socket.emit('sessionCreated', {
    sessionId: session.id,
    startTime: session.startTime
  });

  // Handle recording start
  socket.on('startRecording', (data) => {
    const session = getSession(data.sessionId);
    if (session) {
      session.isRecording = true;
      session.lastActivity = Date.now();
      
      socket.emit('recordingStarted', {
        sessionId: session.id,
        timestamp: Date.now()
      });

      // Start simulated bell detection for demo
      startSimulatedDetection(session.id, socket);
    }
  });

  // Handle recording stop
  socket.on('stopRecording', (data) => {
    const session = getSession(data.sessionId);
    if (session) {
      session.isRecording = false;
      session.lastActivity = Date.now();
      
      socket.emit('recordingStopped', {
        sessionId: session.id,
        timestamp: Date.now()
      });

      stopSimulatedDetection(session.id);
    }
  });

  // Handle real-time audio data
  socket.on('audioData', async (data) => {
    const session = getSession(data.sessionId);
    if (session && session.isRecording) {
      try {
        // Process audio chunk
        const detection = await bellDetectionService.detectBells(data.audioBuffer, data.sessionId);
        
        if (detection) {
          const result = await bellDetectionService.processBellDetection(detection, data.sessionId);
          socket.emit('bellDetected', result);
        }
      } catch (error) {
        console.error('Real-time audio processing error:', error);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find and delete session
    for (const [sessionId, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        stopSimulatedDetection(sessionId);
        deleteSession(sessionId);
        break;
      }
    }
  });
});

// Simulated bell detection for demo purposes
const simulationIntervals = new Map();

function startSimulatedDetection(sessionId, socket) {
  const interval = setInterval(async () => {
    const session = getSession(sessionId);
    if (!session || !session.isRecording) {
      stopSimulatedDetection(sessionId);
      return;
    }

    // 15% chance of detecting a bell every 2 seconds
    if (Math.random() < 0.15) {
      const mockAudioBuffer = Buffer.alloc(1024); // Mock audio data
      const detection = await bellDetectionService.detectBells(mockAudioBuffer, sessionId);
      
      if (detection) {
        const result = await bellDetectionService.processBellDetection(detection, sessionId);
        socket.emit('bellDetected', result);
      }
    }
  }, 2000);

  simulationIntervals.set(sessionId, interval);
}

function stopSimulatedDetection(sessionId) {
  const interval = simulationIntervals.get(sessionId);
  if (interval) {
    clearInterval(interval);
    simulationIntervals.delete(sessionId);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Initialize server
async function startServer() {
  try {
    await initializeDirectories();
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚌 Bus Bell Detection Server running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();