const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const { format } = require("date-fns");
const { utcToZonedTime } = require('date-fns-tz');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hohoh';
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

function formatTimestamp(timestamp) {
  const timeZone = 'Asia/Jakarta';
  const zonedTime = utcToZonedTime(timestamp, timeZone);
  return format(zonedTime, 'yyyy-MM-dd HH:mm:ss', { timeZone });
}

function authenticateToken(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token.' });
    }
    next();
  });
}

app.post('/api/login', async (req, res) => {
  const { userEmail } = req.body;

  try {
    // Query the Supabase database to check if the userEmail exists in the users table
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', userEmail)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(401).json({ success: false, message: 'Authentication failed. User not found.' });
    }

    // User with the provided email exists, generate a JWT token with userEmail
    const token = jwt.sign({ userEmail }, JWT_SECRET, { expiresIn: '1h' });

    // Send the token in the response
    res.json({ success: true, message: 'Authentication successful.', token });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error during authentication: ' + error.message });
  }
});

app.get('/api/probox', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data.length > 0) {
      data[0].timestamp = formatTimestamp(data[0].timestamp);

      res.status(200).json({ success: true, message: 'Latest data retrieved successfully.', data: data[0] });
    } else {
      res.status(404).json({ success: false, message: 'No data found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving latest data: ' + error.message });
  }
});

app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor')
      .select('*')
      .order('id', { ascending: false })
      .range(1, 24);

    if (error) {
      throw error;
    }

    if (data.length > 0) {
      data.forEach((item) => {
        item.timestamp = formatTimestamp(item.timestamp);
      });

      res.status(200).json({ success: true, message: 'Historical data retrieved successfully.', data: data });
    } else {
      res.status(404).json({ success: false, message: 'No history data found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving history data: ' + error.message });
  }
});

app.get('/api/test', authenticateToken, async (req, res) => {
      res.json({ success: true, message: 'API accessed.'});
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
