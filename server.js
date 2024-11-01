const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'https://shimmering-pegasus-10582d.netlify.app', // Replace with your frontend URL
}));
app.use(bodyParser.json());

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Ensures correct parsing of the key
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

// POST route to submit player scores
app.post('/submit-score', async (req, res) => {
  try {
    const { playerName, boulderScores, category } = req.body;

    // Validate the received data
    if (!Array.isArray(boulderScores) || boulderScores.length !== 10) {
      return res.status(400).send({ message: 'You must provide exactly 10 boulder scores.' });
    }
    if (typeof category !== 'string' || category.trim() === '') {
      return res.status(400).send({ message: 'You must provide a valid category.' });
    }

    // Calculate the total score
    const totalScore = boulderScores.reduce((acc, score) => acc + score, 0);

    // Add data to Firestore
    await admin.firestore().collection('scores').add({
      playerName,
      boulderScores,
      category,
      totalScore,
      timestamp: new Date(),
    });

    res.status(200).send({ message: 'Scores submitted successfully!' });
  } catch (error) {
    console.error('Error submitting scores:', error);
    res.status(500).send({ message: 'Error submitting scores', error });
  }
});

// GET route to fetch the leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const scoresRef = admin.firestore().collection('scores').orderBy('totalScore', 'desc').limit(10);
    const snapshot = await scoresRef.get();

    let leaderboard = [];
    snapshot.forEach((doc) => {
      leaderboard.push(doc.data());
    });

    res.status(200).send(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).send({ message: 'Error fetching leaderboard', error });
  }
});

// DELETE route to clear the leaderboard
app.delete('/leaderboard', async (req, res) => {
  try {
    const scoresRef = admin.firestore().collection('scores');
    const snapshot = await scoresRef.get();

    if (snapshot.empty) {
      return res.status(200).send({ message: 'No scores to clear.' });
    }

    const batch = admin.firestore().batch();
    snapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    res.status(200).send({ message: 'Leaderboard cleared successfully!' });
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    res.status(500).send({ message: 'Error clearing leaderboard', error });
  }
});

// Health check route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Firebase test route
app.get('/test-firebase', async (req, res) => {
  try {
    const doc = await admin.firestore().collection('testCollection').doc('testDoc').get();
    if (!doc.exists) {
      res.send('No such document!');
    } else {
      res.send('Document data: ' + JSON.stringify(doc.data()));
    }
  } catch (error) {
    console.error('Error connecting to Firebase:', error);
    res.status(500).send('Error connecting to Firebase');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
