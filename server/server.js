require('dotenv').config({ path: '../.env'});

const express = require('express');
const mysql = require('mysql2');
const app = express();

// MySQL database configuration
const db = mysql.createConnection({
  host: process.env.MY_SQL_HOST,
  user: process.env.MY_SQL_USERNAME,
  password: process.env.MY_SQL_PASSWORD,
  database: process.env.MY_SQL_DATABASE,
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// Example route to fetch data from MySQL
app.get('/api/data', (req, res) => {
  const query = 'SELECT * FROM Education';

  // Execute the query
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results);
    }
  });
});

// Start the server
const PORT = process.env.MY_SQL_PORT | 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
