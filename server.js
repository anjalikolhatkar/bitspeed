const express = require('express');
const cors = require('cors'); // Import the CORS package
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors()); // Use CORS middleware
app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'A@njali1803', // Replace with your password
  database: 'mydatabase'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL!');
});

// POST /identify - Identify and Merge Contacts
app.post('/identify', (req, res) => {
  const { email, phoneNumber } = req.body;
  
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber is required.' });
  }

  // Query to find existing contacts
  let query = 'SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?';
  db.query(query, [email, phoneNumber], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed.' });
    }

    if (results.length === 0) {
      // No existing contact found, create a new primary contact
      const newContact = {
        email,
        phoneNumber,
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.query('INSERT INTO Contact SET ?', newContact, (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database insert failed.' });
        }

        return res.status(200).json({
          contact: {
            primaryContactId: result.insertId,
            emails: [email].filter(Boolean),
            phoneNumbers: [phoneNumber].filter(Boolean),
            secondaryContactIds: []
          }
        });
      });
    } else {
      // Existing contact(s) found - determine primary contact
      let primaryContact = results.find(contact => contact.linkPrecedence === 'primary') || results[0];

      // Ensure we get the oldest primary contact
      for (let contact of results) {
        if (contact.linkPrecedence === 'primary' && contact.createdAt < primaryContact.createdAt) {
          primaryContact = contact;
        }
      }

      // Check if new email or phone needs to be added
      const isNewEmail = email && !results.some(c => c.email === email);
      const isNewPhone = phoneNumber && !results.some(c => c.phoneNumber === phoneNumber);

      let secondaryContactIds = results.filter(c => c.linkPrecedence === 'secondary').map(c => c.id);
      
      if (isNewEmail || isNewPhone) {
        // Create a new secondary contact if email or phone is new
        const newSecondaryContact = {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: 'secondary',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        db.query('INSERT INTO Contact SET ?', newSecondaryContact, (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Database insert failed.' });
          }

          secondaryContactIds.push(result.insertId);

          return res.status(200).json({
            contact: {
              primaryContactId: primaryContact.id,
              emails: [...new Set(results.map(c => c.email).concat(email))].filter(Boolean),
              phoneNumbers: [...new Set(results.map(c => c.phoneNumber).concat(phoneNumber))].filter(Boolean),
              secondaryContactIds
            }
          });
        });
      } else {
        // No new contact needed, just return the existing structure
        return res.status(200).json({
          contact: {
            primaryContactId: primaryContact.id,
            emails: [...new Set(results.map(c => c.email))].filter(Boolean),
            phoneNumbers: [...new Set(results.map(c => c.phoneNumber))].filter(Boolean),
            secondaryContactIds
          }
        });
      }
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
