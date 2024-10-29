const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // Ensures correct parsing of the key
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

// POST route to submit player scores
app.post('/submit-score', async (req, res) => {
  try {
    const { playerName, boulderScores, category } = req.body; // Expecting an array of scores for each boulder and category

    // Log the received data for debugging
    console.log('Received data:', {
      playerName,
      boulderScores,
      category,
    });

    // Ensure boulderScores is an array of 10 numbers and category is a string
    if (!Array.isArray(boulderScores) || boulderScores.length !== 10) {
      return res.status(400).send({ message: 'You must provide exactly 10 boulder scores.' });
    }
    if (typeof category !== 'string' || category.trim() === '') {
      return res.status(400).send({ message: 'You must provide a valid category.' });
    }

    // Calculate the total score
    const totalScore = boulderScores.reduce((acc, score) => acc + score, 0);

    // Add the player scores, category, and total score to Firestore
    await admin.firestore().collection('scores').add({
      playerName,
      boulderScores,   // Store individual boulder scores
      category,        // Store the player's category correctly (lowercase)
      totalScore,      // Store the total score for leaderboard display
      timestamp: new Date() // Add a timestamp for when the scores were submitted
    });

    res.status(200).send({ message: 'Scores submitted successfully!' });
  } catch (error) {
    console.error('Error submitting scores:', error); // Log the error for debugging
    res.status(500).send({ message: 'Error submitting scores', error });
  }
});

// GET route to fetch the leaderboard (top 10 players by total score)
app.get('/leaderboard', async (req, res) => {
  try {
    // Get top 10 players by total score from Firestore, ordered by totalScore in descending order
    const scoresRef = admin.firestore().collection('scores').orderBy('totalScore', 'desc').limit(10);
    const snapshot = await scoresRef.get();

    let leaderboard = [];
    snapshot.forEach((doc) => {
      leaderboard.push(doc.data()); // Add each player's data (including totalScore, category, and boulderScores) to the array
    });

    res.status(200).send(leaderboard); // Send the leaderboard to the frontend
  } catch (error) {
    console.error('Error fetching leaderboard:', error); // Log the error for debugging
    res.status(500).send({ message: 'Error fetching leaderboard', error });
  }
});

// DELETE route to clear the leaderboard
app.delete('/leaderboard', async (req, res) => {
  try {
    const scoresRef = admin.firestore().collection('scores');
    const snapshot = await scoresRef.get();
    
    // Check if there are any scores to delete
    if (snapshot.empty) {
      return res.status(200).send({ message: 'No scores to clear.' });
    }

    // Delete all documents in the scores collection
    const batch = admin.firestore().batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref); // Delete each document
    });

    await batch.commit(); // Commit the batch delete
    res.status(200).send({ message: 'Leaderboard cleared successfully!' });
  } catch (error) {
    console.error('Error clearing leaderboard:', error); // Log the error for debugging
    res.status(500).send({ message: 'Error clearing leaderboard', error });
  }
});

// Basic route to check server status
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Test route to verify Firebase connection
app.get('/test-firebase', async (req, res) => {
  try {
    // Check for a document in the Firestore 'testCollection'
    const doc = await admin.firestore().collection('testCollection').doc('testDoc').get();
    if (!doc.exists) {
      res.send('No such document!');
    } else {
      res.send('Document data: ' + JSON.stringify(doc.data()));
    }
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).send('Error connecting to Firebase');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});