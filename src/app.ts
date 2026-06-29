import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins for easier local demo testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-webhook-secret'],
}));

// Configure urlencoded for Twilio POST webhooks (which send urlencoded form payloads)
app.use(express.urlencoded({ extended: true }));

// Configure JSON for standard REST client request payloads
app.use(express.json());

// API Health Check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'EstateFlow API', timestamp: new Date() });
});

// Root check route
app.get('/', (req, res) => {
  res.send('EstateFlow Real Estate Lead Conversion CRM API');
});

// Register all API modular routes
app.use('/api', routes);

export default app;
